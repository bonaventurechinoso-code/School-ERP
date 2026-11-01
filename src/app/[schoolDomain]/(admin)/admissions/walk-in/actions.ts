"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { dispatchAdmissionsNotification } from "@/lib/notifications/admissionsNotifier";

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
    const applicationNumber = `APP-${branchPrefix}-${year}-W${randomSuffix}`;
    const paymentReference = payment.posTerminalReference || `POS-${branchPrefix}-${Date.now().toString().slice(-6)}`;

    // Atomic creation of Walk-In Application, Sighted Documents, and Settled Fee Transaction
    const result = await basePrisma.$transaction(async (tx) => {
      // 1. Create AdmissionsApplication
      const application = await tx.admissionsApplication.create({
        data: {
          tenantId: school.id,
          schoolId: school.id,
          programId,
          academicSessionId: academicSessionId || `${year}/${year + 1}`,
          applicationNumber,
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
            parent: {
              name: parentName || `${lastName} Family`,
              phone: parentPhone || phoneNumber,
            },
            deskOfficer: registrarName,
            physicalInspectionCompleted: true,
          },
          metadata: {
            intakeDesk: "Admissions Front Desk",
            registrarName,
          },
        },
      });

      // 2. Register sighted physical credentials
      const docEntries: any[] = [];
      if (physicalDocsSighted.birthCertificate) docEntries.push("BIRTH_CERTIFICATE");
      if (physicalDocsSighted.passportPhotograph) docEntries.push("PASSPORT_PHOTO");
      if (physicalDocsSighted.academicResults) docEntries.push("ACADEMIC_RESULTS");
      if (physicalDocsSighted.lgaIndigeneCert) docEntries.push("LGA_INDIGENE_LETTER");

      for (const docType of docEntries) {
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

      // 3. Record settled POS/Cash transaction
      const feeTx = await tx.admissionsFeeTransaction.create({
        data: {
          tenantId: school.id,
          applicationId: application.id,
          paymentMethod: payment.method === "CASH" ? "CASH" : "POS_COUNTER",
          amount: payment.amount || 5000,
          currency: "NGN",
          paymentReference,
          paymentStatus: "SETTLED",
          reconciliationNotes: `Desk intake by ${registrarName} (${payment.method})`,
          verifiedByUserId: registrarName,
          verifiedAt: new Date(),
        },
      });

      // 4. Record Audit Trail
      await tx.admissionAuditTrail.create({
        data: {
          tenantId: school.id,
          schoolId: school.id,
          applicationId: application.id,
          registerId: application.id,
          actorId: registrarName,
          action: "WALK_IN_CREATED",
          fromStage: "DRAFT",
          toStage: "SUBMITTED",
          metadata: {
            intakeChannel: "WALK_IN",
            paymentMethod: payment.method,
            paymentReference,
            sightedDocsCount: docEntries.length,
          },
        },
      });

      return { application, feeTx, docEntriesCount: docEntries.length };
    });

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

    revalidatePath("/[schoolDomain]/admissions", "page");

    return {
      success: true,
      applicationNumber: result.application.applicationNumber,
      paymentReference,
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
        issuedAt: new Date().toISOString(),
        trackingUrl: magicTrackingLink,
      },
    };
  } catch (error: any) {
    console.error("[recordWalkInApplication error]:", error);
    return { success: false, error: error.message || "Failed to record walk-in intake." };
  }
}

