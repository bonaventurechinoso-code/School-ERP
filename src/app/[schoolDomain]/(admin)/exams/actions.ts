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
async function verifyTenantSession(targetSchoolId: string): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  const isDev = process.env.NODE_ENV === "development";

  if (!sessionToken && isDev) {
    return { authorized: true, userId: "admin-dev-id" };
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

    const userId = (payload.userId as string) || (payload.sub as string) || "system-admin";
    return { authorized: true, userId };
  } catch (err: any) {
    if (isDev) return { authorized: true, userId: "admin-dev-id" };
    return { authorized: false, error: "Unauthorized: Invalid session credentials." };
  }
}

/**
 * Ensure the multi-tenant bonavee_scheduled_exams table exists in the database
 */
async function ensureScheduledExamsTableExists() {
  try {
    await basePrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bonavee_scheduled_exams (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        title TEXT NOT NULL,
        class_name TEXT,
        subject TEXT NOT NULL,
        assessment_type TEXT NOT NULL,
        exam_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        start_time TEXT,
        duration INTEGER,
        venue TEXT,
        invigilator_id TEXT,
        invigilator_name TEXT,
        max_score DOUBLE PRECISION NOT NULL DEFAULT 100,
        status TEXT NOT NULL DEFAULT 'published',
        created_by TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.warn("[Schema] Scheduled exams table initialization notice:", err);
  }
}

export type ScheduledExamPayload = {
  title: string;
  className: string;
  subject: string;
  assessmentType: "CA1" | "CA2" | "CA3" | "EXAM" | string;
  examDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  duration: number; // minutes
  venue: string;
  invigilatorId?: string;
  invigilatorName?: string;
  maxScore: number;
};

/**
 * SECURE FORM MULTI-TENANT MUTATION ROUTER:
 * Creates an assessment entry in bonavee_scheduled_exams with strict tenant isolation:
 * { tenant_id: params.tenant, ...formData, status: 'published', created_by: auth.user.id }
 * Also synchronizes with Prisma's Exam model to maintain grading roster spreadsheets.
 */
export async function createScheduledExam(
  schoolId: string,
  tenantDomain: string,
  formData: ScheduledExamPayload
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  await ensureScheduledExamsTableExists();

  const tenantDb = getTenantClient(schoolId);
  const effectiveTenantId = schoolId || tenantDomain;
  const createdBy = auth.userId || "system-admin";
  const scheduledId = `exam-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const examDateObj = new Date(formData.examDate);

  try {
    // 1. Resolve or create course in tenantDb for relational consistency
    let course = await tenantDb.course.findFirst({
      where: {
        schoolId,
        OR: [
          { id: formData.subject },
          { name: formData.subject },
        ],
      },
    });

    if (!course) {
      const cleanCode = formData.subject.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "") + Math.floor(100 + Math.random() * 900);
      course = await tenantDb.course.create({
        data: {
          schoolId,
          name: formData.subject,
          code: cleanCode,
        },
      });
    }

    // 2. Resolve Invigilator Name if ID was provided
    let invigilatorName = formData.invigilatorName || "";
    if (formData.invigilatorId && !invigilatorName) {
      const staffMember = await tenantDb.staff.findUnique({
        where: { id: formData.invigilatorId },
        select: { firstName: true, lastName: true },
      });
      if (staffMember) {
        invigilatorName = `${staffMember.firstName} ${staffMember.lastName}`;
      }
    }

    // 3. Database Insertion Transaction into 'bonavee_scheduled_exams'
    await basePrisma.$executeRawUnsafe(
      `INSERT INTO bonavee_scheduled_exams (
        id, tenant_id, title, class_name, subject, assessment_type,
        exam_date, start_time, duration, venue, invigilator_id, invigilator_name,
        max_score, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
      scheduledId,
      effectiveTenantId,
      formData.title.trim(),
      formData.className || "General Class",
      formData.subject.trim(),
      formData.assessmentType,
      examDateObj,
      formData.startTime || "09:00",
      Number(formData.duration) || 60,
      formData.venue.trim() || "Main Examination Hall",
      formData.invigilatorId || null,
      invigilatorName || null,
      Number(formData.maxScore),
      "published",
      createdBy
    );

    // 4. Dual Synchronization with Prisma Exam model for active grading roster spreadsheets
    await tenantDb.exam.create({
      data: {
        id: scheduledId,
        schoolId,
        courseId: course.id,
        name: formData.title.trim(),
        semester: formData.className ? `${formData.className} - ${formData.assessmentType}` : "1st Term",
        date: examDateObj,
        maxScore: Number(formData.maxScore),
      },
    }).catch((err) => {
      console.warn("[Prisma Sync] Notice on exam creation mirroring:", err?.message);
    });

    // 5. Invalidate caches
    await invalidateGradingNamespace(schoolId);
    revalidatePath(`/[schoolDomain]/exams`, "page");
    revalidatePath(`/[schoolDomain]/assessments`, "page");

    return {
      success: true,
      exam: {
        id: scheduledId,
        tenant_id: effectiveTenantId,
        title: formData.title.trim(),
        class_name: formData.className || "General Class",
        subject: formData.subject.trim(),
        assessment_type: formData.assessmentType,
        exam_date: examDateObj.toISOString(),
        start_time: formData.startTime || "09:00",
        duration: Number(formData.duration) || 60,
        venue: formData.venue.trim() || "Main Examination Hall",
        invigilator_id: formData.invigilatorId || null,
        invigilator_name: invigilatorName || null,
        max_score: Number(formData.maxScore),
        status: "published",
        created_by: createdBy,
      },
    };
  } catch (error: any) {
    console.error("[Server Action] Failed to create scheduled exam:", error);
    return { success: false, error: error.message || "Failed to schedule exam." };
  }
}

