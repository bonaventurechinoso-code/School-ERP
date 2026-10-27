import { basePrisma } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";

export interface EnrollmentHandshakeInput {
  registerId: string;
  tenantId: string;
  schoolDomain?: string;
  actorId?: string;
  tuitionFeeAmount?: number;
  feeDescription?: string;
  ipAddress?: string;
}

export interface EnrollmentHandshakeResult {
  success: boolean;
  matricNo?: string;
  student?: any;
  invoice?: any;
  parent?: any;
  register?: any;
  auditTrailId?: string;
  error?: string;
}

/**
 * Enterprise Atomic Enrollment Handshake Transaction
 * 
 * Guarantees strict multi-tenant isolation, atomic SIS student matriculation,
 * guardian link, Bursary sub-ledger tuition invoicing, and immutable audit trailing.
 */
export async function executeEnrollmentHandshake(
  input: EnrollmentHandshakeInput
): Promise<EnrollmentHandshakeResult> {
  const { registerId, tenantId, schoolDomain, actorId = "Admissions Officer", ipAddress } = input;

  if (!registerId || !tenantId) {
    return { success: false, error: "Both registerId and tenantId are required for enrollment handshake." };
  }

  try {
    return await basePrisma.$transaction(async (tx) => {
      // 1. TENANT ISOLATION GUARD: Query strictly scoped to tenantId
      const register = await tx.admissionRegister.findFirst({
        where: {
          tenantId,
          OR: [
            { id: registerId },
            { applicationNo: registerId },
          ],
        },
      });

      if (!register) {
        throw new Error(`Applicant record [${registerId}] not found under tenant [${tenantId}]. Cross-tenant access denied.`);
      }

      // 2. IDEMPOTENCY GUARD: Check if already enrolled
      if (register.status === "ENROLLED" && (register.credentialsJson as any)?.matricNo) {
        const existingMatricNo = (register.credentialsJson as any).matricNo;
        const existingStudent = await tx.student.findFirst({
          where: { schoolId: tenantId, admissionNumber: existingMatricNo },
        });
        if (existingStudent) {
          return {
            success: true,
            matricNo: existingMatricNo,
            student: existingStudent,
            register,
          };
        }
      }

      // 3. AUTO-GENERATE MATRICULATION NUMBER: [TENANT]-[YEAR]-[SEQ]
      const school = await tx.school.findUnique({
        where: { id: tenantId },
        select: { id: true, subdomain: true, name: true },
      });

      const tenantCode = (school?.subdomain || schoolDomain || "SCH")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6) || "SCH";
      
      const currentYear = new Date().getFullYear();
      const studentCount = await tx.student.count({
        where: { schoolId: tenantId },
      });
      const seqNumber = String(studentCount + 1).padStart(4, "0");
      const matricNo = `${tenantCode}-${currentYear}-${seqNumber}`;

      // 4. RESOLVE ACADEMIC TIER
      const regAny = register as any;
      const creds = (regAny.credentialsJson as any) || {};
      const personal = (regAny.personalData as any) || {};
      const targetTier = regAny.tier;

      let academicTier = await tx.academicTier.findFirst({
        where: {
          schoolId: tenantId,
          ...(targetTier ? { name: { contains: String(targetTier), mode: "insensitive" } } : {}),
        },
      });

      if (!academicTier) {
        // Fallback to any tier for this tenant or create a default
        academicTier = await tx.academicTier.findFirst({
          where: { schoolId: tenantId },
        });
      }

      if (!academicTier) {
        academicTier = await tx.academicTier.create({
          data: {
            schoolId: tenantId,
            name: register.classApplied || "General Academic",
            level: 1,
          },
        });
      }

      // 5. ATOMIC STUDENT CREATION IN SIS
      const assignedClass = creds.assignedClass || register.classApplied || "Unassigned";
      const guardianName = personal.guardianName || creds.guardianName || `Guardian of ${register.firstName}`;
      const defaultPasswordHash = await bcrypt.hash("Welcome123", 10);
      const student = await tx.student.create({
        data: {
          schoolId: tenantId,
          tierId: academicTier.id,
          firstName: register.firstName.trim(),
          lastName: register.lastName.trim(),
          email: register.email?.trim().toLowerCase() || null,
          admissionNumber: matricNo,
          currentClass: assignedClass,
          parentName: guardianName,
          parentPhone: register.parentPhone || null,
          parentEmail: personal.guardianEmail || register.email || null,
          status: "ENROLLED",
          enrolledAt: new Date(),
          dynamicFields: {
            matricNo,
            applicationNo: register.applicationNo,
            enrolledVia: "Admissions Enterprise Handshake",
            password: defaultPasswordHash,
            isTemporaryPassword: true,
          },
        },
      });

      // 6. PARENT / GUARDIAN AUTO-PROVISIONING & STUDENT_PARENT LINK
      const rawGuardianEmail = personal.guardianEmail || register.email;
      const guardianEmail = rawGuardianEmail
        ? rawGuardianEmail.trim().toLowerCase()
        : `${register.applicationNo.toLowerCase()}@guardian.local`;

      let parent = await tx.parent.findFirst({
        where: {
          schoolId: tenantId,
          email: guardianEmail,
        },
      });

      if (!parent) {
        const parentPasswordHash = await bcrypt.hash("Guardian@123", 10);
        parent = await tx.parent.create({
          data: {
            schoolId: tenantId,
            name: guardianName,
            email: guardianEmail,
            phone: register.parentPhone?.trim() || null,
            passwordHash: parentPasswordHash,
            relationship: "Guardian",
          },
        });
      }

      // Ensure StudentParent join table association
      await tx.studentParent.upsert({
        where: {
          studentId_parentId: {
            studentId: student.id,
            parentId: parent.id,
          },
        },
        create: {
          studentId: student.id,
          parentId: parent.id,
          schoolId: tenantId,
        },
        update: {},
      });

      // 7. BURSARY SUB-LEDGER INITIAL TUITION BILLING (INVOICE)
      const tuitionFee = input.tuitionFeeAmount && input.tuitionFeeAmount > 0
        ? input.tuitionFeeAmount
        : 50000;
      
      const invoiceDueDate = new Date();
      invoiceDueDate.setDate(invoiceDueDate.getDate() + 30); // 30 days due

      const invoice = await tx.invoice.create({
        data: {
          schoolId: tenantId,
          studentId: student.id,
          amountDue: tuitionFee,
          amountPaid: 0,
          dueDate: invoiceDueDate,
          status: "PENDING",
          description: input.feeDescription || `Tuition & Enrollment Acceptance Fee - ${matricNo}`,
        },
      });

      // 8. UPDATE ADMISSION REGISTER TO ENROLLED STAGE
      const rawCreds = (register.credentialsJson as any) || {};
      const isArrayCreds = Array.isArray(rawCreds);
      const credsObj = isArrayCreds ? { documents: rawCreds } : { ...(rawCreds || {}) };
      const existingLogs = Array.isArray(credsObj.statusLogs) ? credsObj.statusLogs : [];

      const newLog = {
        fromStatus: register.status,
        toStatus: "ENROLLED",
        action: "ENROLLED",
        changedById: actorId,
        reason: `Final matriculation complete. Student enrolled in SIS [Matric No: ${matricNo}]. Bursary invoice [${invoice.id}] issued.`,
        createdAt: new Date().toISOString(),
      };

      credsObj.statusLogs = [...existingLogs, newLog];
      credsObj.matricNo = matricNo;
      credsObj.studentId = student.id;
      credsObj.invoiceId = invoice.id;

      const updatedRegister = await tx.admissionRegister.update({
        where: { id: register.id },
        data: {
          status: "ENROLLED",
          admittedAt: new Date(),
          credentialsJson: credsObj,
          updatedAt: new Date(),
        },
      });

      // 9. RECORD IMMUTABLE ADMISSION AUDIT TRAIL
      const auditTrail = await tx.admissionAuditTrail.create({
        data: {
          tenantId,
          registerId: register.id,
          actorId,
          action: "ENROLLED",
          fromStage: register.status,
          toStage: "ENROLLED",
          ip: ipAddress || null,
          metadata: {
            matricNo,
            studentId: student.id,
            parentId: parent.id,
            invoiceId: invoice.id,
            amountDue: tuitionFee,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // 10. SYNC TO ADMISSION LEAD IF LINKED
      try {
        const cleanRef = register.applicationNo.replace(/^APP-|^ADM-/, "").toLowerCase();
        await tx.admissionLead.updateMany({
          where: {
            schoolId: tenantId,
            OR: [
              { id: { contains: cleanRef, mode: "insensitive" } },
              { studentEmail: register.email || undefined },
              { parentEmail: register.email || undefined },
              { parentPhone: register.parentPhone || undefined },
            ],
          },
          data: {
            status: "ENROLLED",
            updatedAt: new Date(),
          },
        });
      } catch (leadSyncErr) {
        console.warn("[executeEnrollmentHandshake] Warning syncing lead status:", leadSyncErr);
      }

      return {
        success: true,
        matricNo,
        student,
        invoice,
        parent,
        register: updatedRegister,
        auditTrailId: auditTrail.id,
      };
    });
  } catch (error: any) {
    console.error("[executeEnrollmentHandshake] Transaction Failed:", error);
    return {
      success: false,
      error: error.message || "Enrollment handshake transaction failed.",
    };
  }
}
