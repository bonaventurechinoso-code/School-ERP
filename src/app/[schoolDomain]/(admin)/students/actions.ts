"use server";

import { basePrisma, getTenantClient, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import * as jose from "jose";
import { cacheAside, buildCacheKey } from "@/lib/cache";
import { executeCursorPagination, CursorPaginationResult } from "@/lib/pagination";
import { invalidateStudentNamespace } from "@/lib/cache-invalidation";

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // In non-request execution contexts (e.g. testing scripts / CLI), revalidatePath is a no-op
  }
}

export async function resolveDbForAction(schoolId: string, tierContext?: string, tierId?: string) {
  let activeTier = tierContext;

  if (!activeTier && tierId) {
    try {
      const tier = await basePrisma.academicTier.findUnique({
        where: { id: tierId },
        select: { name: true, databaseUrl: true },
      });
      if (tier?.name) activeTier = tier.name;
    } catch {}
  }

  if (!activeTier) {
    try {
      const cookieStore = await cookies();
      activeTier = cookieStore.get("activeTier")?.value;
    } catch {}
  }

  return getPrismaClientForTier(schoolId, activeTier || "");
}

/**
 * High-performance cursor-based fetching for Student Roster wrapped in Smart Cache-Aside.
 * Flat O(log N) lookup time even with millions of student records.
 */
export async function fetchStudentsPaginated(
  schoolId: string,
  options?: {
    tierName?: string;
    tierId?: string;
    status?: string;
    className?: string;
    cursor?: string | null;
    limit?: number;
    search?: string;
  }
): Promise<CursorPaginationResult<any>> {
  const activeTier = options?.tierName || "all";
  const status = options?.status || "ENROLLED";
  const className = options?.className;
  const cursor = options?.cursor;
  const limit = options?.limit || 25;
  const search = options?.search;

  const cacheKey = buildCacheKey({
    tenantId: schoolId,
    tierName: activeTier,
    table: "students",
    action: "paginated",
    cursor,
    limit,
    filters: { status: status.toLowerCase(), className, search, tierId: options?.tierId },
  });

  return cacheAside<CursorPaginationResult<any>>({
    key: cacheKey,
    ttlSeconds: 1800, // 30 minutes safe sliding TTL
    fetchFn: async () => {
      const tenantDb = await resolveDbForAction(schoolId, options?.tierName, options?.tierId);

      const andConditions: any[] = [
        { schoolId },
      ];

      // Strict status filtering: Enforce status: 'Enrolled'
      if (status && status !== "ALL") {
        if (status.toUpperCase() === "ENROLLED") {
          andConditions.push({
            status: { in: ["ENROLLED", "Enrolled"] },
          });
        } else {
          andConditions.push({ status });
        }
      } else {
        andConditions.push({
          status: { in: ["ENROLLED", "Enrolled"] },
        });
      }

      // Explicitly exclude any records with status 'Applicant', 'Prospect', 'Inquiry', or 'Screened'
      andConditions.push({
        NOT: {
          status: {
            in: [
              "APPLICANT", "Applicant",
              "PROSPECT", "Prospect",
              "INQUIRY", "Inquiry",
              "SCREENED", "Screened",
            ],
          },
        },
      });

      // Resolve tierId if provided across isolated tier DB and central DB schemas
      if (options?.tierId) {
        const tierInDb = await tenantDb.academicTier.findFirst({
          where: {
            OR: [
              { id: options.tierId },
              ...(options?.tierName ? [{ name: { equals: options.tierName, mode: "insensitive" as const } }] : []),
            ],
          },
        }).catch(() => null);

        if (tierInDb) {
          andConditions.push({ tierId: tierInDb.id });
        }
      }

      if (className && className !== "ALL") {
        const cName = className.trim();
        const altClass1 = cName.toLowerCase().startsWith("class ")
          ? cName.replace(/class\s+/i, "Primary ")
          : cName.toLowerCase().startsWith("primary ")
          ? cName.replace(/primary\s+/i, "Class ")
          : null;
        const altClass2 = cName.toLowerCase().startsWith("class ")
          ? cName.replace(/class\s+/i, "Basic ")
          : null;

        andConditions.push({
          OR: [
            { currentClass: { equals: cName, mode: "insensitive" } },
            { currentClass: { startsWith: cName, mode: "insensitive" } },
            ...(altClass1
              ? [
                  { currentClass: { equals: altClass1, mode: "insensitive" } },
                  { currentClass: { startsWith: altClass1, mode: "insensitive" } },
                ]
              : []),
            ...(altClass2
              ? [
                  { currentClass: { equals: altClass2, mode: "insensitive" } },
                  { currentClass: { startsWith: altClass2, mode: "insensitive" } },
                ]
              : []),
          ],
        });
      }

      if (search && search.trim()) {
        const query = search.trim();
        andConditions.push({
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { admissionNumber: { contains: query, mode: "insensitive" } },
            { currentClass: { contains: query, mode: "insensitive" } },
          ],
        });
      }

      const whereClause = andConditions.length > 1 ? { AND: andConditions } : andConditions[0] || { schoolId };

      return executeCursorPagination(async (args) => {
        return tenantDb.student.findMany({
          ...args,
          where: whereClause,
          orderBy: { createdAt: "desc" },
          include: { tier: true },
        });
      }, { cursor, limit });
    },
  });
}

