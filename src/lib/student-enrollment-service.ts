import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  generateAdmissionNumber,
  resolveSchoolPrefix,
  resolveTierCode,
  isHigherEdTier,
} from "@/lib/tenant-tier-utils";
import { logAuditEvent } from "@/lib/audit-logger";
import { invalidateStudentNamespace } from "@/lib/cache-invalidation";
import { clearL1TenantCache } from "@/lib/cache";
import { revalidatePath } from "next/cache";
import { sendStudentEnrollmentConfirmationEmail } from "@/lib/email-service";

/**
 * Detects if a phone value was corrupted into scientific notation by Excel (e.g. 8.03E+09, 8.06e+09)
 */
export function isScientificNotationOrCorruptedPhone(phone?: string | number | null): boolean {
  if (phone === undefined || phone === null) return false;
  const str = String(phone).trim();
  if (!str) return false;
  // Check for E+, e+, E-, e-, or number containing '.' and 'E' e.g. 8.03E+09
  if (/[eE][+-]?\d+/.test(str)) return true;
  if (str.includes(".") && /[eE]/i.test(str)) return true;
  return false;
}

/**
 * Parses flexible date inputs supporting DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, or Date instances.
 * Prevents V8 from misinterpreting DD/MM/YYYY as MM/DD/YYYY.
 */
export function parseFlexibleDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const str = String(val).trim();
  if (!str) return null;

  // DD/MM/YYYY or DD-MM-YYYY (e.g. 09/01/2018, 25/05/2019)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Normalizes phone numbers to standard Nigerian international format +234...
 * Automatically strips spaces/hyphens, prepends 0 if 10-digit, and strictly rejects scientific notation.
 */
