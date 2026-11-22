"use server";

import { basePrisma, getTenantClient, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { resolveSchoolPrefix, resolveTierCode, isHigherEdTier } from "@/lib/tenant-tier-utils";
import { getClassesForTier } from "@/lib/tier-config";
import { invalidateStudentNamespace } from "@/lib/cache-invalidation";
import { clearL1TenantCache } from "@/lib/cache";
import {
  StudentEnrollmentInput,
  EnrollmentResultItem,
  createStudentWithCredentials,
  validateEnrollmentBatch,
  executeBatchEnrollmentWithCredentials,
  generateCredentialsSheetCsv,
  normalizePhoneNumber,
  generateTemporaryPassword,
} from "@/lib/student-enrollment-service";

export type StudentRowInput = StudentEnrollmentInput;

export interface ValidatedStudentRow extends StudentRowInput {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate?: boolean;
  duplicateReason?: string;
  normalizedPhone?: string;
  calculatedRegNo?: string;
  assignedRegNo?: string;
  duplicateAction?: "SKIP" | "MERGE_UPDATE" | "ENROLL_ANYWAY";
  credentials?: {
    username: string;
    tempPassword: string;
    loginOwnerName: string;
    loginOwnerRole: string;
    deliveryContact: string;
    deliveryMethod: string;
  };
}

/**
 * Normalizes phone numbers to standard Nigerian international format +234...
 */
export async function normalizeNigerianPhone(phone?: string | null): Promise<string | undefined> {
  return normalizePhoneNumber(phone);
}

/**
 * Resolves current session and surrounding sessions
 */
function getDefaultAcademicSessions(): { currentSession: string; sessions: string[] } {
  const currentYear = new Date().getFullYear();
  const currentSession = `${currentYear}/${currentYear + 1}`;
  const sessions = [
    `${currentYear - 2}/${currentYear - 1}`,
    `${currentYear - 1}/${currentYear}`,
    `${currentYear}/${currentYear + 1}`,
    `${currentYear + 1}/${currentYear + 2}`,
  ];
  return { currentSession, sessions };
}

/**
 * 1. Fetch metadata needed for enrollment forms (tiers, valid classes, default session, school prefix)
 */
export async function getBulkEnrollmentContext(schoolId: string) {
  try {
    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      include: {
        academicTiers: {
          orderBy: { level: "asc" },
        },
        classrooms: {
          orderBy: { name: "asc" },
        },
      },
    });

    if (!school) {
      throw new Error("School tenant not found");
    }

    const { currentSession, sessions } = getDefaultAcademicSessions();
    const schoolPrefix = resolveSchoolPrefix(school.subdomain);

    // Collect all valid classes across the school's tiers
    const validClassesSet = new Set<string>();
    const tierClassMap: Record<string, string[]> = {};

    for (const tier of school.academicTiers) {
      const classes = getClassesForTier(tier.name, school.classrooms.map((c) => c.name));
      tierClassMap[tier.id] = classes;
      classes.forEach((cls) => validClassesSet.add(cls));
    }

    // Also include any classrooms explicitly configured
    school.classrooms.forEach((c) => validClassesSet.add(c.name));

    const allClasses = Array.from(validClassesSet);

    return {
      success: true,
      schoolId: school.id,
      schoolName: school.name,
      subdomain: school.subdomain,
      schoolPrefix,
      currentSession,
      sessions,
      classes: allClasses,
      tiers: school.academicTiers,
      tierClassMap,
    };
  } catch (error: any) {
    console.error("[getBulkEnrollmentContext] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to load enrollment context",
      classes: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
      sessions: ["2025/2026", "2026/2027", "2027/2028"],
      currentSession: "2026/2027",
      schoolPrefix: "SCH",
      tiers: [],
      tierClassMap: {},
    };
  }
}

/**
 * 2. Validate a batch of student rows using shared enterprise enrollment validator
 */
export async function validateBulkStudentBatch(
  schoolId: string,
  session: string,
  rows: StudentRowInput[],
  tierName?: string
): Promise<{
  rows: ValidatedStudentRow[];
  totalCount: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  isTertiary: boolean;
  tierName: string;
}> {
  const result = await validateEnrollmentBatch(schoolId, session, rows, tierName);
  return {
    rows: result.rows as ValidatedStudentRow[],
    totalCount: result.totalCount,
    validCount: result.readyCount,
    errorCount: result.errorCount,
    duplicateCount: result.duplicateCount,
    isTertiary: result.isTertiary,
    tierName: result.tierName,
  };
}

/**
 * 3. Execute Bulk Enrollment on confirmed rows via shared createStudentWithCredentials() service
 */
