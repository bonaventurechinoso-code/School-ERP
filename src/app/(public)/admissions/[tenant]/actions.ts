"use server";

import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { savePrivateAdmissionsFile } from "@/lib/storage/admissionsStorage";
import { dispatchAdmissionsNotification } from "@/lib/notifications/admissionsNotifier";
import { getTenantPaymentSettings } from "@/lib/payment-receipt-service";

export async function lookupTenantAdmissionsProfile(tenantSlug: string) {
  try {
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: tenantSlug.toLowerCase().trim() },
          { slug: tenantSlug.toLowerCase().trim() },
          { id: tenantSlug },
        ],
      },
      include: {
        academicTiers: { orderBy: { level: "asc" } },
        classrooms: { select: { id: true, name: true, tierId: true } },
      },
    });

    if (!school) {
      return { success: false, error: `Institution '${tenantSlug}' not found.` };
    }

    const paymentSettings = await getTenantPaymentSettings(school.id).catch(() => null);

    return {
      success: true,
      school: {
        id: school.id,
        name: school.name,
        subdomain: school.subdomain,
        logoUrl: school.logo || null,
        primaryColor: "#1e3a8a",
        academicTiers: school.academicTiers,
        classrooms: school.classrooms,
      },
      paymentSettings,
    };
  } catch (error: any) {
    console.error("[lookupTenantAdmissionsProfile error]:", error);
    return { success: false, error: error.message };
  }
}

export async function submitPublicApplication(payload: {
  tenantId: string;
  schoolId: string;
  programId: string;
  academicSessionId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phoneNumber: string;
  whatsappNumber?: string;
  dateOfBirth: string;
  gender: string;
  tierSpecificData: any;
  documents: Array<{
    documentType: string;
    fileName: string;
    mimeType: string;
    base64Data: string;
  }>;
  feePayment?: {
    paymentMethod: "MANUAL_BANK_TRANSFER" | "DIRECT_GATEWAY";
    amount: number;
    receiptBase64?: string;
    receiptFileName?: string;
    receiptMimeType?: string;
    depositorName?: string;
  };
}) {
  try {
    const {
      tenantId,
      schoolId,
      programId,
      academicSessionId,
      firstName,
      lastName,
      middleName,
      email,
      phoneNumber,
      whatsappNumber,
      dateOfBirth,
      gender,
      tierSpecificData,
      documents,
      feePayment,
    } = payload;

    const school = await basePrisma.school.findFirst({
      where: {
        OR: [{ id: schoolId }, { id: tenantId }],
      },
      select: { id: true, name: true, subdomain: true },
    });

    if (!school) {
      return { success: false, error: "Target institution not found." };
    }

    const effectiveSchoolId = school.id;
    const year = new Date().getFullYear();
    const branchPrefix = school.subdomain ? school.subdomain.toUpperCase().slice(0, 4) : "SCH";
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const applicationNumber = `APP-${branchPrefix}-${year}-${randomSuffix}`;
    const paymentReference = `PAY-${branchPrefix}-${year}-${randomSuffix}`;

    // 1. Create the AdmissionsApplication record
    const application = await basePrisma.admissionsApplication.create({
      data: {
        tenantId: effectiveSchoolId,
        schoolId: effectiveSchoolId,
        programId,
        academicSessionId: academicSessionId || `${year}/${year + 1}`,
        applicationNumber,
        intakeChannel: "ONLINE_PORTAL",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName?.trim() || null,
        email: email.toLowerCase().trim(),
        phoneNumber: phoneNumber.trim(),
        whatsappNumber: whatsappNumber?.trim() || phoneNumber.trim(),
        dateOfBirth: new Date(dateOfBirth),
        gender,
        status: feePayment?.receiptBase64 ? "PAYMENT_PENDING" : "DRAFT",
        tierSpecificData: tierSpecificData || {},
        metadata: {
          submittedFromIp: "client-portal",
          userDevice: "browser",
        },
      },
    });

    // 2. Process and Store Uploaded Credentials in Private Storage
    for (const doc of documents) {
      if (doc.base64Data) {
        const fileBuffer = Buffer.from(doc.base64Data, "base64");
        const uploadResult = await savePrivateAdmissionsFile({
          buffer: fileBuffer,
          originalFileName: doc.fileName,
          mimeType: doc.mimeType,
          tenantId: effectiveSchoolId,
          applicationId: application.id,
          documentType: doc.documentType,
        });

        await basePrisma.admissionsDocument.create({
          data: {
            tenantId: effectiveSchoolId,
            applicationId: application.id,
            documentType: doc.documentType,
            storageKey: uploadResult.storageKey,
            fileMimeType: uploadResult.fileMimeType,
            fileSizeBytes: uploadResult.fileSizeBytes,
            verificationStatus: "PENDING",
          },
        });
      }
    }

    // 3. Process Application Fee Transaction & Receipt if attached
    if (feePayment) {
      let receiptStorageKey: string | null = null;
      if (feePayment.receiptBase64 && feePayment.receiptFileName && feePayment.receiptMimeType) {
        const receiptBuffer = Buffer.from(feePayment.receiptBase64, "base64");
        const receiptUpload = await savePrivateAdmissionsFile({
          buffer: receiptBuffer,
          originalFileName: feePayment.receiptFileName,
          mimeType: feePayment.receiptMimeType,
          tenantId: effectiveSchoolId,
          applicationId: application.id,
          documentType: "APPLICATION_FEE_RECEIPT",
        });
        receiptStorageKey = receiptUpload.storageKey;
      }

      await basePrisma.admissionsFeeTransaction.create({
        data: {
          tenantId: effectiveSchoolId,
          applicationId: application.id,
          paymentMethod: feePayment.paymentMethod || "MANUAL_BANK_TRANSFER",
          amount: feePayment.amount || 5000,
          currency: "NGN",
          paymentReference,
          proofOfPaymentUrl: receiptStorageKey,
          paymentStatus: "PENDING",
          reconciliationNotes: feePayment.depositorName ? `Depositor: ${feePayment.depositorName}` : null,
        },
      });
    }

    // 4. Construct Magic Tracking Link and Dispatch Omnichannel Alerts
    const host = process.env.NEXTAUTH_URL || "https://schoolerp.ng";
    const magicTrackingLink = `${host}/${school.subdomain}/admissions/upload/${application.id}?token=${application.applicationNumber}`;

    await dispatchAdmissionsNotification({
      tenantId: effectiveSchoolId,
      schoolName: school.name,
      schoolSubdomain: school.subdomain,
      applicantNumber: application.applicationNumber,
      recipient: {
        name: `${firstName} ${lastName}`,
        email: application.email,
        phone: application.phoneNumber,
        whatsappNumber: application.whatsappNumber || application.phoneNumber,
      },
      event: feePayment?.receiptBase64 ? "RECEIPT_UPLOADED" : "APPLICATION_INITIATED",
      magicTrackingLink,
      paymentReference,
      amountPaid: feePayment?.amount || 5000,
    }).catch((notifErr) => {
      console.warn("[PUBLIC_APP_NOTIFICATION_WARN]:", notifErr);
    });

    return {
      success: true,
      applicationNumber: application.applicationNumber,
      applicationId: application.id,
      magicTrackingLink,
    };
  } catch (error: any) {
    console.error("[submitPublicApplication error]:", error);
    return { success: false, error: error.message || "Failed to submit application." };
  }
}
