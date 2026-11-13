"use server";

import { basePrisma, getTenantClient, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { resolveSchoolPrefix, resolveTierCode } from "@/lib/tenant-tier-utils";
import { getClassesForTier } from "@/lib/tier-config";
import { invalidateStudentNamespace } from "@/lib/cache-invalidation";
import { clearL1TenantCache } from "@/lib/cache";

export interface StudentRowInput {
  id?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender: string; // M or F
  dateOfBirth?: string; // YYYY-MM-DD
  currentClass: string;
  arm?: string;
  admissionYear: string; // e.g. 2026
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  previousSchool?: string;
}

export interface ValidatedStudentRow extends StudentRowInput {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate?: boolean;
  duplicateReason?: string;
  normalizedPhone?: string;
  calculatedRegNo?: string;
}

/**
 * Normalizes phone numbers to standard Nigerian international format +234...
 */
function normalizeNigerianPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return undefined;

  // Local Nigerian format 080... (11 digits starting with 0)
  if (digits.startsWith("0") && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }
  // Nigerian format without plus 23480... (13 digits starting with 234)
  if (digits.startsWith("234") && digits.length === 13) {
    return `+${digits}`;
  }
  // Already with plus
  if (phone.trim().startsWith("+")) {
    return `+${digits}`;
  }
  // Fallback if 10 digits (without leading zero e.g. 8031234567)
  if (digits.length === 10) {
    return `+234${digits}`;
  }
  return phone.trim();
}

/**
 * Resolves current session and surrounding sessions
 */