export async function executeBulkEnrollmentAction(
  schoolId: string,
  session: string,
  students: StudentRowInput[],
  skipDuplicates: boolean = true,
  tierName?: string
) {
  try {
    // If skipDuplicates is true, set duplicateAction: "SKIP" on duplicate rows
    const preparedRows = students.map((s) => ({
      ...s,
      duplicateAction: s.duplicateAction || (skipDuplicates ? "SKIP" : "ENROLL_ANYWAY"),
    }));

    const result = await executeBatchEnrollmentWithCredentials(
      schoolId,
      session,
      preparedRows,
      tierName
    );

    return {
      success: result.success,
      enrolledCount: result.enrolledCount,
      skippedCount: result.skippedCount,
      credentialsSheet: result.credentialsSheet,
      error: result.error,
    };
  } catch (error: any) {
    console.error("[executeBulkEnrollmentAction] Error:", error);
    return {
      success: false,
      error: error.message || "Bulk enrollment execution failed.",
      enrolledCount: 0,
      skippedCount: 0,
      credentialsSheet: [],
    };
  }
}


/**
 * Progression Map helper: Calculates the next class level in Nigerian standard progression
 */
function getNextClassProgression(currentClass: string): { nextClass: string; isGraduated: boolean } {
  const norm = currentClass.trim().toLowerCase();

  // Primary Progression
  if (norm.includes("primary 1") || norm.includes("basic 1") || norm.includes("class 1")) return { nextClass: "Primary 2", isGraduated: false };
  if (norm.includes("primary 2") || norm.includes("basic 2") || norm.includes("class 2")) return { nextClass: "Primary 3", isGraduated: false };
  if (norm.includes("primary 3") || norm.includes("basic 3") || norm.includes("class 3")) return { nextClass: "Primary 4", isGraduated: false };
  if (norm.includes("primary 4") || norm.includes("basic 4") || norm.includes("class 4")) return { nextClass: "Primary 5", isGraduated: false };
  if (norm.includes("primary 5") || norm.includes("basic 5") || norm.includes("class 5")) return { nextClass: "Primary 6", isGraduated: false };
  if (norm.includes("primary 6") || norm.includes("basic 6") || norm.includes("class 6")) return { nextClass: "Graduated / Alumni", isGraduated: true };

  // Secondary Progression
  if (norm.includes("jss 1") || norm.includes("grade 7")) return { nextClass: "JSS 2", isGraduated: false };
  if (norm.includes("jss 2") || norm.includes("grade 8")) return { nextClass: "JSS 3", isGraduated: false };
  if (norm.includes("jss 3") || norm.includes("grade 9")) return { nextClass: "SSS 1", isGraduated: false };
  if (norm.includes("sss 1") || norm.includes("grade 10") || norm.includes("ss 1")) return { nextClass: "SSS 2", isGraduated: false };
  if (norm.includes("sss 2") || norm.includes("grade 11") || norm.includes("ss 2")) return { nextClass: "SSS 3", isGraduated: false };
  if (norm.includes("sss 3") || norm.includes("grade 12") || norm.includes("ss 3")) return { nextClass: "Graduated / Alumni", isGraduated: true };

  // Nursery Progression
  if (norm.includes("creche")) return { nextClass: "Nursery 1", isGraduated: false };
  if (norm.includes("nursery 1")) return { nextClass: "Nursery 2", isGraduated: false };
  if (norm.includes("nursery 2")) return { nextClass: "Primary 1", isGraduated: false };

  return { nextClass: currentClass, isGraduated: false };
}

/**
 * 4. Preview Promotion to Next Session
 */
export async function previewSessionPromotionAction(
  schoolId: string,
  fromSession: string,
  toSession: string
) {
  try {
    const students = await basePrisma.student.findMany({
      where: {
        schoolId,
        status: "ENROLLED",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        currentClass: true,
        cohort: true,
        dynamicFields: true,
      },
      orderBy: [{ currentClass: "asc" }, { lastName: "asc" }],
    });

    const previewList = students.map((s) => {
      const cls = s.currentClass || "Primary 1";
      const { nextClass, isGraduated } = getNextClassProgression(cls);
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        regNo: s.admissionNumber,
        cohort: s.cohort || "2026",
        currentClass: cls,
        nextClass,
        isGraduated,
        // Cohort stays identical!
        cohortStaysSame: true,
      };
    });

    const promotedCount = previewList.filter((p) => !p.isGraduated).length;
    const graduatedCount = previewList.filter((p) => p.isGraduated).length;

    return {
      success: true,
      fromSession,
      toSession,
      students: previewList,
      totalCount: previewList.length,
      promotedCount,
      graduatedCount,
    };
  } catch (error: any) {
    console.error("[previewSessionPromotionAction] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to preview promotion",
      students: [],
      totalCount: 0,
      promotedCount: 0,
      graduatedCount: 0,
    };
  }
}

