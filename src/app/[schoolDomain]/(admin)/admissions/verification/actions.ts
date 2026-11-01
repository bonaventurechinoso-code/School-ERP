"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { dispatchAdmissionsNotification } from "@/lib/notifications/admissionsNotifier";
import { generatePresignedDownloadToken } from "@/lib/storage/admissionsStorage";

export enum DocumentRejectionReason {
  BLURRY_UNREADABLE = "Blurry or unreadable scan",
  NAME_MISMATCH = "Name mismatch on certificate",
  INSUFFICIENT_CREDITS = "Insufficient credits for selected program",
  EXPIRED_DOCUMENT = "Expired document or invalid issue date",
  WRONG_DOCUMENT_TYPE = "Incorrect document uploaded for slot",
  SUSPECTED_TAMPERING = "Suspected digital alteration or incomplete copy",
  OTHER = "Other institutional compliance reason",
}

export async function fetchApplicationsForVerification(schoolId: string) {
  try {
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [{ id: schoolId }, { subdomain: schoolId.toLowerCase() }, { slug: schoolId.toLowerCase() }],
      },
      select: { id: true, name: true, subdomain: true },
    });

    const targetSchoolId = school?.id || schoolId;

    const applications = await basePrisma.admissionsApplication.findMany({
      where: {
        schoolId: targetSchoolId,
      },
      include: {
        documents: {
          orderBy: { createdAt: "desc" },
        },
        feeTransactions: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Generate fresh presigned download URLs (15 min TTL) for all documents
    const withPresignedUrls = applications.map((app) => ({
      ...app,
      documents: app.documents.map((doc) => {
        const { signedUrl } = generatePresignedDownloadToken(doc.storageKey, doc.tenantId, 15 * 60);
        return {
          ...doc,
          presignedUrl: signedUrl,
        };
      }),
    }));

    return { success: true, applications: withPresignedUrls, school };
  } catch (error: any) {
    console.error("[fetchApplicationsForVerification error]:", error);
    return { success: false, applications: [], error: error.message };
  }
}

export async function approveAdmissionsDocument(
  documentId: string,
  schoolId: string,
  verifiedByUserId: string = "Admissions Officer"
) {
  try {
    const doc = await basePrisma.admissionsDocument.findUnique({
      where: { id: documentId },
      include: { application: true },
    });

    if (!doc) {
      return { success: false, error: "Document not found." };
    }

    if (doc.application.schoolId !== schoolId && doc.tenantId !== schoolId) {
      return { success: false, error: "403 Forbidden: Cross-tenant modification rejected." };
    }

    const updated = await basePrisma.admissionsDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: "MANUALLY_VERIFIED",
        verifiedByUserId,
        verifiedAt: new Date(),
        rejectionReason: null,
      },
    });

    // Check if all documents for this application are now verified
    const allDocs = await basePrisma.admissionsDocument.findMany({
      where: { applicationId: doc.applicationId },
    });

    const allVerified = allDocs.length > 0 && allDocs.every((d) => d.verificationStatus === "MANUALLY_VERIFIED" || d.verificationStatus === "AUTO_VERIFIED");

    if (allVerified) {
      await basePrisma.admissionsApplication.update({
        where: { id: doc.applicationId },
        data: {
          status: "UNDER_REVIEW",
        },
      });
    }

    revalidatePath("/[schoolDomain]/admissions/verification", "page");
    return { success: true, document: updated, allVerified };
  } catch (error: any) {
    console.error("[approveAdmissionsDocument error]:", error);
    return { success: false, error: error.message || "Failed to approve document." };
  }
}

export async function rejectAdmissionsDocument({
  documentId,
  schoolId,
  reason,
  customNotes,
  verifiedByUserId = "Admissions Officer",
}: {
  documentId: string;
  schoolId: string;
  reason: DocumentRejectionReason | string;
  customNotes?: string;
  verifiedByUserId?: string;
}) {
  try {
    const doc = await basePrisma.admissionsDocument.findUnique({
      where: { id: documentId },
      include: { application: true },
    });

    if (!doc) {
      return { success: false, error: "Document not found." };
    }

    if (doc.application.schoolId !== schoolId && doc.tenantId !== schoolId) {
      return { success: false, error: "403 Forbidden: Cross-tenant modification rejected." };
    }

    const fullReasonText = customNotes ? `${reason}: ${customNotes}` : reason;

    const updated = await basePrisma.admissionsDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: "REJECTED",
        rejectionReason: fullReasonText,
        verifiedByUserId,
        verifiedAt: new Date(),
      },
    });

    // Update application status to ACTION_REQUIRED
    await basePrisma.admissionsApplication.update({
      where: { id: doc.applicationId },
      data: {
        status: "ACTION_REQUIRED",
      },
    });

    const school = await basePrisma.school.findFirst({
      where: { id: doc.application.schoolId },
      select: { name: true, subdomain: true },
    });

    const host = process.env.NEXTAUTH_URL || "https://schoolerp.ng";
    const reuploadLink = `${host}/${school?.subdomain || "portal"}/admissions/upload/${doc.applicationId}?docId=${documentId}`;

    // Automatically trigger real-time WhatsApp & Email notification to re-upload within 72 hours
    await dispatchAdmissionsNotification({
      tenantId: doc.tenantId,
      schoolName: school?.name || "School ERP",
      applicantNumber: doc.application.applicationNumber,
      recipient: {
        name: `${doc.application.firstName} ${doc.application.lastName}`,
        email: doc.application.email,
        phone: doc.application.phoneNumber,
        whatsappNumber: doc.application.whatsappNumber || doc.application.phoneNumber,
      },
      event: "DOCUMENT_REJECTED",
      rejectedDocumentType: doc.documentType.replace(/_/g, " "),
      rejectionReason: fullReasonText,
      reuploadLink,
    }).catch((notifErr) => {
      console.warn("[DOCUMENT_REJECTION_NOTIF_WARN]:", notifErr);
    });

    revalidatePath("/[schoolDomain]/admissions/verification", "page");
    return { success: true, document: updated, reuploadLink };
  } catch (error: any) {
    console.error("[rejectAdmissionsDocument error]:", error);
    return { success: false, error: error.message || "Failed to reject document." };
  }
}
