"use server";

import { getTenantClient, basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { invalidateGradingNamespace, invalidateTenantMetadata } from "@/lib/cache-invalidation";
import { cookies } from "next/headers";
import * as jose from "jose";

/**
 * Verify cryptographic tenant session and ensure operations are bound
 * to the authorized schoolId.
 */
async function verifyTenantSession(targetSchoolId: string): Promise<{ authorized: boolean; error?: string }> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  const isDev = process.env.NODE_ENV === "development";

  if (!sessionToken && isDev) {
    return { authorized: true };
  }

  if (!sessionToken) {
    return { authorized: false, error: "Unauthorized: Session token missing." };
  }

  try {
    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(sessionToken, secret);
    const tokenTenantId = (payload.tenantId as string) || (payload.schoolId as string);

    if (tokenTenantId && tokenTenantId !== targetSchoolId && !isDev) {
      return { authorized: false, error: "Forbidden: Cross-tenant access denied." };
    }

    return { authorized: true };
  } catch (err: any) {
    if (isDev) return { authorized: true };
    return { authorized: false, error: "Unauthorized: Invalid session credentials." };
  }
}

export async function createExam(
  schoolId: string,
  data: {
    courseId: string;
    name: string;
    semester: string;
    date: string; // YYYY-MM-DD
    maxScore: number;
  }
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const tenantDb = getTenantClient(schoolId);
  
  try {
    const examDate = new Date(data.date);
    let resolvedCourseId = data.courseId;

    // Resolve or automatically link course by ID or name under current tenant constraint
    const existingCourse = await tenantDb.course.findFirst({
      where: {
        schoolId,
        OR: [
          { id: data.courseId },
          { name: data.courseId }
        ]
      }
    });

    if (existingCourse) {
      resolvedCourseId = existingCourse.id;
    } else if (data.courseId) {
      // Create course record so foreign key constraint succeeds seamlessly
      const cleanCode = data.courseId.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "") + Math.floor(100 + Math.random() * 900);
      const newCourse = await tenantDb.course.create({
        data: {
          schoolId,
          name: data.courseId,
          code: cleanCode,
        }
      });
      resolvedCourseId = newCourse.id;
    }

    const createdExam = await tenantDb.exam.create({
      data: {
        schoolId,
        courseId: resolvedCourseId,
        name: data.name,
        semester: data.semester,
        date: examDate,
        maxScore: data.maxScore,
      },
      include: {
        course: { include: { tier: true } },
      },
    });

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);

    revalidatePath(`/[schoolDomain]/exams`, "page");
    return { success: true, exam: createdExam };

  } catch (error: any) {
    console.error("[Server Action] Failed to create exam:", error);
    return { success: false, error: error.message || "Failed to create exam." };
  }
}

export async function deleteExam(schoolId: string, id: string) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const tenantDb = getTenantClient(schoolId);
  
  try {
    // Multi-tenant locator query constraint: WHERE id = id AND schoolId = schoolId
    await tenantDb.exam.deleteMany({
      where: { 
        id,
        schoolId
      }
    });

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);

    revalidatePath(`/[schoolDomain]/exams`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete exam:", error);
    return { success: false, error: error.message || "Failed to delete exam." };
  }
}

export async function upsertExamResult(
  schoolId: string,
  examId: string,
  studentId: string,
  score: number,
  ca1Score?: number,
  ca2Score?: number,
  examScore?: number,
  letterGrade?: string,
  remarks?: string
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const tenantDb = getTenantClient(schoolId);
  
  try {
    // Multi-tenant isolation constraint on compound key
    await tenantDb.examResult.upsert({
      where: {
        schoolId_examId_studentId: {
          schoolId,
          examId,
          studentId
        }
      },
      update: {
        score,
        ca1Score: ca1Score ?? null,
        ca2Score: ca2Score ?? null,
        examScore: examScore ?? null,
        letterGrade,
        remarks
      },
      create: {
        schoolId,
        examId,
        studentId,
        score,
        ca1Score: ca1Score ?? null,
        ca2Score: ca2Score ?? null,
        examScore: examScore ?? null,
        letterGrade,
        remarks
      }
    });

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);

    revalidatePath(`/[schoolDomain]/exams`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to upsert exam result:", error);
    return { success: false, error: error.message || "Failed to upsert exam result." };
  }
}

/**
 * 2. CONFIGURATION PAGE CONTROL - SECURE MULTI-TENANT MUTATION
 * Saves customized assessment weights per tier under WHERE tenant_id = current tenant
 */
export async function saveTierAssessmentConfig(
  schoolId: string,
  tierName: string,
  weights: Record<string, number>
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  // Validate cumulative weight equals exactly 100%
  const totalWeight = Object.values(weights).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  if (totalWeight !== 100) {
    return {
      success: false,
      error: `Validation Error: Cumulative weight total must equal exactly 100% (currently ${totalWeight}%).`
    };
  }

  try {
    // Strict multi-tenant locator query constraint: WHERE id = schoolId
    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, subdomain: true, tierDatabasesConfig: true }
    });

    if (!school) {
      return { success: false, error: "School not found." };
    }

    const currentConfig: any = (school.tierDatabasesConfig as object) || {};
    const currentWeights = currentConfig.assessmentWeights || {};

    const updatedConfig = {
      ...currentConfig,
      assessmentWeights: {
        ...currentWeights,
        [tierName]: weights
      }
    };

    // Strict multi-tenant update constraint
    await basePrisma.school.update({
      where: { id: schoolId },
      data: {
        tierDatabasesConfig: updatedConfig
      }
    });

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);
    if (school.subdomain) {
      await invalidateTenantMetadata(school.subdomain);
    }

    revalidatePath(`/[schoolDomain]/exams`, "page");
    return { success: true, message: `Assessment weights for ${tierName} saved successfully.` };
  } catch (error: any) {
    console.error("[Server Action] Failed to save tier assessment configuration:", error);
    return { success: false, error: error.message || "Failed to save tier assessment configuration." };
  }
}

/**
 * Retrieves saved assessment weights for a tenant
 */
export async function getTierAssessmentConfigs(schoolId: string) {
  try {
    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { tierDatabasesConfig: true }
    });
    const config: any = (school?.tierDatabasesConfig as object) || {};
    return config.assessmentWeights || {};
  } catch (err) {
    console.error("[Server Action] Failed to get tier assessment configurations:", err);
    return {};
  }
}