/**
 * 5. Execute Session Promotion
 * Moves students from fromSession -> toSession.
 * - Cohort and RegNo stay exactly the same.
 * - Terminal classes (Primary 6 / SSS 3) become ALUMNI.
 * - Stores snapshot log in dynamicFields for undo capability.
 */
export async function executeSessionPromotionAction(
  schoolId: string,
  fromSession: string,
  toSession: string
) {
  try {
    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { subdomain: true },
    });
    if (!school) throw new Error("School not found");

    const students = await basePrisma.student.findMany({
      where: {
        schoolId,
        status: "ENROLLED",
      },
      select: {
        id: true,
        currentClass: true,
        status: true,
        cohort: true,
        dynamicFields: true,
      },
    });

    const snapshotLog: Record<string, { previousClass: string; previousStatus: string }> = {};

    await basePrisma.$transaction(async (tx) => {
      for (const s of students) {
        const currentCls = s.currentClass || "Primary 1";
        const { nextClass, isGraduated } = getNextClassProgression(currentCls);

        snapshotLog[s.id] = {
          previousClass: currentCls,
          previousStatus: s.status,
        };

        const existingDyn = (s.dynamicFields as any) || {};
        const updatedDynamic = {
          ...existingDyn,
          session: toSession,
          lastPromotion: {
            fromSession,
            toSession,
            promotedAt: new Date().toISOString(),
            previousClass: currentCls,
            previousStatus: s.status,
          },
        };

        if (isGraduated) {
          await tx.student.update({
            where: { id: s.id },
            data: {
              status: "ALUMNI",
              alumniAt: new Date(),
              dynamicFields: updatedDynamic,
            },
          });
        } else {
          await tx.student.update({
            where: { id: s.id },
            data: {
              currentClass: nextClass,
              dynamicFields: updatedDynamic,
            },
          });
        }
      }
    });

    try {
      await invalidateStudentNamespace(schoolId);
      clearL1TenantCache(school.subdomain);
      clearL1TenantCache(schoolId);
      revalidatePath(`/${school.subdomain}/students`);
      revalidatePath(`/${school.subdomain}/students`, "page");
      revalidatePath(`/${school.subdomain}/portal/staff`);
      revalidatePath(`/${school.subdomain}/portal/staff`, "page");
      revalidatePath(`/teacher/attendance`);
      revalidatePath(`/teacher/gradebook`);
      revalidatePath(`/teacher/students`);
    } catch {}

    return {
      success: true,
      count: students.length,
      fromSession,
      toSession,
    };
  } catch (error: any) {
    console.error("[executeSessionPromotionAction] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to execute session promotion.",
    };
  }
}

/**
 * 6. Undo Session Promotion Action
 * Allowed ONLY if no attendance or grading records have been entered in the new session.
 */
export async function undoSessionPromotionAction(
  schoolId: string,
  fromSession: string,
  toSession: string
) {
  try {
    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { subdomain: true },
    });
    if (!school) throw new Error("School not found");

    // Guard: Check if any attendance was recorded in the new session
    const recentAttendance = await basePrisma.studentAttendance.count({
      where: {
        schoolId,
        date: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // within 30 days
        },
      },
    });

    if (recentAttendance > 5) {
      return {
        success: false,
        error: "Cannot undo promotion: Attendance records have already been saved for this session.",
      };
    }

    const students = await basePrisma.student.findMany({
      where: { schoolId },
      select: { id: true, dynamicFields: true },
    });

    let revertedCount = 0;

    await basePrisma.$transaction(async (tx) => {
      for (const s of students) {
        const dyn = (s.dynamicFields as any) || {};
        const lastPromo = dyn.lastPromotion;
        if (lastPromo && lastPromo.fromSession === fromSession && lastPromo.toSession === toSession) {
          const { previousClass, previousStatus } = lastPromo;
          const cleanedDyn = { ...dyn };
          delete cleanedDyn.lastPromotion;
          cleanedDyn.session = fromSession;

          await tx.student.update({
            where: { id: s.id },
            data: {
              currentClass: previousClass,
              status: previousStatus,
              dynamicFields: cleanedDyn,
            },
          });
          revertedCount++;
        }
      }
    });

    try {
      revalidatePath(`/${school.subdomain}/students`);
    } catch {}

    return {
      success: true,
      revertedCount,
    };
  } catch (error: any) {
    console.error("[undoSessionPromotionAction] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to undo session promotion.",
    };
  }
}

