"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { setUserMustChangePassword } from "@/lib/security-service";
import { dispatchAdmissionsNotification } from "@/lib/notifications/admissionsNotifier";
import {
  findExistingAdmissionsApplication,
  isInstitutionalApplicationNo,
} from "@/lib/admissions-deduplication.service";

export async function recordWalkInApplication(payload: {
  schoolId: string;
  registrarName: string;
  academicSessionId?: string;
  programId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phoneNumber: string;
  whatsappNumber?: string;
  dateOfBirth: string;
  gender: string;
  parentName?: string;
  parentPhone?: string;
  password?: string;
  physicalDocsSighted: {
    birthCertificate: boolean;
    passportPhotograph: boolean;
    academicResults: boolean;
    lgaIndigeneCert: boolean;
  };
  payment: {
    method: "POS_COUNTER" | "CASH";
    amount: number;
    posTerminalReference?: string;
  };
}) {
  try {
    const {
      schoolId,
      registrarName,
      academicSessionId,
      programId,
      firstName,
      lastName,
      middleName,
      email,
      phoneNumber,
      whatsappNumber,
      dateOfBirth,
      gender,
      parentName,
      parentPhone,
      physicalDocsSighted,
      payment,
    } = payload;

    const school = await basePrisma.school.findFirst({
      where: {
        OR: [{ id: schoolId }, { subdomain: schoolId.toLowerCase() }, { slug: schoolId.toLowerCase() }],
      },
      select: { id: true, name: true, subdomain: true },
    });

    if (!school) {
      return { success: false, error: "Target school tenant not found." };
    }

    const year = new Date().getFullYear();
    const branchPrefix = school.subdomain ? school.subdomain.toUpperCase().slice(0, 4) : "SCH";
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newApplicationNumber = `APP-${branchPrefix}-${year}-W${randomSuffix}`;
    const paymentReference = payment.posTerminalReference || `POS-${branchPrefix}-${Date.now().toString().slice(-6)}`;
    const effectiveSession = academicSessionId || `${year}/${year + 1}`;
    const targetFullName = `${firstName} ${middleName ? middleName + " " : ""}${lastName}`.trim();

    // Prepare credentials for walk-in candidate (forced password change on first login)
    const rawInitialPassword = payload.password?.trim() || `Welcome@${Math.floor(1000 + Math.random() * 9000)}`;
    const hashedPassword = await bcrypt.hash(rawInitialPassword, 10);

    // 1. UPSTREAM VALIDATION RULE & DETERMINISTIC MATCHING KEY PRE-SUBMISSION CHECK:
    // [PUPIL FULL NAME] + [CLASS] + [AGE/DOB] + [CURRENT_SESSION]
    const existingApp = await findExistingAdmissionsApplication({
      schoolId: school.id,
      fullName: targetFullName,
      className: programId,
      dateOfBirth: new Date(dateOfBirth),
      session: effectiveSession,
      phoneNumber: phoneNumber || parentPhone,
      email,
    });

    const isUpsert = Boolean(existingApp);
    // If existing record has temporary portal ID (e.g. APP-7F6950), finalize to localized format.
    // If existing record already has finalized institutional format (e.g. EGEDE/2026/0001), preserve it.
    let finalizedAppNo = newApplicationNumber;
    if (existingApp) {
      if (isInstitutionalApplicationNo(existingApp.applicationNumber)) {
        finalizedAppNo = existingApp.applicationNumber;
      } else {
        finalizedAppNo = newApplicationNumber;
      }
    }

    // Atomic execution of Walk-In Application (Upsert/Create), Sighted Documents, and Settled Fee Transaction
    const result = await basePrisma.$transaction(async (tx) => {
      let application: any = null;

      if (existingApp) {
        // Upsert / Merge into existing record to prevent duplicate portal vs admin rows
        application = await tx.admissionsApplication.update({
          where: { id: existingApp.id },
          data: {
            applicationNumber: finalizedAppNo,
            intakeChannel: "WALK_IN",
            status: "SUBMITTED",
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: middleName?.trim() || existingApp.middleName,
            email: email.toLowerCase().trim() || existingApp.email,
            phoneNumber: phoneNumber.trim() || existingApp.phoneNumber,
            whatsappNumber: whatsappNumber?.trim() || phoneNumber.trim() || existingApp.whatsappNumber,
            dateOfBirth: new Date(dateOfBirth),
            gender: gender || existingApp.gender,
            tierSpecificData: {
              ...((existingApp.tierSpecificData as any) || {}),
              cohort: (existingApp.tierSpecificData as any)?.cohort || String(year),
              admissionYear: (existingApp.tierSpecificData as any)?.admissionYear || String(year),
              parent: {
                name: parentName || (existingApp.tierSpecificData as any)?.parent?.name || `${lastName} Family`,
                phone: parentPhone || phoneNumber || (existingApp.tierSpecificData as any)?.parent?.phone,
              },
              deskOfficer: registrarName,
              physicalInspectionCompleted: true,
              passwordHash: hashedPassword,
              isSelfService: false,
            },
            metadata: {
              ...((existingApp.metadata as any) || {}),
              cohort: (existingApp.metadata as any)?.cohort || String(year),
              admissionYear: (existingApp.metadata as any)?.admissionYear || String(year),
              intakeDesk: "Admissions Front Desk",
              registrarName,
              walkInMergedAt: new Date().toISOString(),
              passwordHash: hashedPassword,
              isSelfService: false,
            },
          },
        });
      } else {
        // Create brand-new AdmissionsApplication
        application = await tx.admissionsApplication.create({
          data: {
            tenantId: school.id,
            schoolId: school.id,
            programId,
            academicSessionId: effectiveSession,
            applicationNumber: finalizedAppNo,
            intakeChannel: "WALK_IN",
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: middleName?.trim() || null,
            email: email.toLowerCase().trim(),
            phoneNumber: phoneNumber.trim(),
            whatsappNumber: whatsappNumber?.trim() || phoneNumber.trim(),
            dateOfBirth: new Date(dateOfBirth),
            gender,
            status: "SUBMITTED", // Immediately submitted as payment is settled at the desk
            tierSpecificData: {
              cohort: String(year),
              admissionYear: String(year),
              parent: {
                name: parentName || `${lastName} Family`,
                phone: parentPhone || phoneNumber,
              },
              deskOfficer: registrarName,
              physicalInspectionCompleted: true,
              passwordHash: hashedPassword,
              isSelfService: false,
            },
            metadata: {
              cohort: String(year),
              admissionYear: String(year),
              intakeDesk: "Admissions Front Desk",
              registrarName,
              passwordHash: hashedPassword,
              isSelfService: false,
            },
          },
        });
      }

      // Provision/sync User record for the candidate with mustChangePassword=true
      let userRecord: any = null;
      if (email && email.includes("@")) {
        const cleanEmail = email.toLowerCase().trim();
        userRecord = await tx.user.findFirst({
          where: {
            schoolId: school.id,
            email: { equals: cleanEmail, mode: "insensitive" },
          },
        });

        if (userRecord) {
          userRecord = await tx.user.update({
            where: { id: userRecord.id },
            data: {
              passwordHash: hashedPassword,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              role: "STUDENT",
              status: "ACTIVE",
              mustChangePassword: true,
            },
          });
        } else {
          userRecord = await tx.user.create({
            data: {
              schoolId: school.id,
              email: cleanEmail,
              passwordHash: hashedPassword,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              role: "STUDENT",
              status: "ACTIVE",
              mustChangePassword: true,
            },
          });
        }
      }

      // 2. Register sighted physical credentials
      const docEntries: any[] = [];
      if (physicalDocsSighted.birthCertificate) docEntries.push("BIRTH_CERTIFICATE");
      if (physicalDocsSighted.passportPhotograph) docEntries.push("PASSPORT_PHOTO");
      if (physicalDocsSighted.academicResults) docEntries.push("ACADEMIC_RESULTS");
      if (physicalDocsSighted.lgaIndigeneCert) docEntries.push("LGA_INDIGENE_LETTER");

      for (const docType of docEntries) {
        const existingDoc = await tx.admissionsDocument.findFirst({
          where: { applicationId: application.id, documentType: docType },
        });

        if (existingDoc) {
          await tx.admissionsDocument.update({
            where: { id: existingDoc.id },
            data: {
              verificationStatus: "MANUALLY_VERIFIED",
              verifiedByUserId: registrarName,
              verifiedAt: new Date(),
            },
          });
        } else {
          await tx.admissionsDocument.create({
            data: {
              tenantId: school.id,
              applicationId: application.id,
              documentType: docType,
              storageKey: `desk_sighted/${school.id}/${application.id}/${docType}`,
              fileMimeType: "application/physical-copy",
              fileSizeBytes: 0,
              verificationStatus: "MANUALLY_VERIFIED",
              rejectionReason: null,
              verifiedByUserId: registrarName,
              verifiedAt: new Date(),
            },
          });
        }
      }

      // 3. Record settled POS/Cash transaction
      const receiptFileUrl = payment.method === "CASH" ? "CASH_COUNTER_RECEIPT" : "POS_RECEIPT";
      const feeTx = await tx.admissionsFeeTransaction.create({
        data: {
          tenantId: school.id,
          applicationId: application.id,
          paymentMethod: payment.method === "CASH" ? "CASH" : "POS_COUNTER",
          amount: payment.amount || 5000,
          currency: "NGN",
          paymentReference,
          proofOfPaymentUrl: receiptFileUrl,
          paymentStatus: "SETTLED",
          reconciliationNotes: `Desk intake by ${registrarName} (${payment.method})`,
          verifiedByUserId: registrarName,
          verifiedAt: new Date(),
        },
      });

      // Settle and record into Universal PaymentReceipt table for Bursar verification hub
      const applicantFullName = `${firstName} ${lastName}`.trim();
      await tx.paymentReceipt.create({
        data: {
          tenantId: school.id,
          schoolId: school.id,
          moduleType: "ADMISSION_FORM_FEE",
          payerType: "APPLICANT",
          payerId: application.id,
          payerName: applicantFullName,
          referenceNo: finalizedAppNo,
          amount: payment.amount || 5000,
          paymentMethod: payment.method === "CASH" ? "CASH" : "POS_COUNTER",
          paymentMode: payment.method === "CASH" ? "CASH_COUNTER" : "POS_TERMINAL",
          fileUrl: receiptFileUrl,
          proofOfPaymentUrl: receiptFileUrl,
          fileName: `${payment.method.toLowerCase()}_receipt.pdf`,
          depositorName: applicantFullName,
          transferReference: paymentReference,
          txnRef: paymentReference,
          status: "VERIFIED",
          state: "SETTLED",
          verifiedBy: registrarName,
          verifiedByUserId: registrarName,
          verifiedAt: new Date(),
        },
      }).catch((prErr: any) => {
        console.warn("[recordWalkInApplication] PaymentReceipt creation note:", prErr);
      });

      // 4. Sync corresponding AdmissionRegister if one exists
      await tx.admissionRegister.updateMany({
        where: {
          tenantId: school.id,
          OR: [
            { applicationNo: finalizedAppNo },
            ...(existingApp ? [{ applicationNo: existingApp.applicationNumber }] : []),
          ],
        },
        data: {
          applicationNo: finalizedAppNo,
          formFeePaid: true,
          status: "DOCS_PENDING",
        },
      });

      return { application, feeTx, docEntriesCount: docEntries.length, isUpsert, userRecord };
    });

    // Enforce password change requirement for walk-in applicants registered by desk officer
    if (result.userRecord) {
      try {
        await setUserMustChangePassword(result.userRecord.id, school.id, true);
      } catch (secErr) {
        console.warn("[recordWalkInApplication] Warning setting mustChangePassword:", secErr);
      }
    }

    // 4. Record Audit Trail safely after transaction commits
    try {
      await basePrisma.admissionAuditTrail.create({
        data: {
          tenantId: school.id,
          schoolId: school.id,
          applicationId: result.application.id,
          registerId: result.application.id,
          actorId: registrarName,
          action: result.isUpsert ? "WALK_IN_MERGED" : "WALK_IN_CREATED",
          fromStage: result.isUpsert ? "PORTAL_INQUIRY" : "DRAFT",
          toStage: "SUBMITTED",
          metadata: {
            intakeChannel: "WALK_IN",
            paymentMethod: payment.method,
            paymentReference,
            sightedDocsCount: result.docEntriesCount,
          },
        },
      });
    } catch (auditErr) {
      console.warn("[recordWalkInApplication] Warning recording audit trail:", auditErr);
    }

    // 4. Construct magic tracking link and dispatch SMS / WhatsApp auto-invitation
    const host = process.env.NEXTAUTH_URL || "https://schoolerp.ng";
    const magicTrackingLink = `${host}/${school.subdomain}/admissions/upload/${result.application.id}?token=${result.application.applicationNumber}`;

    await dispatchAdmissionsNotification({
      tenantId: school.id,
      schoolName: school.name,
      schoolSubdomain: school.subdomain,
      applicantNumber: result.application.applicationNumber,
      recipient: {
        name: `${firstName} ${lastName}`,
        email: result.application.email,
        phone: result.application.phoneNumber,
        whatsappNumber: result.application.whatsappNumber || result.application.phoneNumber,
      },
      event: "APPLICATION_INITIATED",
      magicTrackingLink,
      paymentReference,
      amountPaid: payment.amount,
    }).catch((notifErr) => {
      console.warn("[WALK_IN_NOTIFICATION_WARN]:", notifErr);
    });

    try {
      revalidatePath("/[schoolDomain]/admissions", "page");
    } catch {
      // Safe no-op in non-HTTP/test contexts
    }

    return {
      success: true,
      applicationNumber: result.application.applicationNumber,
      paymentReference,
      initialPassword: rawInitialPassword,
      receiptPayload: {
        schoolName: school.name,
        subdomain: school.subdomain,
        applicationNumber: result.application.applicationNumber,
        applicantName: `${firstName} ${lastName}`,
        program: programId,
        paymentMethod: payment.method,
        paymentReference,
        amount: payment.amount,
        registrarName,
        initialPassword: rawInitialPassword,
        issuedAt: new Date().toISOString(),
        trackingUrl: magicTrackingLink,
      },
    };
  } catch (error: any) {
    console.error("[recordWalkInApplication error]:", error);
    return { success: false, error: error.message || "Failed to record walk-in intake." };
  }
}