export async function createStudent(
  schoolId: string,
  data: { 
    firstName: string; lastName: string; email: string; status: string; tierId: string; dynamicFields?: any;
    admissionNumber?: string; currentClass?: string; dateOfBirth?: Date; stateOfOrigin?: string;
    parentName?: string; parentOccupation?: string; parentEmail?: string; parentPhone?: string; parentWhatsApp?: string;
  },
  tierContext?: string
) {
  // RBAC GUARD
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    if (!sessionToken) return { success: false, error: "HTTP 401 Unauthorized" };
    
    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(sessionToken, secret);
    
    if (payload.role === "TEACHER") {
      return { success: false, error: "HTTP 403 Forbidden: Teachers are not permitted to manually register new students." };
    }
  } catch (err) {
    return { success: false, error: "HTTP 401 Unauthorized" };
  }

  const tenantDb = await resolveDbForAction(schoolId, tierContext, data.tierId);
  
  try {
    const timestampData: any = {};
    if (data.status === "PROSPECT") timestampData.prospectAt = new Date();
    if (data.status === "APPLICANT") timestampData.applicantAt = new Date();
    if (data.status === "SCREENED") timestampData.screenedAt = new Date();
    if (data.status === "ENROLLED") timestampData.enrolledAt = new Date();

    let finalAdmissionNumber = data.admissionNumber;
    if (!finalAdmissionNumber) {
      const school = await basePrisma.school.findUnique({ where: { id: schoolId } });
      const studentCount = await tenantDb.student.count();
      const prefix = school ? school.subdomain.toUpperCase() : "SCH";
      const year = new Date().getFullYear();
      const seq = String(studentCount + 1).padStart(3, '0');
      finalAdmissionNumber = `${prefix}/${year}/${seq}`;
    }

    await tenantDb.student.create({
      data: {
        schoolId,
        tierId: data.tierId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        status: data.status,
        dynamicFields: data.dynamicFields || null,
        admissionNumber: finalAdmissionNumber,
        currentClass: data.currentClass || null,
        dateOfBirth: data.dateOfBirth || null,
        stateOfOrigin: data.stateOfOrigin || null,
        parentName: data.parentName || null,
        parentOccupation: data.parentOccupation || null,
        parentEmail: data.parentEmail || null,
        parentPhone: data.parentPhone || null,
        parentWhatsApp: data.parentWhatsApp || null,
        ...timestampData
      }
    });

    // Write-Through Cache Invalidation
    await invalidateStudentNamespace(schoolId, tierContext);

    safeRevalidatePath(`/[schoolDomain]/students`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to create student:", error);
    return { success: false, error: error.message || "Failed to create student." };
  }
}