export function normalizePhoneNumber(phone?: string | number | null): string | undefined {
  if (!phone) return undefined;
  const rawStr = String(phone).trim();
  if (!rawStr) return undefined;

  // Reject scientific notation
  if (isScientificNotationOrCorruptedPhone(rawStr)) {
    return undefined;
  }

  // Strip spaces, dashes, dots, parentheses, commas
  const cleaned = rawStr.replace(/[\s\-\(\)\.,]/g, "");
  const digits = cleaned.replace(/[^0-9]/g, "");
  if (!digits) return undefined;

  // 10 digits starting with 7, 8, or 9 (e.g. 8030000001, 8061112233) -> Prepend 0, convert to +234
  if (digits.length === 10 && /^[789]/.test(digits)) {
    return `+234${digits}`;
  }

  // 11 digits starting with 0 (e.g. 08030000001) -> Convert to +234
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+234${digits.slice(1)}`;
  }

  // 13 digits starting with 234 (e.g. 2348030000001) -> Convert to +234
  if (digits.length === 13 && digits.startsWith("234")) {
    return `+${digits}`;
  }

  // 14 chars starting with +234 (e.g. +2348030000001)
  if (cleaned.startsWith("+234") && digits.length === 13) {
    return `+${digits}`;
  }

  // If already with plus and at least 10 digits
  if (cleaned.startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }

  // Valid 11-digit local Nigerian number e.g. 0803...
  if (digits.length === 11 && /^0[789]\d{9}$/.test(digits)) {
    return `+234${digits.slice(1)}`;
  }

  return cleaned;
}

/**
 * Generates an alphanumeric temporary password that meets complexity requirements
 * (uppercase, lowercase, number, symbol, length >= 8)
 * e.g. "Eged2026!482"
 */
export function generateTemporaryPassword(schoolPrefix: string = "School", year: number = new Date().getFullYear()): string {
  const cleanPrefix = (schoolPrefix || "School").replace(/[^a-zA-Z]/g, "").slice(0, 4);
  const titleCasePrefix = cleanPrefix ? cleanPrefix.charAt(0).toUpperCase() + cleanPrefix.slice(1).toLowerCase() : "School";
  const randomDigits = Math.floor(100 + Math.random() * 900);
  return `${titleCasePrefix}${year}!${randomDigits}`;
}

export interface StudentEnrollmentInput {
  id?: string;
  tierId?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender: string; // "M" or "F"
  dateOfBirth?: string | Date | null;
  currentClass: string;
  arm?: string;
  admissionYear?: string;
  session?: string;
  admissionNumber?: string;
  status?: string;
  stateOfOrigin?: string;

  // Guardian profile (Required delivery channel for Creche/Primary/Secondary)
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelationship?: string;
  previousSchool?: string;

  // Tertiary direct student fields
  studentPhone?: string;
  studentEmail?: string;
  matricNo?: string;
  programme?: string;

  // Credentials & Delivery
  customPassword?: string;
  deliveryMethod?: "SMS" | "WHATSAPP" | "EMAIL" | "PRINT";
  adminUserId?: string;

  // Duplicate resolution
  duplicateAction?: "SKIP" | "MERGE_UPDATE" | "ENROLL_ANYWAY";
}

export interface EnrollmentResultItem {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  currentClass: string;
  cohort: string;
  session: string;
  tierName: string;
  isTertiary: boolean;
  loginOwner: "GUARDIAN" | "STUDENT";
  loginOwnerName: string;
  username: string; // The login username (phone, email, or admission/matric number)
  deliveryContact: string; // Phone or email
  deliveryMethod: "SMS" | "WHATSAPP" | "EMAIL" | "PRINT";
  tempPassword: string; // Unmasked for one-time sheet display
  parentRecordId?: string;
  actionTaken: "CREATED" | "UPDATED" | "SKIPPED";
}

/**
 * Core shared service: Enrolls a student and ensures login credentials are created
 * according to academic tier modality:
 * - K-12 (Creche/Primary/Secondary): Login Owner is GUARDIAN/PARENT. Pupil gets only Admission Number.
 *   Enforces at least ONE delivery channel (Guardian Phone or Guardian Email).
 * - Tertiary (University/Polytechnic/College): Login Owner is STUDENT.
 *   Enforces Student Phone + Student Email. Guardian fields are optional.
 */
export async function createStudentWithCredentials(
  schoolId: string,
  input: StudentEnrollmentInput,
  activeTierName?: string
): Promise<EnrollmentResultItem> {
  const school = await basePrisma.school.findUnique({
    where: { id: schoolId },
    include: { academicTiers: { orderBy: { level: "asc" } } },
  });

  if (!school) {
    throw new Error(`School tenant with ID ${schoolId} not found.`);
  }

  // 1. Resolve Tier & Hierarchy
  const resolvedTierName =
    activeTierName ||
    (school.academicTiers.length > 0 ? school.academicTiers[0].name : "Primary School");
  
  const isTertiary = isHigherEdTier(resolvedTierName) || school.tier === "TERTIARY";
  const tierObj = school.academicTiers.find((t) =>
    (input.tierId && t.id === input.tierId) ||
    t.name.toLowerCase() === resolvedTierName.toLowerCase() ||
    t.name.toLowerCase().includes(resolvedTierName.toLowerCase())
  ) || school.academicTiers[0];

  const tenantDb = await getPrismaClientForTier(schoolId, resolvedTierName);

  // 2. Normalize Names & Contacts
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const middleName = input.middleName?.trim() || "";
  const currentClass = input.currentClass.trim();
  const arm = input.arm?.trim() || "A";
  const gender = input.gender.toUpperCase().startsWith("F") ? "F" : "M";
  const currentYear = new Date().getFullYear();
  const admissionYear = input.admissionYear?.trim() || String(currentYear);
  const session = input.session?.trim() || `${admissionYear}/${parseInt(admissionYear, 10) + 1}`;
  const cohort = admissionYear;
  const deliveryMethod = input.deliveryMethod || "PRINT";

  const normGuardianPhone = normalizePhoneNumber(input.guardianPhone);
  const normGuardianEmail = input.guardianEmail?.trim().toLowerCase() || "";
  const guardianName = input.guardianName?.trim() || "Parent / Guardian";
  const guardianRelationship = input.guardianRelationship?.trim() || "Parent";

  const normStudentPhone = normalizePhoneNumber(input.studentPhone);
  const normStudentEmail = input.studentEmail?.trim().toLowerCase() || "";

  // 3. Tier-Aware Validation of Mandatory Delivery Channels
  if (!isTertiary) {
    // K-12: Guardian Phone OR Guardian Email is MANDATORY
    if (!normGuardianPhone && !normGuardianEmail) {
      throw new Error(
        `Delivery channel missing for ${firstName} ${lastName}: At least ONE Guardian Phone or Guardian Email is REQUIRED for Creche/Primary/Secondary enrollment.`
      );
    }
  } else {
    // Tertiary: Student Phone AND Student Email are MANDATORY
    if (!normStudentEmail || !normStudentEmail.includes("@")) {
      throw new Error(
        `Valid Student Email is required for Tertiary student login (${firstName} ${lastName}).`
      );
    }
    if (!normStudentPhone) {
      throw new Error(
        `Valid Student Phone number is required for Tertiary student portal activation (${firstName} ${lastName}).`
      );
    }
  }

  // 4. Resolve Admission Number / Matriculation Number
  let finalAdmissionNumber = input.admissionNumber?.trim() || input.matricNo?.trim();
  const schoolPrefix = resolveSchoolPrefix(school.subdomain);

  if (!finalAdmissionNumber) {
    // Pre-calculate next atomic sequence for this school + year
    const existingStudents = await tenantDb.student.findMany({
      where: { schoolId },
      select: { admissionNumber: true },
    }).catch(() => basePrisma.student.findMany({
      where: { schoolId },
      select: { admissionNumber: true },
    }));

    let maxSeq = 0;
    existingStudents.forEach((s) => {
      if (s.admissionNumber) {
        const parts = s.admissionNumber.split("/");
        if (parts.length >= 4 && parts[1] === admissionYear) {
          const num = parseInt(parts[3], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    const classCode = resolveTierCode(resolvedTierName, currentClass);
    finalAdmissionNumber = generateAdmissionNumber({
      schoolSubdomain: school.subdomain,
      tierName: resolvedTierName,
      currentClass,
      studentSequence: nextSeq,
      year: parseInt(admissionYear, 10),
    });
  }

  // 5. Generate Temporary Password
  const rawTempPassword = input.customPassword?.trim() || generateTemporaryPassword(schoolPrefix, parseInt(admissionYear, 10));
  const hashedPassword = await bcrypt.hash(rawTempPassword, 12);

  let loginOwner: "GUARDIAN" | "STUDENT" = isTertiary ? "STUDENT" : "GUARDIAN";
  let loginOwnerName = isTertiary ? `${firstName} ${lastName}` : guardianName;
  let username = "";
  let deliveryContact = "";
  let parentRecordId: string | undefined = undefined;

  // 6. Execute Account Provisioning based on Tier Mode
  let createdStudent: any = null;

  if (!isTertiary) {
    // =========================================================================
    // K-12 WORKFLOW: LOGIN GOES TO GUARDIAN/PARENT, NOT THE CHILD
    // =========================================================================
    // Always prioritize email/gmail as portal username; fall back to phone or admission number
    const preferredPortalEmail = normGuardianEmail || normStudentEmail;
    username = preferredPortalEmail || normGuardianPhone || finalAdmissionNumber || "";
    deliveryContact = preferredPortalEmail || normGuardianPhone || "";

    // Find or create Parent record
    let parentRecord = await basePrisma.parent.findFirst({
      where: {
        schoolId,
        OR: [
          ...(preferredPortalEmail ? [{ email: { equals: preferredPortalEmail, mode: "insensitive" as const } }] : []),
          ...(normGuardianPhone ? [{ phone: normGuardianPhone }] : []),
        ],
      },
    });

    const parentEmailToUse =
      preferredPortalEmail ||
      `${(normGuardianPhone || "guardian").replace(/[^0-9]/g, "")}@parent.${school.subdomain}`;

    if (!parentRecord) {
      parentRecord = await basePrisma.parent.create({
        data: {
          schoolId,
          name: guardianName,
          email: parentEmailToUse,
          phone: normGuardianPhone || null,
          passwordHash: hashedPassword,
          relationship: guardianRelationship,
          isActive: true,
        },
      });
    } else {
      // Update phone/password if previously missing
      await basePrisma.parent.update({
        where: { id: parentRecord.id },
        data: {
          phone: parentRecord.phone || normGuardianPhone || null,
          name: parentRecord.name === "Parent / Guardian" && guardianName !== "Parent / Guardian" ? guardianName : parentRecord.name,
        },
      }).catch(() => null);
    }
    parentRecordId = parentRecord.id;

    // Ensure Parent has an authoritative User record for portal authentication
    const parentNames = guardianName.split(" ");
    const parentFirstName = parentNames[0] || "Parent";
    const parentLastName = parentNames.slice(1).join(" ") || "Guardian";

    await basePrisma.user.upsert({
      where: {
        schoolId_email: { schoolId, email: parentEmailToUse },
      },
      update: {
        role: "PARENT",
        firstName: parentFirstName,
        lastName: parentLastName,
        passwordHash: hashedPassword,
        mustChangePassword: true,
        status: "ACTIVE",
      },
      create: {
        schoolId,
        email: parentEmailToUse,
        passwordHash: hashedPassword,
        role: "PARENT",
        firstName: parentFirstName,
        lastName: parentLastName,
        mustChangePassword: true,
        status: "ACTIVE",
      },
    });

    // Create the Student Record (without child login account)
    let resolvedClass = currentClass;
    if (arm && !resolvedClass.toLowerCase().includes(arm.toLowerCase())) {
      resolvedClass = `${resolvedClass} ${arm}`;
    }

    const dynamicFields = {
      cohort,
      admissionYear,
      arm,
      gender,
      session,
      previousSchool: input.previousSchool || null,
      middleName,
      credentialsIssuedTo: "GUARDIAN",
      credentialsIssuedAt: new Date().toISOString(),
      deliveryMethod,
      deliveryContact,
      loginUsername: username,
      tempPasswordIssued: rawTempPassword,
      deliveredBy: input.adminUserId || "ADMIN_ROSTER",
    };

    createdStudent = await tenantDb.student.create({
      data: {
        schoolId,
        tierId: tierObj ? tierObj.id : "default-tier",
        firstName,
        lastName,
        currentClass: resolvedClass,
        cohort,
        admissionNumber: finalAdmissionNumber,
        dateOfBirth: parseFlexibleDate(input.dateOfBirth),
        parentName: guardianName,
        parentPhone: normGuardianPhone || null,
        parentEmail: normGuardianEmail || null,
        status: input.status || "ENROLLED",
        enrolledAt: new Date(),
        feeStatus: "UNPAID",
        dynamicFields,
      },
    });

    // Link Parent to Student in StudentParent table
    await basePrisma.studentParent.upsert({
      where: {
        studentId_parentId: {
          studentId: createdStudent.id,
          parentId: parentRecord.id,
        },
      },
      create: {
        studentId: createdStudent.id,
        parentId: parentRecord.id,
        schoolId,
      },
      update: {},
    });

  } else {
    // =========================================================================
    // TERTIARY WORKFLOW: LOGIN GOES DIRECTLY TO THE STUDENT
    // =========================================================================
    // Prioritize student email/gmail for portal login credentials
    username = normStudentEmail || finalAdmissionNumber || normStudentPhone || "";
    deliveryContact = normStudentEmail || normStudentPhone || "";

    const studentPortalEmail = normStudentEmail;
    const studentUser = await basePrisma.user.upsert({
      where: {
        schoolId_email: { schoolId, email: studentPortalEmail },
      },
      update: {
        firstName,
        lastName,
        role: "STUDENT",
        passwordHash: hashedPassword,
        mustChangePassword: true,
        status: "ACTIVE",
      },
      create: {
        schoolId,
        email: studentPortalEmail,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role: "STUDENT",
        mustChangePassword: true,
        status: "ACTIVE",
      },
    });

    let resolvedClass = currentClass;
    if (input.programme && !resolvedClass.includes(input.programme)) {
      resolvedClass = `${input.programme} - ${currentClass}`;
    }

    const dynamicFields = {
      cohort,
      admissionYear,
      arm,
      gender,
      session,
      programme: input.programme || null,
      matricNo: finalAdmissionNumber,
      studentPhone: normStudentPhone,
      studentEmail: normStudentEmail,
      previousSchool: input.previousSchool || null,
      middleName,
      credentialsIssuedTo: "STUDENT",
      credentialsIssuedAt: new Date().toISOString(),
      deliveryMethod,
      deliveryContact,
      loginUsername: username,
      tempPasswordIssued: rawTempPassword,
      deliveredBy: input.adminUserId || "ADMIN_ROSTER",
    };

    const existingStudentByUser = await tenantDb.student.findUnique({
      where: { userId: studentUser.id },
    });

    if (existingStudentByUser) {
      createdStudent = await tenantDb.student.update({
        where: { id: existingStudentByUser.id },
        data: {
          tierId: tierObj ? tierObj.id : "default-tier",
          firstName,
          lastName,
          email: studentPortalEmail,
          currentClass: resolvedClass,
          cohort,
          admissionNumber: finalAdmissionNumber,
          dateOfBirth: parseFlexibleDate(input.dateOfBirth),
          parentName: guardianName !== "Parent / Guardian" ? guardianName : null,
          parentPhone: normGuardianPhone || null,
          parentEmail: normGuardianEmail || null,
          status: input.status || "ENROLLED",
          enrolledAt: new Date(),
          dynamicFields,
        },
      });
    } else {
      createdStudent = await tenantDb.student.create({
        data: {
          schoolId,
          userId: studentUser.id,
          tierId: tierObj ? tierObj.id : "default-tier",
          firstName,
          lastName,
          email: studentPortalEmail,
          currentClass: resolvedClass,
          cohort,
          admissionNumber: finalAdmissionNumber,
          dateOfBirth: parseFlexibleDate(input.dateOfBirth),
          parentName: guardianName !== "Parent / Guardian" ? guardianName : null,
          parentPhone: normGuardianPhone || null,
          parentEmail: normGuardianEmail || null,
          status: input.status || "ENROLLED",
          enrolledAt: new Date(),
          feeStatus: "UNPAID",
          dynamicFields,
        },
      });
    }
  }

  // 7. Audit Logging
  await logAuditEvent({
    actorId: input.adminUserId || "ADMIN",
    action: "STUDENT_ENROLLMENT_WITH_CREDENTIALS",
    target: `${firstName} ${lastName} (${finalAdmissionNumber})`,
    schoolId,
    metadata: {
      admissionNumber: finalAdmissionNumber,
      tierName: resolvedTierName,
      loginOwner,
      username,
      deliveryMethod,
      deliveryContact,
      enrolledAt: new Date().toISOString(),
    },
  }).catch(() => null);

  // 8. Automated Email Dispatch (Enrollment Confirmation & Credentials Notification)
  const recipientEmail = normGuardianEmail || normStudentEmail;
  if (recipientEmail) {
    try {
      // Ensure the dispatched portal username is the email / gmail address whenever available
      const portalUsername = normGuardianEmail || normStudentEmail || username;

      await sendStudentEnrollmentConfirmationEmail({
        schoolId,
        studentId: createdStudent.id,
        studentName: `${firstName} ${lastName}`,
        admissionNumber: finalAdmissionNumber,
        currentClass: createdStudent.currentClass,
        tierName: resolvedTierName,
        studentEmail: normStudentEmail || null,
        parentEmail: normGuardianEmail || null,
        parentName: guardianName !== "Parent / Guardian" ? guardianName : undefined,
        parentPhone: normGuardianPhone || null,
        username: portalUsername,
        loginOwner,
        temporaryPassword: rawTempPassword,
        schoolName: school.name,
        subdomain: school.subdomain,
      });
    } catch (emailErr) {
      console.warn("[STUDENT_ENROLLMENT_EMAIL_WARN]: Could not dispatch enrollment confirmation email:", emailErr);
    }
  }

  // 9. Write-Through Cache Invalidation & Path Revalidation
  try {
    await invalidateStudentNamespace(schoolId, resolvedTierName);
    clearL1TenantCache(schoolId);
    if (school.subdomain) {
      clearL1TenantCache(school.subdomain);
      try {
        revalidatePath(`/${school.subdomain}/students`);
        revalidatePath(`/${school.subdomain}/students`, "page");
        revalidatePath(`/${school.subdomain}/students`, "layout");
        revalidatePath(`/${school.subdomain}/portal/staff`);
        revalidatePath(`/teacher/students`);
      } catch {}
    }
    try {
      revalidatePath(`/[schoolDomain]/students`, "page");
      revalidatePath(`/[schoolDomain]/students`, "layout");
    } catch {}
  } catch (cacheErr) {
    console.warn("[STUDENT_ENROLLMENT_CACHE_WARN]:", cacheErr);
  }

  return {
    studentId: createdStudent.id,
    studentName: `${firstName} ${lastName}`,
    admissionNumber: finalAdmissionNumber,
    currentClass: createdStudent.currentClass,
    cohort,
    session,
    tierName: resolvedTierName,
    isTertiary,
    loginOwner,
    loginOwnerName,
    username,
    deliveryContact,
    deliveryMethod,
    tempPassword: rawTempPassword,
    parentRecordId,
    actionTaken: "CREATED",
  };
}

/**
 * Validates a batch of student enrollment records for Grid / CSV / Blank-Form Import
 * Checks required fields, tier class compatibility, delivery channels, and duplicates.
 */
export async function validateEnrollmentBatch(
  schoolId: string,
  session: string,
  rows: StudentEnrollmentInput[],
  tierName?: string
) {
  const school = await basePrisma.school.findUnique({
    where: { id: schoolId },
    include: {
      academicTiers: { orderBy: { level: "asc" } },
      classrooms: { orderBy: { name: "asc" } },
    },
  });

  if (!school) throw new Error("School tenant not found");

  const resolvedTierName =
    tierName ||
    (school.academicTiers.length > 0 ? school.academicTiers[0].name : "Primary School");
  const isTertiary = isHigherEdTier(resolvedTierName) || school.tier === "TERTIARY";

  const tenantDb = await getPrismaClientForTier(schoolId, resolvedTierName);

  // Existing students lookup for duplicates
  const existingStudents = await tenantDb.student.findMany({
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
  }).catch(() => basePrisma.student.findMany({
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
  }));

  const regNoMap = new Map<string, any>();
  const identityMap = new Map<string, any>();
  const namePhoneClassMap = new Map<string, any>();

  const normalizeClassIdentity = (cls?: string | null) => {
    if (!cls) return "";
    return cls.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(arm)?[a-z]$/i, "");
  };

  const normalizeDob = (val?: string | Date | null) => {
    if (!val) return "";
    if (val instanceof Date) return val.toISOString().split("T")[0];
    const s = String(val).trim();
    return s.includes("T") ? s.split("T")[0] : s;
  };

  existingStudents.forEach((s) => {
    if (s.admissionNumber) {
      regNoMap.set(s.admissionNumber.toUpperCase().trim(), s);
    }
    const dobStr = normalizeDob(s.dateOfBirth);
    const phoneNorm = normalizePhoneNumber(s.parentPhone) || "";
    const classNorm = normalizeClassIdentity(s.currentClass);

    // Stricter identity check: Name + DOB + GuardianPhone + Class
    // Allows siblings/twins sharing the same parent phone to enroll cleanly!
    const key = `${s.firstName.toLowerCase().trim()}|${s.lastName.toLowerCase().trim()}|${dobStr}|${phoneNorm}|${classNorm}`;
    identityMap.set(key, s);

    if (phoneNorm) {
      const npKey = `${s.firstName.toLowerCase().trim()}|${s.lastName.toLowerCase().trim()}|${phoneNorm}|${classNorm}`;
      namePhoneClassMap.set(npKey, s);
    }
  });

  const batchSeenKeys = new Set<string>();
  const schoolPrefix = resolveSchoolPrefix(school.subdomain);
  const admissionYear = session ? session.split("/")[0] : String(new Date().getFullYear());

  // Sequence prediction for displaying auto-calculated RegNo in Grid
  let seqCounter = 0;
  existingStudents.forEach((s) => {
    if (s.admissionNumber) {
      const parts = s.admissionNumber.split("/");
      if (parts.length >= 4 && parts[1] === admissionYear) {
        const num = parseInt(parts[3], 10);
        if (!isNaN(num) && num > seqCounter) seqCounter = num;
      }
    }
  });

  const validatedRows = rows.map((row, idx) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let isDuplicate = false;
    let duplicateReason = "";

    const firstName = (row.firstName || "").trim();
    const lastName = (row.lastName || "").trim();
    const currentClass = (row.currentClass || "").trim();
    const gender = (row.gender || "").trim().toUpperCase();

    const normGuardianPhone = normalizePhoneNumber(row.guardianPhone);
    const normGuardianEmail = row.guardianEmail?.trim().toLowerCase() || "";
    const normStudentPhone = normalizePhoneNumber(row.studentPhone);
    const normStudentEmail = row.studentEmail?.trim().toLowerCase() || "";

    if (!firstName) errors.push("First Name is required");
    if (!lastName) errors.push("Last Name is required");
    if (!gender || !["M", "F", "MALE", "FEMALE"].includes(gender)) {
      errors.push("Gender is required (M/F)");
    }
    if (!currentClass) {
      errors.push("Class / Grade is required");
    }

    // Delivery channel check based on Tier & phone corruption checks
    if (row.guardianPhone) {
      const rawGPhone = String(row.guardianPhone).trim();
      if (isScientificNotationOrCorruptedPhone(rawGPhone)) {
        errors.push(
          `Corrupted Guardian Phone "${rawGPhone}": Excel converted this number to scientific notation (e.g. 8.03E+09). Format column as Text and enter a standard number like 08030000001.`
        );
      } else if (rawGPhone && (!normGuardianPhone || normGuardianPhone.length < 11)) {
        errors.push(
          `Invalid Guardian Phone "${rawGPhone}". Must be a valid 11-digit Nigerian number (e.g. 08030000001).`
        );
      }
    }

    if (row.studentPhone) {
      const rawSPhone = String(row.studentPhone).trim();
      if (isScientificNotationOrCorruptedPhone(rawSPhone)) {
        errors.push(
          `Corrupted Student Phone "${rawSPhone}": Excel converted this number to scientific notation (e.g. 8.03E+09). Format column as Text and enter a standard number like 08030000001.`
        );
      } else if (rawSPhone && (!normStudentPhone || normStudentPhone.length < 11)) {
        errors.push(
          `Invalid Student Phone "${rawSPhone}". Must be a valid 11-digit phone number (e.g. 08030000001).`
        );
      }
    }

    if (row.dateOfBirth) {
      const parsedDob = parseFlexibleDate(row.dateOfBirth);
      if (!parsedDob) {
        errors.push(`Invalid DateOfBirth "${row.dateOfBirth}". Please format as DD/MM/YYYY (e.g. 09/01/2018).`);
      }
    }

    if (!isTertiary) {
      if (!normGuardianPhone && !normGuardianEmail) {
        errors.push("Delivery Channel Required: Enter Guardian Phone or Guardian Email to deliver login credentials.");
      }
    } else {
      if (!normStudentEmail) {
        errors.push("Student Email is required for Tertiary login.");
      }
      if (!normStudentPhone) {
        errors.push("Student Phone is required for Tertiary credentials.");
      }
    }

    // Auto-calculated RegNo preview
    seqCounter++;
    const classCode = resolveTierCode(resolvedTierName, currentClass);
    const calculatedRegNo = row.admissionNumber || row.matricNo || `${schoolPrefix}/${admissionYear}/${classCode}/${String(seqCounter).padStart(4, "0")}`;

    // Duplicate check: 1. RegNo primary key
    if (row.admissionNumber && regNoMap.has(row.admissionNumber.toUpperCase().trim())) {
      isDuplicate = true;
      duplicateReason = `Admission Number ${row.admissionNumber} is already assigned in this institution.`;
      warnings.push(duplicateReason);
    }

    // Duplicate check: 2. Name + DOB + Phone + Class
    const dobStr = normalizeDob(row.dateOfBirth);
    const phoneNorm = (isTertiary ? normStudentPhone : normGuardianPhone) || "";
    const classNorm = normalizeClassIdentity(currentClass);
    const identityKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dobStr}|${phoneNorm}|${classNorm}`;
    const npKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${phoneNorm}|${classNorm}`;

    if (identityMap.has(identityKey)) {
      isDuplicate = true;
      duplicateReason = `Possible Duplicate: Student matching Name, Class, and Parent Phone already exists.`;
      warnings.push(duplicateReason);
    } else if (phoneNorm && namePhoneClassMap.has(npKey)) {
      isDuplicate = true;
      duplicateReason = `Possible Duplicate: Student matching Name and Parent Contact already exists.`;
      warnings.push(duplicateReason);
    }

    // In-batch duplicate check
    if (batchSeenKeys.has(identityKey) && firstName && lastName) {
      isDuplicate = true;
      duplicateReason = `Duplicate in current batch: This student appears multiple times in your input.`;
      warnings.push(duplicateReason);
    }
    batchSeenKeys.add(identityKey);

    return {
      ...row,
      rowIndex: idx + 1,
      firstName,
      lastName,
      gender: gender.startsWith("F") ? "F" : gender.startsWith("M") ? "M" : "",
      currentClass,
      admissionYear: row.admissionYear || admissionYear,
      calculatedRegNo,
      normalizedPhone: normGuardianPhone || normStudentPhone,
      isValid: errors.length === 0,
      errors,
      warnings,
      isDuplicate,
      duplicateReason,
      duplicateAction: row.duplicateAction || "SKIP",
    };
  });

  const readyToEnroll = validatedRows.filter((r) => r.isValid && !r.isDuplicate);
  const possibleDuplicates = validatedRows.filter((r) => r.isDuplicate);
  const errorsRejected = validatedRows.filter((r) => !r.isValid);

  return {
    rows: validatedRows,
    totalCount: validatedRows.length,
    readyCount: readyToEnroll.length,
    validCount: readyToEnroll.length,
    duplicateCount: possibleDuplicates.length,
    errorCount: errorsRejected.length,
    isTertiary,
    tierName: resolvedTierName,
  };
}

/**
 * Executes batch enrollment across all valid rows, creating credentials and generating
 * credentials sheet data for one-time admin export.
 */
export async function executeBatchEnrollmentWithCredentials(
  schoolId: string,
  session: string,
  rows: StudentEnrollmentInput[],
  tierName?: string
) {
  const safeTierName = typeof tierName === "string" ? tierName : undefined;
  const validation = await validateEnrollmentBatch(schoolId, session, rows, safeTierName);
  
  // Filter out invalid rows, and handle duplicate actions (default SKIP)
  const rowsToEnroll = validation.rows.filter((r, idx) => {
    if (!r.isValid) return false;
    const requestedAction = rows[idx]?.duplicateAction || r.duplicateAction;
    if (r.isDuplicate) {
      return requestedAction === "ENROLL_ANYWAY" || requestedAction === "MERGE_UPDATE";
    }
    return true;
  });

  if (rowsToEnroll.length === 0) {
    return {
      success: false,
      error: "No eligible rows to enroll. Please resolve validation errors or duplicate reviews.",
      enrolledCount: 0,
      skippedCount: validation.errorCount + validation.duplicateCount,
      credentialsSheet: [],
    };
  }

  const results: EnrollmentResultItem[] = [];

  for (const row of rowsToEnroll) {
    try {
      const res = await createStudentWithCredentials(schoolId, row, tierName);
      results.push(res);
    } catch (err: any) {
      console.error(`[BATCH_ENROLL_ROW_ERR] Row ${row.firstName} ${row.lastName}:`, err);
    }
  }

  // Invalidate cache
  try {
    const school = await basePrisma.school.findUnique({ where: { id: schoolId } });
    if (school) {
      await invalidateStudentNamespace(schoolId, safeTierName);
      clearL1TenantCache(school.subdomain);
      clearL1TenantCache(schoolId);
      revalidatePath(`/${school.subdomain}/students`);
      revalidatePath(`/${school.subdomain}/students`, "page");
      revalidatePath(`/${school.subdomain}/students`, "layout");
      revalidatePath(`/[schoolDomain]/students`, "page");
      revalidatePath(`/[schoolDomain]/students`, "layout");
      revalidatePath(`/${school.subdomain}/portal/staff`);
      revalidatePath(`/teacher/students`);
    }
  } catch {}

  return {
    success: results.length > 0,
    enrolledCount: results.length,
    skippedCount: rows.length - results.length,
    credentialsSheet: results,
  };
}

/**
 * Generates CSV content for Credentials Sheet download
 */
export function generateCredentialsSheetCsv(sheet: EnrollmentResultItem[]): string {
  const headers = [
    "Student Name",
    "Admission / Reg No",
    "Class",
    "Cohort",
    "Login Owner",
    "Owner Name",
    "Username / Login ID",
    "Delivery Contact",
    "Delivery Method",
    "Temporary Password",
  ];

  const rows = sheet.map((item) => [
    `"${item.studentName}"`,
    `"${item.admissionNumber}"`,
    `"${item.currentClass}"`,
    `"${item.cohort}"`,
    `"${item.loginOwner}"`,
    `"${item.loginOwnerName}"`,
    `"${item.username}"`,
    `"${item.deliveryContact}"`,
    `"${item.deliveryMethod}"`,
    `"${item.tempPassword}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