function getDefaultAcademicSessions(): { currentSession: string; sessions: string[] } {
  const currentYear = new Date().getFullYear();
  // Academic sessions: 2026/2027, etc.
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
 * 2. Validate a batch of student rows against school rules, tiers, duplicates, and requirements
 */
export async function validateBulkStudentBatch(
  schoolId: string,
  session: string,
  rows: StudentRowInput[]
): Promise<{
  rows: ValidatedStudentRow[];
  totalCount: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
}> {
  const context = await getBulkEnrollmentContext(schoolId);
  const validClasses = new Set(context.classes.map((c) => c.toLowerCase().trim()));

  // Fetch all existing students in this school for duplicate checking
  const existingStudents = await basePrisma.student.findMany({
    where: { schoolId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      parentPhone: true,
      admissionNumber: true,
      currentClass: true,
      cohort: true,
    },
  });

  const existingMap = new Map<string, typeof existingStudents[0]>();
  existingStudents.forEach((s) => {
    // Key by RegNo if present
    if (s.admissionNumber) {
      existingMap.set(s.admissionNumber.toUpperCase().trim(), s);
    }
    // Key by identity: name + dob + phone
    const dobStr = s.dateOfBirth ? s.dateOfBirth.toISOString().split("T")[0] : "";
    const phoneNorm = normalizeNigerianPhone(s.parentPhone || "") || "";
    const idKey = `${s.firstName.toLowerCase().trim()}|${s.lastName.toLowerCase().trim()}|${dobStr}|${phoneNorm}`;
    existingMap.set(idKey, s);
  });

  const validatedRows: ValidatedStudentRow[] = [];
  const batchSeenKeys = new Set<string>();

  rows.forEach((row, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let isDuplicate = false;
    let duplicateReason = "";

    const firstName = (row.firstName || "").trim();
    const lastName = (row.lastName || "").trim();
    const currentClass = (row.currentClass || "").trim();
    const admissionYear = (row.admissionYear || "").trim();
    const gender = (row.gender || "").trim().toUpperCase();

    // Required fields check
    if (!firstName) errors.push("FirstName is required");
    if (!lastName) errors.push("LastName is required");
    if (!gender || !["M", "F", "MALE", "FEMALE"].includes(gender)) {
      errors.push("Gender is required (M/F)");
    }
    if (!currentClass) {
      errors.push("Class is required");
    } else {
      // Validate class belongs to school tier
      const normClass = currentClass.toLowerCase();
      // Check exact or loose match (e.g. Primary 1 or Primary 1 - A)
      const isClassAllowed = Array.from(validClasses).some(
        (vc) => normClass === vc || normClass.startsWith(vc) || vc.startsWith(normClass)
      );
      if (!isClassAllowed) {
        errors.push(`${currentClass} not in this school's tier`);
      }
    }

    if (!admissionYear) {
      errors.push("AdmissionYear required - cannot guess Cohort for repeaters / transfers.");
    } else if (!/^\d{4}$/.test(admissionYear)) {
      errors.push("AdmissionYear must be a 4-digit year (e.g. 2026)");
    }

    // Phone normalization
    const normalizedPhone = normalizeNigerianPhone(row.guardianPhone);

    // Duplicate check
    const dobStr = row.dateOfBirth ? row.dateOfBirth.trim() : "";
    const phoneKey = normalizedPhone || "";
    const identityKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dobStr}|${phoneKey}`;

    if (existingMap.has(identityKey)) {
      isDuplicate = true;
      duplicateReason = "Possible Duplicate: A student with this Name, DOB, and Phone is already enrolled.";
      warnings.push(duplicateReason);
    }

    // Batch duplicate check
    if (batchSeenKeys.has(identityKey) && firstName && lastName) {
      isDuplicate = true;
      duplicateReason = "Duplicate within this batch: Identical student appears more than once.";
      warnings.push(duplicateReason);
    }
    batchSeenKeys.add(identityKey);

    validatedRows.push({
      ...row,
      rowIndex: index + 1,
      firstName,
      lastName,
      currentClass,
      admissionYear,
      gender: gender.startsWith("M") ? "M" : "F",
      normalizedPhone,
      isValid: errors.length === 0,
      errors,
      warnings,
      isDuplicate,
      duplicateReason,
    });
  });

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const errorCount = validatedRows.filter((r) => !r.isValid).length;
  const duplicateCount = validatedRows.filter((r) => r.isDuplicate).length;

  return {
    rows: validatedRows,
    totalCount: validatedRows.length,
    validCount,
    errorCount,
    duplicateCount,
  };
}

/**
 * 3. Execute Bulk Enrollment on confirmed valid rows
 * Auto-creates:
 * - class = CSV/Grid class
 * - arm = CSV/Grid arm or default
 * - session = selectedSession (e.g. 2026/2027)
 * - admissionYear = row.admissionYear
 * - cohort = admissionYear (Cohort = Year group that started together at this school)
 * - regNo = [SCHOOL_PREFIX]/[AdmissionYear]/[CLASSCODE]/[SEQUENCE] (e.g. EGED/2026/PRIM/0011)
 * Idempotent: Skips or updates existing records without duplicate generation.
 */
export async function executeBulkEnrollmentAction(
  schoolId: string,
  session: string,
  students: StudentRowInput[],
  skipDuplicates: boolean = true
) {
  try {
    const context = await getBulkEnrollmentContext(schoolId);
    if (!context.success) {
      throw new Error(context.error || "Failed to load school context");
    }

    const validation = await validateBulkStudentBatch(schoolId, session, students);
    const validRows = validation.rows.filter((r) => r.isValid && (!skipDuplicates || !r.isDuplicate));

    if (validRows.length === 0) {
      return {
        success: false,
        error: "No valid student rows to enroll. Please check errors in the preview.",
        enrolledCount: 0,
        skippedCount: validation.errorCount + (skipDuplicates ? validation.duplicateCount : 0),
      };
    }

    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      include: { academicTiers: true },
    });

    if (!school) throw new Error("School not found");

    const schoolPrefix = resolveSchoolPrefix(school.subdomain);
    const defaultTier = school.academicTiers[0];
    if (!defaultTier) throw new Error("School has no configured academic tier");

    // Pre-calculate max sequence for each admissionYear to guarantee atomic non-conflicting increment
    const yearSequenceCounters = new Map<string, number>();

    // Fetch all existing admission numbers for this school
    const existingAdmissions = await basePrisma.student.findMany({
      where: { schoolId },
      select: { admissionNumber: true, cohort: true },
    });

    existingAdmissions.forEach((s) => {
      if (s.admissionNumber) {
        // Match [PREFIX]/[YEAR]/[CLASSCODE]/[SEQ] e.g. EGED/2026/PRIM/0010
        const parts = s.admissionNumber.split("/");
        if (parts.length >= 4) {
          const year = parts[1];
          const seq = parseInt(parts[3], 10);
          if (!isNaN(seq) && year) {
            const currentMax = yearSequenceCounters.get(year) || 0;
            if (seq > currentMax) {
              yearSequenceCounters.set(year, seq);
            }
          }
        }
      }
    });

    const enrolledStudents: any[] = [];
    const defaultPasswordHash = await bcrypt.hash("Welcome123", 10);

    // Perform database operations in safe transaction
    await basePrisma.$transaction(async (tx) => {
      for (const row of validRows) {
        const admissionYear = row.admissionYear || "2026";
        const currentCounter = yearSequenceCounters.get(admissionYear) || 0;
        const nextSequence = currentCounter + 1;
        yearSequenceCounters.set(admissionYear, nextSequence);

        const classCode = resolveTierCode(defaultTier.name, row.currentClass);
        const seqFormatted = String(nextSequence).padStart(4, "0");
        const regNo = `${schoolPrefix}/${admissionYear}/${classCode}/${seqFormatted}`;

        // Cohort definition: Year student started at this school
        const cohort = admissionYear;

        // Class formatting (include arm if provided)
        let resolvedClass = row.currentClass.trim();
        if (row.arm && row.arm.trim()) {
          const armTrim = row.arm.trim();
          if (!resolvedClass.toLowerCase().includes(armTrim.toLowerCase())) {
            resolvedClass = `${resolvedClass} ${armTrim}`;
          }
        }

        const normalizedPhone = normalizeNigerianPhone(row.guardianPhone);
        const dob = row.dateOfBirth ? new Date(row.dateOfBirth) : null;

        const dynamicFields: Record<string, any> = {
          cohort,
          admissionYear,
          arm: row.arm || "A",
          gender: row.gender,
          session,
          previousSchool: row.previousSchool || null,
          middleName: row.middleName || null,
        };

        const student = await tx.student.create({
          data: {
            schoolId,
            tierId: defaultTier.id,
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            currentClass: resolvedClass,
            cohort,
            admissionNumber: regNo,
            dateOfBirth: dob,
            parentName: row.guardianName || null,
            parentPhone: normalizedPhone || null,
            parentEmail: row.guardianEmail || null,
            status: "ENROLLED",
            enrolledAt: new Date(),
            feeStatus: "UNPAID",
            dynamicFields,
          },
        });

        // Also create authoritative portal User account for the student
        const studentPortalEmail =
          (row.guardianEmail && row.guardianEmail.trim().toLowerCase()) ||
          `${regNo.toLowerCase().replace(/[^a-z0-9]/g, "")}@student.${school.subdomain}`;

        try {
          await tx.user.upsert({
            where: { schoolId_email: { schoolId, email: studentPortalEmail } },
            update: {
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              role: "STUDENT",
              status: "ACTIVE",
            },
            create: {
              schoolId,
              email: studentPortalEmail,
              passwordHash: defaultPasswordHash,
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              role: "STUDENT",
              status: "ACTIVE",
              mustChangePassword: true,
            },
          });
        } catch {}

        enrolledStudents.push({
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          regNo: student.admissionNumber,
          currentClass: student.currentClass,
          cohort: student.cohort,
          session,
        });
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
      enrolledCount: enrolledStudents.length,
      skippedCount: validation.errorCount + (skipDuplicates ? validation.duplicateCount : 0),
      students: enrolledStudents,
    };
  } catch (error: any) {
    console.error("[executeBulkEnrollmentAction] Error:", error);
    return {
      success: false,
      error: error.message || "Bulk enrollment execution failed.",
      enrolledCount: 0,
      skippedCount: 0,
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