export async function updateStudent(
  schoolId: string,
  studentId: string,
  data: { 
    firstName: string; lastName: string; email: string; tierId: string; dynamicFields?: any;
    admissionNumber?: string; currentClass?: string; dateOfBirth?: Date; stateOfOrigin?: string;
    parentName?: string; parentOccupation?: string; parentEmail?: string; parentPhone?: string; parentWhatsApp?: string;
  },
  tierContext?: string
) {
  const tenantDb = await resolveDbForAction(schoolId, tierContext, data.tierId);
  
  try {
    await tenantDb.student.update({
      where: { id: studentId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        tierId: data.tierId,
        dynamicFields: data.dynamicFields || null,
        admissionNumber: data.admissionNumber || null,
        currentClass: data.currentClass || null,
        dateOfBirth: data.dateOfBirth || null,
        stateOfOrigin: data.stateOfOrigin || null,
        parentName: data.parentName || null,
        parentOccupation: data.parentOccupation || null,
        parentEmail: data.parentEmail || null,
        parentPhone: data.parentPhone || null,
        parentWhatsApp: data.parentWhatsApp || null,
      }
    });

    // Write-Through Cache Invalidation
    await invalidateStudentNamespace(schoolId, tierContext);

    safeRevalidatePath(`/[schoolDomain]/students`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to update student:", error);
    return { success: false, error: error.message || "Failed to update student." };
  }
}

export async function deleteStudent(schoolId: string, studentId: string, tierContext?: string) {
  const tenantDb = await resolveDbForAction(schoolId, tierContext);
  
  try {
    await tenantDb.student.delete({
      where: { id: studentId }
    });

    // Write-Through Cache Invalidation
    await invalidateStudentNamespace(schoolId, tierContext);

    safeRevalidatePath(`/[schoolDomain]/students`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete student:", error);
    return { success: false, error: error.message || "Failed to delete student." };
  }
}

export async function updateStudentStatus(
  schoolId: string,
  studentId: string,
  newStatus: string,
  tierContext?: string
) {
  const tenantDb = await resolveDbForAction(schoolId, tierContext);
  
  try {
    const data: any = { status: newStatus };
    
    switch (newStatus) {
      case "PROSPECT":
        data.prospectAt = new Date();
        break;
      case "APPLICANT":
        data.applicantAt = new Date();
        break;
      case "SCREENED":
        data.screenedAt = new Date();
        break;
      case "ENROLLED":
        data.enrolledAt = new Date();
        break;
      case "SUSPENDED":
        data.suspendedAt = new Date();
        break;
      case "EXPELLED":
        data.expelledAt = new Date();
        break;
      case "ALUMNI":
        data.alumniAt = new Date();
        break;
    }

    await tenantDb.student.update({
      where: { id: studentId },
      data
    });

    // Write-Through Cache Invalidation
    await invalidateStudentNamespace(schoolId, tierContext);

    safeRevalidatePath(`/[schoolDomain]/students`, "page");
  } catch (error) {
    console.error("[Server Action] Failed to update student status:", error);
    throw new Error("Failed to update student status.");
  }
}

export async function bulkGraduateClass(schoolId: string, className: string, tierContext?: string) {
  const tenantDb = await resolveDbForAction(schoolId, tierContext);
  try {
    const result = await tenantDb.student.updateMany({
      where: { 
        currentClass: className,
        status: { not: "ALUMNI" }
      },
      data: {
        status: "ALUMNI",
        alumniAt: new Date()
      }
    });

    // Write-Through Cache Invalidation
    await invalidateStudentNamespace(schoolId, tierContext);

    safeRevalidatePath(`/[schoolDomain]/students`, "page");
    return { success: true, count: result.count };
  } catch (error: any) {
    console.error("[Server Action] Failed to bulk graduate class:", error);
    return { success: false, error: error.message || "Failed to bulk graduate class." };
  }
}

export async function bulkGraduateStudents(schoolId: string, studentIds: string[], tierContext?: string) {
  const tenantDb = await resolveDbForAction(schoolId, tierContext);
  try {
    const result = await tenantDb.student.updateMany({
      where: { 
        id: { in: studentIds },
        status: { not: "ALUMNI" }
      },
      data: {
        status: "ALUMNI",
        alumniAt: new Date()
      }
    });

    // Write-Through Cache Invalidation
    await invalidateStudentNamespace(schoolId, tierContext);

    safeRevalidatePath(`/[schoolDomain]/students`, "page");
    return { success: true, count: result.count };
  } catch (error: any) {
    console.error("[Server Action] Failed to bulk graduate students:", error);
    return { success: false, error: error.message || "Failed to graduate students." };
  }
}

/**
 * Dynamic metric queries matching the active tier database.
 * Used for real-time overview card synchronization.
 */
export async function fetchStudentMetrics(
  schoolId: string,
  tierContext?: string,
  tierId?: string
) {
  try {
    const tenantDb = await resolveDbForAction(schoolId, tierContext, tierId);
    
    // Resolve tier filter across isolated tier DB and central DB schemas
    let tierFilter: any = {};
    if (tierId) {
      const tierInDb = await tenantDb.academicTier.findFirst({
        where: {
          OR: [
            { id: tierId },
            ...(tierContext ? [{ name: { equals: tierContext, mode: "insensitive" as const } }] : []),
          ],
        },
      }).catch(() => null);

      if (tierInDb) {
        tierFilter = { tierId: tierInDb.id };
      }
    }

    const [totalEnrolled, suspendedStudents, alumniCount] = await Promise.all([
      tenantDb.student.count({
        where: {
          schoolId,
          status: "ENROLLED",
          ...tierFilter,
        },
      }).catch(() => 0),
      tenantDb.student.count({
        where: {
          schoolId,
          status: "SUSPENDED",
          ...tierFilter,
        },
      }).catch(() => 0),
      tenantDb.student.count({
        where: {
          schoolId,
          status: "ALUMNI",
          ...tierFilter,
        },
      }).catch(() => 0),
    ]);

    return {
      success: true,
      totalEnrolled,
      suspendedStudents,
      alumniCount,
    };
  } catch (error: any) {
    console.error("[Server Action] fetchStudentMetrics error:", error);
    return {
      success: false,
      totalEnrolled: 0,
      suspendedStudents: 0,
      alumniCount: 0,
    };
  }
}

/**
 * Toggle student suspension in the isolated tier database and deactivate/reactivate portal credentials.
 */
export async function toggleStudentSuspension(
  schoolId: string,
  studentId: string,
  tierContext?: string
) {
  try {
    const tenantDb = await resolveDbForAction(schoolId, tierContext);
    const existing = await tenantDb.student.findUnique({
      where: { id: studentId },
    });

    if (!existing) {
      return { success: false, error: "Student not found in tier database." };
    }

    const isCurrentlySuspended = existing.status === "SUSPENDED";
    const newStatus = isCurrentlySuspended ? "ENROLLED" : "SUSPENDED";

    // Manage portal credentials flag in dynamicFields
    const existingFields = (existing.dynamicFields as Record<string, any>) || {};
    const updatedFields = {
      ...existingFields,
      portalAccessDisabled: !isCurrentlySuspended,
      suspendedReason: !isCurrentlySuspended ? "Administrative action from Student Roster" : null,
    };

    const updatePayload = {
      status: newStatus,
      suspendedAt: !isCurrentlySuspended ? new Date() : null,
      dynamicFields: updatedFields,
    };

    // Update in isolated tier DB
    const updatedStudent = await tenantDb.student.update({
      where: { id: studentId },
      data: updatePayload,
      include: { tier: true },
    });

    // Mirror to basePrisma
    try {
      await basePrisma.student.update({
        where: { id: studentId },
        data: updatePayload,
      });
    } catch {}

    // Invalidate caches
    await invalidateStudentNamespace(schoolId, tierContext);
    safeRevalidatePath(`/[schoolDomain]/students`, "page");

    return {
      success: true,
      newStatus,
      student: updatedStudent,
    };
  } catch (error: any) {
    console.error("[Server Action] toggleStudentSuspension error:", error);
    return { success: false, error: error.message || "Failed to toggle student suspension." };
  }
}

export type GraduateCohortResponse =
  | { success: true; count: number; targetClass: string }
  | { success: false; error: string };

/**
 * Safe transaction script batching all active (ENROLLED) students in the highest grade
 * of the active tier and transitioning their lifecycle status to ALUMNI.
 */
export async function graduateTierCohort(
  schoolId: string,
  tierName?: string,
  className?: string
): Promise<GraduateCohortResponse> {
  try {
    const tenantDb = await resolveDbForAction(schoolId, tierName);

    // 1. Resolve target classes & aliases
    let targetClasses: string[] = [];
    if (className && className !== "ALL") {
      const c = className.trim();
      targetClasses = [c];
      if (c.toLowerCase().startsWith("class ")) {
        targetClasses.push(c.replace(/class\s+/i, "Primary "));
        targetClasses.push(c.replace(/class\s+/i, "Basic "));
      } else if (c.toLowerCase().startsWith("primary ")) {
        targetClasses.push(c.replace(/primary\s+/i, "Class "));
      }
    } else {
      // Automatically determine the highest grade of the active tier
      const t = (tierName || "").toLowerCase();
      if (t.includes("nursery") || t.includes("daycare") || t.includes("creche") || t.includes("early")) {
        targetClasses = ["Nursery 2", "Pre-Nursery", "Creche"];
      } else if (t.includes("secondary") || t.includes("high") || t.includes("senior") || t.includes("college")) {
        targetClasses = ["SSS 3", "SS 3", "Grade 12"];
      } else {
        // Primary default: Class 6 / Primary 6 / Basic 6
        targetClasses = ["Class 6", "Primary 6", "Basic 6"];
      }
    }

    // 2. Safe transaction script: batches all active ('ENROLLED') students in the highest grade
    return await tenantDb.$transaction(async (tx) => {
      const orConditions = targetClasses.flatMap((cls) => [
        { currentClass: { equals: cls, mode: "insensitive" as const } },
        { currentClass: { startsWith: cls, mode: "insensitive" as const } },
      ]);

      const result = await tx.student.updateMany({
        where: {
          schoolId,
          status: "ENROLLED",
          OR: orConditions,
        },
        data: {
          status: "ALUMNI",
          alumniAt: new Date(),
        },
      });

      // Synchronize with basePrisma if needed
      try {
        await basePrisma.student.updateMany({
          where: {
            schoolId,
            status: "ENROLLED",
            OR: orConditions,
          },
          data: {
            status: "ALUMNI",
            alumniAt: new Date(),
          },
        });
      } catch {}

      // Cache invalidation
      await invalidateStudentNamespace(schoolId, tierName);
      safeRevalidatePath(`/[schoolDomain]/students`, "page");

      return {
        success: true as const,
        count: result.count,
        targetClass: targetClasses[0],
      };
    });
  } catch (error: any) {
    console.error("[Server Action] Failed to graduate tier cohort:", error);
    return { success: false as const, error: error.message || "Failed to graduate cohort." };
  }
}

/**
 * Progression logic mapping active academic grade to the next class or graduation.
 */
export async function getNextGrade(
  currentClass?: string | null,
  tierName?: string
): Promise<{ nextClass: string | null; isGraduation: boolean }> {
  if (!currentClass) return { nextClass: null, isGraduation: false };

  const c = currentClass.trim();
  const cLower = c.toLowerCase();
  const tLower = (tierName || "").toLowerCase();

  // 1. Secondary School Tier:
  // JSS 1 ➔ JSS 2 ➔ JSS 3 ➔ SSS 1 ➔ SSS 2 ➔ SSS 3 ➔ Alumni
  if (
    tLower.includes("secondary") ||
    tLower.includes("high") ||
    tLower.includes("senior") ||
    tLower.includes("college") ||
    cLower.includes("jss") ||
    cLower.includes("sss") ||
    cLower.startsWith("js ") ||
    cLower.startsWith("ss ")
  ) {
    // SSS 3 / SS 3 / Grade 12 (Terminal Graduation)
    if (/s{1,3}\s*3/i.test(c) || /grade\s*12/i.test(c) || /year\s*12/i.test(c)) {
      return { nextClass: null, isGraduation: true };
    }
    // SSS 2 -> SSS 3
    if (/s{1,3}\s*2/i.test(c)) {
      return { nextClass: c.replace(/([sS]{1,3}\s*)2/i, "$13"), isGraduation: false };
    }
    // SSS 1 -> SSS 2
    if (/s{1,3}\s*1/i.test(c)) {
      return { nextClass: c.replace(/([sS]{1,3}\s*)1/i, "$12"), isGraduation: false };
    }
    // JSS 3 -> SSS 1
    if (/j\s*s{1,2}\s*3/i.test(c) || /grade\s*9/i.test(c)) {
      return { nextClass: c.replace(/j\s*s{1,2}\s*3/i, "SSS 1").replace(/grade\s*9/i, "Grade 10"), isGraduation: false };
    }
    // JSS 2 -> JSS 3
    if (/j\s*s{1,2}\s*2/i.test(c) || /grade\s*8/i.test(c)) {
      return { nextClass: c.replace(/([jJ]\s*[sS]{1,2}\s*)2/i, "$13").replace(/grade\s*8/i, "Grade 9"), isGraduation: false };
    }
    // JSS 1 -> JSS 2
    if (/j\s*s{1,2}\s*1/i.test(c) || /grade\s*7/i.test(c)) {
      return { nextClass: c.replace(/([jJ]\s*[sS]{1,2}\s*)1/i, "$12").replace(/grade\s*7/i, "Grade 8"), isGraduation: false };
    }
  }

  // 2. Daycare / Nursery Tier:
  // Creche ➔ Pre-Nursery ➔ Nursery 1 ➔ Nursery 2 ➔ Alumni
  if (
    tLower.includes("nursery") ||
    tLower.includes("daycare") ||
    tLower.includes("creche") ||
    tLower.includes("early") ||
    cLower.includes("nursery") ||
    cLower.includes("creche")
  ) {
    if (/nursery\s*2/i.test(c) || /kg\s*2/i.test(c)) {
      return { nextClass: null, isGraduation: true };
    }
    if (/nursery\s*1/i.test(c) || /kg\s*1/i.test(c)) {
      return { nextClass: c.replace(/1/, "2"), isGraduation: false };
    }
    if (/pre[- ]?nursery/i.test(c)) {
      return { nextClass: "Nursery 1", isGraduation: false };
    }
    if (/creche/i.test(c)) {
      return { nextClass: "Pre-Nursery", isGraduation: false };
    }
  }

  // 3. Primary School Tier:
  // Primary 1 ➔ Primary 2 ➔ Primary 3 ➔ Primary 4 ➔ Primary 5 ➔ Primary 6 ➔ Alumni
  // Also supports Class 1-6 and Basic 1-6
  if (/(\bprimary|\bclass|\bbasic|\bgrade|\byear)\s*6/i.test(c)) {
    return { nextClass: null, isGraduation: true };
  }
  if (/(\bprimary|\bclass|\bbasic|\bgrade|\byear)\s*5/i.test(c)) {
    return { nextClass: c.replace(/([0-9]+)/, "6"), isGraduation: false };
  }
  if (/(\bprimary|\bclass|\bbasic|\bgrade|\byear)\s*4/i.test(c)) {
    return { nextClass: c.replace(/([0-9]+)/, "5"), isGraduation: false };
  }
  if (/(\bprimary|\bclass|\bbasic|\bgrade|\byear)\s*3/i.test(c)) {
    return { nextClass: c.replace(/([0-9]+)/, "4"), isGraduation: false };
  }
  if (/(\bprimary|\bclass|\bbasic|\bgrade|\byear)\s*2/i.test(c)) {
    return { nextClass: c.replace(/([0-9]+)/, "3"), isGraduation: false };
  }
  if (/(\bprimary|\bclass|\bbasic|\bgrade|\byear)\s*1/i.test(c)) {
    return { nextClass: c.replace(/([0-9]+)/, "2"), isGraduation: false };
  }

  return { nextClass: null, isGraduation: false };
}

export interface TermEndPromotionParams {
  tierName?: string;
  repeatingStudentIds?: string[];
}

export interface TermEndPromotionResponse {
  success: boolean;
  promotedCount: number;
  graduatedCount: number;
  repeatedCount: number;
  tierName: string;
  summary: Array<{ fromClass: string; toClass: string; count: number }>;
  error?: string;
}

/**
 * Automated Promotion / Term-End Processing script:
 * Handles mass-moving students to the next class grade, graduating the terminal cohort,
 * clearing active class slots for alumni, respecting repeater exceptions, and purging caches.
 */
export async function executeTermEndPromotionAction(
  schoolId: string,
  payload: TermEndPromotionParams
): Promise<TermEndPromotionResponse> {
  const tierName = payload.tierName || "Primary School";
  const repeatingIds = new Set(payload.repeatingStudentIds || []);

  try {
    const tenantDb = await resolveDbForAction(schoolId, tierName);

    const result = await tenantDb.$transaction(
      async (tx) => {
        // 1. Fetch all active ENROLLED students in this tier
        const enrolledStudents = await tx.student.findMany({
          where: {
            schoolId,
            status: "ENROLLED",
          },
          select: {
            id: true,
            currentClass: true,
            firstName: true,
            lastName: true,
          },
        });

        const toGraduate: typeof enrolledStudents = [];
        const promotionGroups: Map<string, { fromClass: string; toClass: string; studentIds: string[] }> = new Map();
        let repeatedCount = 0;

        for (const student of enrolledStudents) {
          // Academic Exceptions (Failures/Repeats check)
          if (repeatingIds.has(student.id)) {
            repeatedCount++;
            continue;
          }

          const { nextClass, isGraduation } = await getNextGrade(student.currentClass, tierName);

          if (isGraduation) {
            toGraduate.push(student);
          } else if (nextClass) {
            const key = `${student.currentClass || "Unknown"}->${nextClass}`;
            if (!promotionGroups.has(key)) {
              promotionGroups.set(key, {
                fromClass: student.currentClass || "Unknown",
                toClass: nextClass,
                studentIds: [],
              });
            }
            promotionGroups.get(key)!.studentIds.push(student.id);
          }
        }

        const now = new Date();
        let graduatedCount = 0;
        const gradIds = toGraduate.map((s) => s.id);

        // 2. Highest Grade Tier Graduation:
        // Transition lifecycle status flag from 'Enrolled' to 'Alumni'.
        // Clear their active class slot so they don't clog up next term's active class lists.
        if (gradIds.length > 0) {
          const gradResult = await tx.student.updateMany({
            where: { id: { in: gradIds } },
            data: {
              status: "ALUMNI",
              alumniAt: now,
              currentClass: null,
            },
          });
          graduatedCount = gradResult.count;
        }

        // 3. Batch Promotion: Execute bulk updates grouped by target class in parallel
        const groupsList = Array.from(promotionGroups.values());
        let promotedCount = 0;
        const summary: Array<{ fromClass: string; toClass: string; count: number }> = [];

        // Parallelize bulk updates across target classes within the transaction
        const updatePromises = groupsList.map(async (group) => {
          const updateRes = await tx.student.updateMany({
            where: { id: { in: group.studentIds } },
            data: {
              currentClass: group.toClass,
            },
          });
          return {
            fromClass: group.fromClass,
            toClass: group.toClass,
            count: updateRes.count,
          };
        });

        const updateResults = await Promise.all(updatePromises);
        for (const res of updateResults) {
          promotedCount += res.count;
          summary.push(res);
        }

        return {
          promotedCount,
          graduatedCount,
          repeatedCount,
          summary,
          gradIds,
          groupsList,
          now,
        };
      },
      {
        maxWait: 5000, // Time to acquire a connection
        timeout: 30000, // Extended time window to execute queries safely
      }
    );

    // 4. Mirror updates to central basePrisma asynchronously outside the tenantDb transaction
    try {
      const mirrorPromises: Promise<any>[] = [];
      if (result.gradIds.length > 0) {
        mirrorPromises.push(
          basePrisma.student.updateMany({
            where: { id: { in: result.gradIds } },
            data: {
              status: "ALUMNI",
              alumniAt: result.now,
              currentClass: null,
            },
          })
        );
      }
      for (const group of result.groupsList) {
        mirrorPromises.push(
          basePrisma.student.updateMany({
            where: { id: { in: group.studentIds } },
            data: {
              currentClass: group.toClass,
            },
          })
        );
      }
      if (mirrorPromises.length > 0) {
        await Promise.all(mirrorPromises);
      }
    } catch (mirrorErr) {
      console.warn("[Server Action] Central mirror update warning:", mirrorErr);
    }

    // 5. Wipe System Performance Cache & Revalidate
    try {
      await invalidateStudentNamespace(schoolId, tierName);
      safeRevalidatePath("/[schoolDomain]/students", "page");
    } catch (cacheErr) {
      console.warn("[Server Action] Cache invalidation warning:", cacheErr);
    }

    return {
      success: true,
      promotedCount: result.promotedCount,
      graduatedCount: result.graduatedCount,
      repeatedCount: result.repeatedCount,
      tierName,
      summary: result.summary,
    };
  } catch (error: any) {
    console.error("[Server Action] Failed to execute term-end promotion:", error);
    return {
      success: false,
      promotedCount: 0,
      graduatedCount: 0,
      repeatedCount: 0,
      tierName,
      summary: [],
      error: error.message || "Failed to execute term-end promotion.",
    };
  }
}
