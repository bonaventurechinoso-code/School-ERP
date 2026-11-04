import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import ApplicantUploadClient from "./ApplicantUploadClient";
import { ShieldAlert, PhoneCall, Building2 } from "lucide-react";
import { cookies } from "next/headers";
import * as jose from "jose";

export default async function ApplicantUploadPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string; applicantId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { schoolDomain, applicantId } = await paramsPromise;
  const { token } = await searchParamsPromise;

  // 1. Resolve tenant school
  const school = await basePrisma.school.findFirst({
    where: { OR: [{ subdomain: schoolDomain }, { slug: schoolDomain }, { id: schoolDomain }] },
    select: { id: true, name: true, subdomain: true, contactPhone: true },
  });

  if (!school) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800">Institution Not Found</h1>
          <p className="text-sm text-slate-500 mt-2">The school link you followed could not be identified.</p>
        </div>
      </div>
    );
  }

  // 2. Resolve applicant: Check admissionLead first, then modern admissionsApplication, then admissionRegister fallback
  let lead = await basePrisma.admissionLead.findFirst({
    where: {
      schoolId: school.id,
      OR: [
        { id: applicantId },
        { uploadToken: applicantId },
        ...(token ? [{ uploadToken: token }, { id: token }] : []),
      ],
    },
    include: { tier: true },
  });

  let appRecord: any = null;
  if (!lead) {
    appRecord = await basePrisma.admissionsApplication.findFirst({
      where: {
        schoolId: school.id,
        OR: [
          { id: applicantId },
          { applicationNumber: applicantId },
          ...(token ? [{ id: token }, { applicationNumber: token }] : []),
        ],
      },
      include: {
        documents: true,
        feeTransactions: true,
      },
    });

    if (appRecord) {
      // Check if linked lead exists
      lead = await basePrisma.admissionLead.findFirst({
        where: {
          schoolId: school.id,
          OR: [
            { id: appRecord.id },
            ...(appRecord.email ? [{ studentEmail: appRecord.email }, { parentEmail: appRecord.email }] : []),
            ...(appRecord.phoneNumber ? [{ parentPhone: appRecord.phoneNumber }, { parentContact: appRecord.phoneNumber }] : []),
          ],
        },
        include: { tier: true },
      });

      // If still no lead record, synthesize client profile from admissionsApplication
      if (!lead) {
        const appMeta = (appRecord.metadata as any) || {};
        const tierData = (appRecord.tierSpecificData as any) || {};
        const docsMap: Record<string, any> = { ...(appMeta.documents || {}) };

        // Populate from appRecord.documents relations
        if (Array.isArray(appRecord.documents)) {
          for (const d of appRecord.documents) {
            const key = d.documentType === "PASSPORT_PHOTOGRAPH"
              ? "passportPhoto"
              : d.documentType === "ACADEMIC_TRANSCRIPT"
              ? "academicResults"
              : d.documentType === "BIRTH_CERTIFICATE"
              ? "birthCertificate"
              : d.documentType === "MEDICAL_REPORT"
              ? "medicalRecords"
              : d.documentType === "NIN_SLIP"
              ? "ninSlip"
              : d.documentType.toLowerCase();

            docsMap[key] = {
              url: d.storageKey,
              fileUrl: d.storageKey,
              name: d.documentType,
              status: d.verificationStatus,
            };
          }
        }

        const feeTx = appRecord.feeTransactions?.[0];
        if (feeTx?.proofOfPaymentUrl) {
          docsMap.applicationFeeReceiptUrl = feeTx.proofOfPaymentUrl;
          docsMap.formFeeReceiptUrl = feeTx.proofOfPaymentUrl;
          docsMap.formFeeStatus = feeTx.paymentStatus;
          docsMap.formFeePaid = feeTx.paymentStatus === "VERIFIED" || feeTx.paymentStatus === "PAID";
        }

        lead = {
          id: appRecord.id,
          schoolId: school.id,
          tierId: null,
          tier: null,
          applicantName: `${appRecord.firstName || ""} ${appRecord.lastName || ""}`.trim() || "Applicant",
          parentName: tierData.parentName || tierData.parent?.name || "Parent / Guardian",
          parentPhone: appRecord.phoneNumber,
          parentContact: appRecord.phoneNumber,
          studentEmail: appRecord.email,
          parentEmail: appRecord.email,
          targetGrade: appRecord.programId || tierData.targetGrade || "Selected Grade",
          status: appRecord.status || "APPLIED",
          documents: docsMap,
          logs: Array.isArray(appMeta.logs) ? appMeta.logs : [],
          uploadToken: appMeta.uploadToken || appRecord.id,
          uploadExpiresAt: null,
          passportPhotoUrl: docsMap.passportPhoto?.url || null,
          academicResultsUrl: docsMap.academicResults?.url || null,
          birthCertificateUrl: docsMap.birthCertificate?.url || null,
          medicalRecordsUrl: docsMap.medicalRecords?.url || null,
          ninSlipUrl: docsMap.ninSlip?.url || null,
          formFeePaid: feeTx?.paymentStatus === "VERIFIED" || feeTx?.paymentStatus === "PAID",
          applicationNo: appRecord.applicationNumber,
        } as any;
      }
    }
  }

  let registerRecord: any = null;
  if (!lead) {
    registerRecord = await basePrisma.admissionRegister.findFirst({
      where: {
        tenantId: school.id,
        OR: [
          { id: applicantId },
          { applicationNo: applicantId },
          ...(token ? [{ id: token }, { applicationNo: token }] : []),
        ],
      },
    });

    if (registerRecord) {
      // Check if linked lead exists
      lead = await basePrisma.admissionLead.findFirst({
        where: {
          schoolId: school.id,
          OR: [
            ...(registerRecord.email ? [{ studentEmail: registerRecord.email }, { parentEmail: registerRecord.email }] : []),
            ...(registerRecord.parentPhone ? [{ parentPhone: registerRecord.parentPhone }, { parentContact: registerRecord.parentPhone }] : []),
          ],
        },
        include: { tier: true },
      });

      // If still no lead record, synthesize client profile from admissionRegister
      if (!lead) {
        const credsJson: any = registerRecord.credentialsJson || {};
        const regToken = credsJson.uploadToken || credsJson.token;
        lead = {
          id: registerRecord.id,
          schoolId: school.id,
          tierId: null,
          tier: null,
          applicantName: `${registerRecord.firstName || ""} ${registerRecord.lastName || ""}`.trim() || "Applicant",
          parentName: "Parent / Guardian",
          parentPhone: registerRecord.parentPhone,
          parentContact: registerRecord.parentPhone,
          studentEmail: registerRecord.email,
          parentEmail: registerRecord.email,
          targetGrade: registerRecord.classApplied || "Primary 1",
          status: registerRecord.status?.toUpperCase() || "APPLIED",
          documents: typeof credsJson.documents === "object" ? credsJson.documents : (credsJson || {}),
          logs: Array.isArray(credsJson.statusLogs) ? credsJson.statusLogs : [],
          uploadToken: regToken || registerRecord.id,
          uploadExpiresAt: null,
          passportPhotoUrl: null,
          academicResultsUrl: null,
          birthCertificateUrl: null,
          medicalRecordsUrl: null,
          ninSlipUrl: null,
        } as any;
      }
    }
  }

  const leadAny = lead as any;
  const regCreds = registerRecord?.credentialsJson as any;
  const appMeta = (appRecord?.metadata as any) || (leadAny?.metadata as any) || {};

  // Flexible token authentication:
  // - Direct uploadToken match (from lead, admissionsApplication metadata, or admissionRegister)
  // - URL applicantId matches uploadToken
  // - Token matches applicationNo / record ID / applicantId
  // - Token matches applicant UUID (tokenized direct upload link)
  // - Admin token ("admin")
  const isDirectTokenMatch = Boolean(
    (token && leadAny?.uploadToken && leadAny.uploadToken === token) ||
    (token && appMeta?.uploadToken && appMeta.uploadToken === token) ||
    (token && regCreds?.uploadToken && regCreds.uploadToken === token) ||
    (token && (
      leadAny?.id === token ||
      registerRecord?.id === token ||
      registerRecord?.applicationNo === token ||
      appRecord?.id === token ||
      appRecord?.applicationNumber === token ||
      applicantId === token
    )) ||
    (token && token === "admin") ||
    (applicantId && token && applicantId.replace(/-/g, "") === token.replace(/-/g, ""))
  );
  const isUrlApplicantIdSelfAuthenticating = Boolean(
    (leadAny?.uploadToken && applicantId === leadAny.uploadToken) ||
    (appMeta?.uploadToken && applicantId === appMeta.uploadToken) ||
    (regCreds?.uploadToken && applicantId === regCreds.uploadToken)
  );
  const isTokenValid = Boolean(
    lead && (
      isDirectTokenMatch ||
      isUrlApplicantIdSelfAuthenticating ||
      (token && (token === applicantId || token === leadAny?.id || token === appRecord?.id))
    )
  );
  const isTokenExpired = Boolean(leadAny?.uploadExpiresAt && new Date(leadAny.uploadExpiresAt) < new Date());

  // Allow authorization via active guest applicant or tenant session cookie as fallback
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value || cookieStore.get("accessToken")?.value;
  let sessionAuthorized = false;
  if (sessionToken) {
    try {
      const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jose.jwtVerify(sessionToken, secret);
      if (
        payload.leadId === applicantId ||
        payload.userId === applicantId ||
        payload.tenantId === school.id ||
        payload.applicationId === applicantId ||
        (payload.uploadToken && (payload.uploadToken === leadAny?.uploadToken || payload.uploadToken === appMeta?.uploadToken)) ||
        payload.isGuestApplicant
      ) {
        sessionAuthorized = true;
      }
    } catch {}
  }

  const isAuthorized = (isTokenValid || sessionAuthorized) && !isTokenExpired;
  const effectiveToken = token || leadAny?.uploadToken || appMeta?.uploadToken || applicantId;

  // 3. Security Guard: Token / Session validation
  if (!lead || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
        <div className="max-w-lg w-full bg-white dark:bg-zinc-900 p-8 sm:p-10 rounded-2xl shadow-md border border-rose-100 dark:border-rose-950/40 text-center animate-in fade-in">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {isTokenExpired ? "Upload Link Expired" : "Access Denied"}
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2.5 leading-relaxed">
            {isTokenExpired
              ? "This secure credential upload link has expired for security reasons. Please reach out to the admissions office to receive a fresh submission link."
              : "No valid applicant authorization token or session was found. Please use the direct link provided in your admissions email."}
          </p>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
            <PhoneCall className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Admissions Desk: {school.contactPhone || "+234 (0) 800-SCHOOL-ERP"}</span>
          </div>
        </div>
      </div>
    );
  }

  // 4. Determine Fee Payment Finite State (UNPAID -> PENDING -> PAID)
  const docs = (leadAny.documents as any) || (regCreds?.documents as any) || (regCreds as any) || {};
  const isPaid = Boolean(
    docs.formFeePaid === true ||
    docs.feePaid === true ||
    leadAny.formFeePaid === true ||
    regCreds?.formFeePaid === true ||
    docs.formFeeStatus === "PAID" ||
    docs.paymentStatus === "PAID" ||
    docs.paymentState === "SETTLED" ||
    lead.status === "APPROVED" ||
    lead.status === "ENROLLED"
  );
  const isPending = Boolean(
    !isPaid && (
      docs.formFeeStatus === "PENDING" ||
      docs.formFeeStatus === "PENDING_VERIFICATION" ||
      docs.paymentState === "PAYMENT_PENDING_REVIEW" ||
      docs.applicationFeeReceiptUrl ||
      docs.formFeeReceiptUrl ||
      docs.paymentReceiptUrl ||
      docs.applicationFeeReceipt?.url ||
      docs.paymentReceipt?.url ||
      (Array.isArray(docs.documents) && docs.documents.some((d: any) =>
        (d.key === "applicationFeeReceipt" || d.type === "applicationFeeReceipt" || d.key === "paymentReceipt" || d.type === "PAYMENT_RECEIPT")
      ))
    )
  );
  const feeState: "UNPAID" | "PENDING" | "PAID" = isPaid ? "PAID" : isPending ? "PENDING" : "UNPAID";
  const existingFeeReceiptUrl =
    docs.applicationFeeReceiptUrl ||
    docs.formFeeReceiptUrl ||
    docs.paymentReceiptUrl ||
    docs.applicationFeeReceipt?.url ||
    docs.paymentReceipt?.url ||
    null;
  const applicationNo = registerRecord?.applicationNo || (lead as any).applicationNo || `APP-${lead.id.slice(0, 6).toUpperCase()}`;

  // 5. Render interactive client portal
  return (
    <ApplicantUploadClient
      schoolDomain={schoolDomain}
      schoolName={school.name}
      contactPhone={school.contactPhone}
      applicantId={lead.id}
      token={effectiveToken}
      applicantName={lead.applicantName}
      parentName={lead.parentName || "Parent / Guardian"}
      targetGrade={lead.targetGrade}
      tierName={lead.tier?.name || "Standard Tier"}
      status={lead.status}
      applicationNo={applicationNo}
      feeState={feeState}
      existingFeeReceiptUrl={existingFeeReceiptUrl}
      existingDocuments={leadAny.documents || {}}
      existingPassportUrl={leadAny.passportPhotoUrl}
      existingAcademicResultsUrl={leadAny.academicResultsUrl}
      existingBirthCertificateUrl={leadAny.birthCertificateUrl}
      existingMedicalRecordsUrl={leadAny.medicalRecordsUrl}
      existingNinSlipUrl={leadAny.ninSlipUrl || (leadAny.documents?.ninSlip?.url || leadAny.documents?.ninSlip?.fileUrl || null)}
    />
  );
}