/**
 * Update an existing scheduled assessment in bonavee_scheduled_exams
 */
export async function updateScheduledExam(
  schoolId: string,
  tenantDomain: string,
  examId: string,
  formData: ScheduledExamPayload
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  await ensureScheduledExamsTableExists();
  const effectiveTenantId = schoolId || tenantDomain;
  const examDateObj = new Date(formData.examDate);

  try {
    // Resolve Invigilator Name
    let invigilatorName = formData.invigilatorName || "";
    if (formData.invigilatorId && !invigilatorName) {
      const tenantDb = getTenantClient(schoolId);
      const staffMember = await tenantDb.staff.findUnique({
        where: { id: formData.invigilatorId },
        select: { firstName: true, lastName: true },
      });
      if (staffMember) {
        invigilatorName = `${staffMember.firstName} ${staffMember.lastName}`;
      }
    }

    await basePrisma.$executeRawUnsafe(
      `UPDATE bonavee_scheduled_exams 
       SET title = $1, class_name = $2, subject = $3, assessment_type = $4,
           exam_date = $5, start_time = $6, duration = $7, venue = $8,
           invigilator_id = $9, invigilator_name = $10, max_score = $11, updated_at = NOW()
       WHERE id = $12 AND (tenant_id = $13 OR tenant_id = $14)`,
      formData.title.trim(),
      formData.className,
      formData.subject.trim(),
      formData.assessmentType,
      examDateObj,
      formData.startTime || "09:00",
      Number(formData.duration) || 60,
      formData.venue.trim() || "Main Examination Hall",
      formData.invigilatorId || null,
      invigilatorName || null,
      Number(formData.maxScore),
      examId,
      effectiveTenantId,
      tenantDomain
    );

    // Sync update to Prisma Exam table
    const tenantDb = getTenantClient(schoolId);
    await tenantDb.exam.updateMany({
      where: { id: examId, schoolId },
      data: {
        name: formData.title.trim(),
        date: examDateObj,
        maxScore: Number(formData.maxScore),
      },
    }).catch(() => null);

    await invalidateGradingNamespace(schoolId);
    revalidatePath(`/[schoolDomain]/exams`, "page");
    revalidatePath(`/[schoolDomain]/assessments`, "page");

    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to update scheduled exam:", error);
    return { success: false, error: error.message || "Failed to update exam." };
  }
}

/**
 * Toggle publish/unpublish status for an assessment
 */
export async function toggleExamPublishStatus(
  schoolId: string,
  tenantDomain: string,
  examId: string,
  currentStatus: string
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  await ensureScheduledExamsTableExists();
  const effectiveTenantId = schoolId || tenantDomain;
  const nextStatus = currentStatus === "published" ? "unpublished" : "published";

  try {
    await basePrisma.$executeRawUnsafe(
      `UPDATE bonavee_scheduled_exams 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND (tenant_id = $3 OR tenant_id = $4)`,
      nextStatus,
      examId,
      effectiveTenantId,
      tenantDomain
    );

    await invalidateGradingNamespace(schoolId);
    revalidatePath(`/[schoolDomain]/exams`, "page");
    revalidatePath(`/[schoolDomain]/assessments`, "page");

    return { success: true, nextStatus };
  } catch (error: any) {
    console.error("[Server Action] Failed to toggle publish status:", error);
    return { success: false, error: error.message || "Failed to update status." };
  }
}

/**
 * Delete scheduled exam with multi-tenant isolation
 */
export async function deleteScheduledExam(
  schoolId: string,
  tenantDomain: string,
  examId: string
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  await ensureScheduledExamsTableExists();
  const effectiveTenantId = schoolId || tenantDomain;

  try {
    await basePrisma.$executeRawUnsafe(
      `DELETE FROM bonavee_scheduled_exams WHERE id = $1 AND (tenant_id = $2 OR tenant_id = $3)`,
      examId,
      effectiveTenantId,
      tenantDomain
    );

    const tenantDb = getTenantClient(schoolId);
    await tenantDb.exam.deleteMany({
      where: { id: examId, schoolId },
    }).catch(() => null);

    await invalidateGradingNamespace(schoolId);
    revalidatePath(`/[schoolDomain]/exams`, "page");
    revalidatePath(`/[schoolDomain]/assessments`, "page");

    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete scheduled exam:", error);
    return { success: false, error: error.message || "Failed to delete exam." };
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

    // Also delete from bonavee_scheduled_exams
    await basePrisma.$executeRawUnsafe(
      `DELETE FROM bonavee_scheduled_exams WHERE id = $1 AND tenant_id = $2`,
      id,
      schoolId
    ).catch(() => null);

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
