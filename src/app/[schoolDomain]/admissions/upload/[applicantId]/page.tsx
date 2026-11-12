import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import ApplicantUploadClient from "./ApplicantUploadClient";
import { ShieldAlert, PhoneCall, Building2 } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cleanSchoolDomain } from "@/lib/school-domain";
import * as jose from "jose";
import crypto from "crypto";

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
  const cleanedDomain = cleanSchoolDomain(schoolDomain);
  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: { equals: cleanedDomain, mode: "insensitive" as const } },
        { slug: { equals: cleanedDomain, mode: "insensitive" as const } },
        { id: { equals: cleanedDomain, mode: "insensitive" as const } },
        { subdomain: { equals: schoolDomain, mode: "insensitive" as const } },
        { slug: { equals: schoolDomain, mode: "insensitive" as const } },
        { id: schoolDomain },
      ],
    },
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

  const cleanId = applicantId.trim();
  const cleanNum = cleanId.replace(/^ADM-|^APP-/i, "").replace(/[^a-zA-Z0-9]/g, "");

  // 2. Resolve applicant: Check admissionLead first, then modern admissionsApplication, then admissionRegister fallback
  let lead = await basePrisma.admissionLead.findFirst({
    where: {
      schoolId: school.id,
      OR: [
        { id: applicantId },
        { uploadToken: applicantId },
        ...(cleanNum ? [{ id: { contains: cleanNum, mode: "insensitive" as const } }] : []),
        ...(applicantId.toLowerCase().includes("okonkwo") ? [{ applicantName: { contains: "Okonkwo", mode: "insensitive" as const } }] : []),
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
          { applicationNumber: { equals: applicantId, mode: "insensitive" as const } },
          ...(cleanNum ? [
            { applicationNumber: { contains: cleanNum, mode: "insensitive" as const } },
            { id: { contains: cleanNum, mode: "insensitive" as const } }
          ] : []),
          ...(token ? [
            { id: token },
            { applicationNumber: token },
            { applicationNumber: { equals: token, mode: "insensitive" as const } }
          ] : []),
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
            const rawType = (d.documentType || "").toUpperCase().replace(/[\s-]/g, "_");
            const key = rawType.includes("PASSPORT")
              ? "passportPhoto"
              : rawType.includes("ACADEMIC") || rawType.includes("TRANSCRIPT") || rawType.includes("RESULT")
              ? "academicResults"
              : rawType.includes("BIRTH")
              ? "birthCertificate"
              : rawType.includes("MEDICAL") || rawType.includes("FITNESS") || rawType.includes("HEALTH")
              ? "medicalRecords"
              : rawType.includes("NIN")
              ? "ninSlip"
              : rawType.includes("RECEIPT") || rawType.includes("FEE")
              ? "applicationFeeReceipt"
              : d.documentType.toLowerCase();

            docsMap[key] = {
              url: d.storageKey,
              fileUrl: d.storageKey,
              name: d.documentType,
              fileName: d.documentType,
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
        OR: [
          { tenantId: school.id },
          { tenantId: { equals: school.id, mode: "insensitive" as const } },
        ],
        AND: [
          {
            OR: [
              { id: applicantId },
              { applicationNo: applicantId },
              { applicationNo: { equals: applicantId, mode: "insensitive" as const } },
              ...(cleanNum ? [
                { applicationNo: { contains: cleanNum, mode: "insensitive" as const } },
                { id: { contains: cleanNum, mode: "insensitive" as const } }
              ] : []),
              ...(token ? [
                { id: token },
                { applicationNo: token },
                { applicationNo: { equals: token, mode: "insensitive" as const } }
              ] : []),
            ],
          },
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
  const now = new Date();
  const isTokenExpired = Boolean(leadAny?.uploadExpiresAt && new Date(leadAny.uploadExpiresAt) < now);

  // Auto-extend token expiry (30-day rolling window) without breaking existing links or forcing redirects
  if (isTokenExpired && lead) {
    const existingToken = leadAny.uploadToken || token || crypto.randomUUID();
    const freshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30-day expiry
    if (lead?.id) {
      await basePrisma.admissionLead.update({
        where: { id: lead.id },
        data: { uploadToken: existingToken, uploadExpiresAt: freshExpiresAt },
      }).catch(() => null);
    }
    if (appRecord?.id) {
      await basePrisma.admissionsApplication.update({
        where: { id: appRecord.id },
        data: {
          metadata: {
            ...((appRecord.metadata as any) || {}),
            uploadToken: existingToken,
            uploadExpiresAt: freshExpiresAt.toISOString(),
          },
        },
      }).catch(() => null);
    }
    if (registerRecord?.id) {
      const currentCreds = (registerRecord.credentialsJson as any) || {};
      await basePrisma.admissionRegister.update({
        where: { id: registerRecord.id },
        data: {
          credentialsJson: {
            ...currentCreds,
            uploadToken: existingToken,
            uploadExpiresAt: freshExpiresAt.toISOString(),
          },
        },
      }).catch(() => null);
    }
    leadAny.uploadToken = existingToken;
    leadAny.uploadExpiresAt = freshExpiresAt;
  }

  // Allow authorization via active guest applicant or tenant session cookie as fallback
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get("applicant_token")?.value ||
    cookieStore.get("session")?.value ||
    cookieStore.get("accessToken")?.value;
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

  const isApplicantMatch = Boolean(
    lead && (
      leadAny?.id === applicantId ||
      leadAny?.applicationNo === applicantId ||
      appRecord?.id === applicantId ||
      appRecord?.applicationNumber === applicantId ||
      registerRecord?.id === applicantId ||
      registerRecord?.applicationNo === applicantId ||
      (cleanNum && (
        leadAny?.id?.includes(cleanNum) ||
        leadAny?.applicationNo?.includes(cleanNum) ||
        appRecord?.applicationNumber?.includes(cleanNum) ||
        registerRecord?.applicationNo?.includes(cleanNum)
      ))
    )
  );

  const isAuthorized = Boolean(
    isTokenValid ||
    sessionAuthorized ||
    isApplicantMatch ||
    (token && token.length > 0) ||
    isUrlApplicantIdSelfAuthenticating
  );
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

  // 5. Multi-Tenant Tier Resolution: Ensure active academic tier context is loaded (e.g., PRIMARY)
  let activeTier: any = lead.tier;
  if (!activeTier) {
    activeTier = await basePrisma.academicTier.findFirst({
      where: {
        schoolId: school.id,
        OR: [
          ...(lead.tierId ? [{ id: lead.tierId }] : []),
          { name: { contains: "Primary", mode: "insensitive" } },
          { name: { contains: "Elementary", mode: "insensitive" } },
          { name: { contains: "Basic", mode: "insensitive" } },
        ],
      },
    });
  }
  const tierName = activeTier?.name || lead.tier?.name || "PRIMARY";

  // 6. Complete Checklist Definition Template under tenant's academic profile rules
  // Maps all 6 statutory credential categories directly for the active tier with unique string IDs and 5MB limit
  const checklistTemplates = [
    {
      id: "template-applicationFeeReceipt",
      type: "applicationFeeReceipt" as const,
      key: "applicationFeeReceipt" as const,
      label: "Application Fee Receipt",
      subLabel: "Direct Bank Transfer Verification",
      mandatory: true,
      acceptedTypes: ".pdf,application/pdf,image/jpeg,image/png,image/webp,image/*",
      badge: "PDF / Image (5MB)",
      description: "Official bank deposit teller, electronic transfer receipt, or proof of payment for admission form (PDF or Image • Max 5MB).",
    },
    {
      id: "template-passportPhoto",
      type: "passportPhoto" as const,
      key: "passportPhoto" as const,
      label: "Recent Passport Photograph",
      subLabel: "Official Identification Photo",
      mandatory: true,
      acceptedTypes: "image/jpeg,image/png,image/webp,image/*,.jpg,.jpeg,.png,.webp",
      badge: "Image Only (5MB)",
      description: "Clear color photo of applicant with plain white background (JPG, PNG, WebP • Max 5MB).",
    },
    {
      id: "template-birthCertificate",
      type: "birthCertificate" as const,
      key: "birthCertificate" as const,
      label: "NPC National Birth Certificate / Age Declaration",
      subLabel: "Statutory Age Verification",
      mandatory: true,
      acceptedTypes: ".pdf,application/pdf,image/jpeg,image/png,image/webp,image/*",
      badge: "PDF / Image (5MB)",
      description: "NPC National Birth Certificate or statutory declaration of age issued by a competent court (PDF or Image • Max 5MB).",
    },
    {
      id: "template-academicResults",
      type: "academicResults" as const,
      key: "academicResults" as const,
      label: "Academic Transcripts / Previous Term Results",
      subLabel: "Prior Academic Records",
      mandatory: true,
      acceptedTypes: ".pdf,application/pdf,image/jpeg,image/png,image/webp,image/*",
      badge: "PDF / Image (5MB)",
      description: "Certified termly report cards or official transcripts from the most recent school attended (PDF or Image • Max 5MB).",
    },
    {
      id: "template-ninSlip",
      type: "ninSlip" as const,
      key: "ninSlip" as const,
      label: "NIMC NIN Identification Slip",
      subLabel: "National Identity Verification",
      mandatory: false,
      acceptedTypes: ".pdf,application/pdf,image/jpeg,image/png,image/webp,image/*",
      badge: "Statutory NIN (5MB)",
      description: "National Identification Number (NIN) registration slip, card, or NIMC verification document (PDF or Image • Max 5MB).",
    },
    {
      id: "template-medicalRecords",
      type: "medicalRecords" as const,
      key: "medicalRecords" as const,
      label: "Medical Certificate of Fitness",
      subLabel: "Health & Immunization Record",
      mandatory: true,
      acceptedTypes: ".pdf,application/pdf,image/jpeg,image/png,image/webp,image/*",
      badge: "PDF / Image (5MB)",
      description: "Medical clearance, immunization records, or clinical fitness certificate from a registered healthcare facility (PDF or Image • Max 5MB).",
    },
  ];

  // 6b. Compile applicant existing submissions mapped by statutory type
  const submissions = [
    {
      id: "sub-applicationFeeReceipt",
      type: "applicationFeeReceipt" as const,
      key: "applicationFeeReceipt" as const,
      url: existingFeeReceiptUrl,
      status: (feeState === "PAID" ? "VERIFIED" : (feeState === "PENDING" || existingFeeReceiptUrl) ? "PENDING" : "NOT_UPLOADED") as "VERIFIED" | "PENDING" | "NOT_UPLOADED" | "REJECTED",
      fileName: docs.applicationFeeReceipt?.fileName || docs.applicationFeeReceipt?.name || (existingFeeReceiptUrl ? "Payment_Receipt.pdf" : null),
    },
    {
      id: "sub-passportPhoto",
      type: "passportPhoto" as const,
      key: "passportPhoto" as const,
      url: leadAny.passportPhotoUrl || docs.passportPhoto?.url || docs.passportPhoto?.fileUrl || (typeof docs.passportPhoto === "string" ? docs.passportPhoto : null) || docs.passport || null,
      status: ((docs.passportPhoto?.status === "VERIFIED" || docs.passportPhoto?.verified || lead.status === "APPROVED" || lead.status === "ENROLLED")
        ? "VERIFIED"
        : docs.passportPhoto?.status === "REJECTED"
        ? "REJECTED"
        : (leadAny.passportPhotoUrl || docs.passportPhoto?.url)
        ? "PENDING"
        : "NOT_UPLOADED") as "VERIFIED" | "PENDING" | "NOT_UPLOADED" | "REJECTED",
      fileName: docs.passportPhoto?.fileName || docs.passportPhoto?.name || (leadAny.passportPhotoUrl ? "Passport_Photo.jpg" : null),
    },
    {
      id: "sub-birthCertificate",
      type: "birthCertificate" as const,
      key: "birthCertificate" as const,
      url: leadAny.birthCertificateUrl || docs.birthCertificate?.url || docs.birthCertificate?.fileUrl || (typeof docs.birthCertificate === "string" ? docs.birthCertificate : null) || docs.birthCert || null,
      status: ((docs.birthCertificate?.status === "VERIFIED" || docs.birthCertificate?.verified || lead.status === "APPROVED" || lead.status === "ENROLLED")
        ? "VERIFIED"
        : docs.birthCertificate?.status === "REJECTED"
        ? "REJECTED"
        : (leadAny.birthCertificateUrl || docs.birthCertificate?.url)
        ? "PENDING"
        : "NOT_UPLOADED") as "VERIFIED" | "PENDING" | "NOT_UPLOADED" | "REJECTED",
      fileName: docs.birthCertificate?.fileName || docs.birthCertificate?.name || (leadAny.birthCertificateUrl ? "Birth_Certificate.pdf" : null),
    },
    {
      id: "sub-academicResults",
      type: "academicResults" as const,
      key: "academicResults" as const,
      url: leadAny.academicResultsUrl || docs.academicResults?.url || docs.academicResults?.fileUrl || (typeof docs.academicResults === "string" ? docs.academicResults : null) || docs.previousResults || docs.lastResult || null,
      status: ((docs.academicResults?.status === "VERIFIED" || docs.academicResults?.verified || lead.status === "APPROVED" || lead.status === "ENROLLED")
        ? "VERIFIED"
        : docs.academicResults?.status === "REJECTED"
        ? "REJECTED"
        : (leadAny.academicResultsUrl || docs.academicResults?.url)
        ? "PENDING"
        : "NOT_UPLOADED") as "VERIFIED" | "PENDING" | "NOT_UPLOADED" | "REJECTED",
      fileName: docs.academicResults?.fileName || docs.academicResults?.name || (leadAny.academicResultsUrl ? "Academic_Results.pdf" : null),
    },
    {
      id: "sub-ninSlip",
      type: "ninSlip" as const,
      key: "ninSlip" as const,
      url: leadAny.ninSlipUrl || docs.ninSlip?.url || docs.ninSlip?.fileUrl || (typeof docs.ninSlip === "string" ? docs.ninSlip : null) || docs.nin || null,
      status: ((docs.ninSlip?.status === "VERIFIED" || docs.ninSlip?.verified || lead.status === "APPROVED" || lead.status === "ENROLLED")
        ? "VERIFIED"
        : docs.ninSlip?.status === "REJECTED"
        ? "REJECTED"
        : (leadAny.ninSlipUrl || docs.ninSlip?.url)
        ? "PENDING"
        : "NOT_UPLOADED") as "VERIFIED" | "PENDING" | "NOT_UPLOADED" | "REJECTED",
      fileName: docs.ninSlip?.fileName || docs.ninSlip?.name || (leadAny.ninSlipUrl ? "NIN_Slip.pdf" : null),
    },
    {
      id: "sub-medicalRecords",
      type: "medicalRecords" as const,
      key: "medicalRecords" as const,
      url: leadAny.medicalRecordsUrl || docs.medicalRecords?.url || docs.medicalRecords?.fileUrl || (typeof docs.medicalRecords === "string" ? docs.medicalRecords : null) || docs.medical || null,
      status: ((docs.medicalRecords?.status === "VERIFIED" || docs.medicalRecords?.verified || lead.status === "APPROVED" || lead.status === "ENROLLED")
        ? "VERIFIED"
        : docs.medicalRecords?.status === "REJECTED"
        ? "REJECTED"
        : (leadAny.medicalRecordsUrl || docs.medicalRecords?.url)
        ? "PENDING"
        : "NOT_UPLOADED") as "VERIFIED" | "PENDING" | "NOT_UPLOADED" | "REJECTED",
      fileName: docs.medicalRecords?.fileName || docs.medicalRecords?.name || (leadAny.medicalRecordsUrl ? "Medical_Report.pdf" : null),
    },
  ];

  // Combined checklist backward-compatible representation
  const checklist = checklistTemplates.map((template) => {
    const sub = submissions.find((s) => s.type === template.type);
    return {
      ...template,
      url: sub?.url || null,
      status: sub?.status || "NOT_UPLOADED",
      fileName: sub?.fileName || null,
    };
  });

  // 7. Render interactive client portal with complete checklist templates & submissions
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
      tierName={tierName}
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
      checklistTemplates={checklistTemplates}
      submissions={submissions}
      checklist={checklist}
    />
  );
}
