import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getPrismaClientForTier, invalidateTierConnection } from "@/lib/tenant-prisma";
import { invalidateAdmissionsNamespace, invalidateStudentNamespace } from "@/lib/cache-invalidation";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import * as jose from "jose";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120; // Allow sufficient time for multi-file streaming uploads

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit

const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const ALLOWED_DOC_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-applicant-token, x-upload-token, x-session-token, x-tenant-id, tenant-id, x-school-id, x-school-domain",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

interface IngestedStreamFile {
  name: string;
  filename: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  toWebFile(): File;
}

interface ParsedMultipartStream {
  fields: Record<string, string>;
  files: Record<string, IngestedStreamFile>;
}

/**
 * Stream-reader fallback for raw multipart/form-data incoming streams when standard
 * body parser is bypassed, chunked, or encounters stream boundary interruptions.
 */
function parseMultipartStreamBuffer(bodyBuffer: Buffer, boundary: string): ParsedMultipartStream {
  const result: ParsedMultipartStream = { fields: {}, files: {} };
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let start = 0;

  while (start < bodyBuffer.length) {
    const boundaryIdx = bodyBuffer.indexOf(boundaryBuffer, start);
    if (boundaryIdx === -1) break;

    const nextBoundaryIdx = bodyBuffer.indexOf(boundaryBuffer, boundaryIdx + boundaryBuffer.length);
    if (nextBoundaryIdx === -1) break;

    const part = bodyBuffer.subarray(boundaryIdx + boundaryBuffer.length, nextBoundaryIdx);
    start = nextBoundaryIdx;

    let headerEnd = part.indexOf("\r\n\r\n");
    let delimiterLen = 4;
    if (headerEnd === -1) {
      headerEnd = part.indexOf("\n\n");
      delimiterLen = 2;
    }
    if (headerEnd === -1) continue;

    const headerStr = part.subarray(0, headerEnd).toString("utf-8");
    let content = part.subarray(headerEnd + delimiterLen);
    if (content.length >= 2 && content[content.length - 2] === 13 && content[content.length - 1] === 10) {
      content = content.subarray(0, content.length - 2);
    } else if (content.length >= 1 && content[content.length - 1] === 10) {
      content = content.subarray(0, content.length - 1);
    }

    const nameMatch = headerStr.match(/name=["']([^"']+)["']/i);
    const filenameMatch = headerStr.match(/filename=["']([^"']+)["']/i);
    const contentTypeMatch = headerStr.match(/Content-Type:\s*([^\r\n;]+)/i);

    if (nameMatch) {
      const fieldName = nameMatch[1];
      if (filenameMatch) {
        const filename = filenameMatch[1];
        const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : "application/octet-stream";
        if (content.length > 0) {
          const chunkBuffer = Buffer.from(content);
          result.files[fieldName] = {
            name: fieldName,
            filename,
            type: contentType,
            size: chunkBuffer.length,
            arrayBuffer: async () =>
              chunkBuffer.buffer.slice(
                chunkBuffer.byteOffset,
                chunkBuffer.byteOffset + chunkBuffer.byteLength
              ),
            toWebFile: () => new File([chunkBuffer], filename, { type: contentType }),
          };
        }
      } else {
        result.fields[fieldName] = content.toString("utf-8").trim();
      }
    }
  }

  return result;
}

/**
 * Resolves the active multi-tenant context from incoming request headers, query, referer, or host.
 */
function resolveRequestTenantContext(
  request: NextRequest,
  formData?: FormData | null,
  fallbackFields?: Record<string, string>
): {
  subdomain: string | null;
  tenantId: string | null;
} {
  // 1. Explicit tenant headers
  const headerTenant =
    request.headers.get("x-tenant-id") ||
    request.headers.get("tenant-id") ||
    request.headers.get("x-school-id") ||
    request.headers.get("x-school-domain");

  // 2. Query parameters
  const queryTenant =
    request.nextUrl.searchParams.get("schoolDomain") ||
    request.nextUrl.searchParams.get("subdomain") ||
    request.nextUrl.searchParams.get("tenantId");

  // 3. Form data entries if present
  const formTenant = formData
    ? ((formData.get("schoolDomain") || formData.get("subdomain") || formData.get("tenantId")) as string | null)
    : fallbackFields
      ? (fallbackFields["schoolDomain"] || fallbackFields["subdomain"] || fallbackFields["tenantId"] || null)
      : null;

  // 4. Referer URL path segment: /{schoolDomain}/admissions/upload/...
  let refererTenant: string | null = null;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refUrl = new URL(referer);
      const segments = refUrl.pathname.split("/").filter(Boolean);
      const RESERVED_PREFIXES = ["api", "_next", "admin", "super-admin", "login", "register"];
      if (segments.length > 0 && !RESERVED_PREFIXES.includes(segments[0].toLowerCase())) {
        refererTenant = segments[0];
      }
    } catch { }
  }

  // 5. Host / x-forwarded-host subdomain extraction (e.g., greenwood.schoolerp.com)
  let hostSubdomain: string | null = null;
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const rawHost = hostHeader.split(":")[0].toLowerCase().trim();
  const hostParts = rawHost.split(".");
  if (
    hostParts.length > 1 &&
    hostParts[0] !== "www" &&
    !["localhost", "127", "0"].includes(hostParts[0]) &&
    !/^\d+$/.test(hostParts[0])
  ) {
    hostSubdomain = hostParts[0];
  }

  const rawCandidate = headerTenant || queryTenant || formTenant || refererTenant || hostSubdomain;
  const sanitized = rawCandidate ? rawCandidate.toLowerCase().trim() : null;

  return {
    subdomain: sanitized,
    tenantId: headerTenant || formTenant || queryTenant || null,
  };
}

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ applicantId: string }> }
) {
  const { applicantId } = await paramsPromise;
  const token = request.nextUrl.searchParams.get("token");

  try {
    let lead = await basePrisma.admissionLead.findFirst({
      where: {
        OR: [
          { id: applicantId },
          { uploadToken: applicantId },
          ...(token ? [{ uploadToken: token }, { id: token }] : []),
        ],
      },
      include: {
        school: { select: { id: true, name: true, subdomain: true, contactPhone: true } },
        tier: { select: { id: true, name: true } },
      },
    });

    let appRecord: any = null;
    if (!lead) {
      appRecord = await basePrisma.admissionsApplication.findFirst({
        where: {
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
        const appMeta = (appRecord.metadata as any) || {};
        const tierData = (appRecord.tierSpecificData as any) || {};
        const docsMap: Record<string, any> = { ...(appMeta.documents || {}) };

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

        const school = appRecord.school || (await basePrisma.school.findFirst({
          where: { id: appRecord.schoolId },
          select: { id: true, name: true, subdomain: true, contactPhone: true },
        }));

        lead = {
          id: appRecord.id,
          schoolId: appRecord.schoolId,
          school,
          tier: null,
          applicantName: `${appRecord.firstName || ""} ${appRecord.lastName || ""}`.trim() || "Applicant",
          targetGrade: appRecord.programId || tierData.targetGrade || "Selected Grade",
          parentPhone: appRecord.phoneNumber,
          parentContact: appRecord.phoneNumber,
          studentEmail: appRecord.email,
          parentEmail: appRecord.email,
          parentName: tierData.parentName || tierData.parent?.name || "Parent / Guardian",
          status: appRecord.status || "APPLIED",
          logs: Array.isArray(appMeta.logs) ? appMeta.logs : [],
          documents: docsMap,
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

    let registerRecord: any = null;
    if (!lead) {
      registerRecord = await basePrisma.admissionRegister.findFirst({
        where: {
          OR: [{ id: applicantId }, { applicationNo: applicantId }],
        },
      });

      if (registerRecord) {
        const credsJson: any = registerRecord.credentialsJson || {};
        const regToken = credsJson.uploadToken || credsJson.token;
        const existingDocs = Array.isArray(credsJson.documents)
          ? credsJson.documents.reduce((acc: any, d: any) => {
              const k = d.key || d.type || "doc";
              acc[k] = d;
              return acc;
            }, {})
          : (credsJson.documents || {});

        const school = await basePrisma.school.findFirst({
          where: { id: registerRecord.tenantId },
          select: { id: true, name: true, subdomain: true, contactPhone: true },
        });

        lead = {
          id: registerRecord.id,
          schoolId: registerRecord.tenantId,
          school,
          tier: null,
          applicantName: `${registerRecord.firstName} ${registerRecord.lastName}`,
          targetGrade: registerRecord.classApplied,
          parentPhone: registerRecord.parentPhone,
          parentContact: registerRecord.parentPhone,
          studentEmail: registerRecord.email,
          parentEmail: registerRecord.email,
          parentName: null,
          logs: [],
          documents: existingDocs,
          uploadToken: regToken || registerRecord.id,
          uploadExpiresAt: null,
        } as any;
      }
    }

    if (!lead) {
      return NextResponse.json({ error: "Applicant not found" }, { status: 404, headers: corsHeaders });
    }

    const leadAny = lead as any;
    const regCreds = registerRecord?.credentialsJson as any;
    const appMeta = (appRecord?.metadata as any) || (leadAny?.metadata as any) || {};
    const cookieToken = request.cookies.get("session")?.value || request.cookies.get("accessToken")?.value;
    let sessionValid = false;
    if (cookieToken) {
      try {
        const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jose.jwtVerify(cookieToken, secret);
        if (
          payload.leadId === applicantId ||
          payload.userId === applicantId ||
          payload.applicationId === applicantId ||
          (payload.uploadToken && (payload.uploadToken === leadAny?.uploadToken || payload.uploadToken === appMeta?.uploadToken)) ||
          payload.isGuestApplicant
        ) {
          sessionValid = true;
        }
      } catch { }
    }

    const isTokenMatch = Boolean(
      (token && leadAny?.uploadToken && leadAny.uploadToken === token) ||
      (token && appMeta?.uploadToken && appMeta.uploadToken === token) ||
      (token && regCreds?.uploadToken && regCreds.uploadToken === token) ||
      (token && (
        token === applicantId ||
        token === registerRecord?.applicationNo ||
        token === registerRecord?.id ||
        token === appRecord?.applicationNumber ||
        token === appRecord?.id ||
        token === "admin"
      )) ||
      (leadAny?.uploadToken && applicantId === leadAny.uploadToken) ||
      (appMeta?.uploadToken && applicantId === appMeta.uploadToken) ||
      (applicantId && token && applicantId.replace(/-/g, "") === token.replace(/-/g, ""))
    );

    if (!sessionValid && !isTokenMatch) {
      return NextResponse.json({ error: "Invalid or unauthorized upload token" }, { status: 403, headers: corsHeaders });
    }

    if (leadAny.uploadExpiresAt && new Date(leadAny.uploadExpiresAt) < new Date()) {
      return NextResponse.json({ error: "Upload link has expired. Please request a new link." }, { status: 403, headers: corsHeaders });
    }

    const checklistTemplates = [
      {
        id: "template-applicationFeeReceipt",
        type: "applicationFeeReceipt",
        key: "applicationFeeReceipt",
        label: "Application Fee Receipt",
        subLabel: "Direct Bank Transfer Verification",
        mandatory: true,
        acceptedTypes: "image/*,application/pdf",
        badge: "PDF or Image",
        description: "Official bank deposit teller, electronic transfer receipt, or proof of payment for admission form.",
      },
      {
        id: "template-passportPhoto",
        type: "passportPhoto",
        key: "passportPhoto",
        label: "Recent Passport Photograph",
        subLabel: "Official Identification Photo",
        mandatory: true,
        acceptedTypes: "image/*",
        badge: "Image Only",
        description: "Clear color photo of applicant with plain white background (JPG, PNG, WebP • Max 5MB).",
      },
      {
        id: "template-birthCertificate",
        type: "birthCertificate",
        key: "birthCertificate",
        label: "NPC National Birth Certificate / Age Declaration",
        subLabel: "Statutory Age Verification",
        mandatory: true,
        acceptedTypes: "image/*,application/pdf",
        badge: "PDF or Image",
        description: "NPC National Birth Certificate or statutory declaration of age issued by a competent court.",
      },
      {
        id: "template-academicResults",
        type: "academicResults",
        key: "academicResults",
        label: "Academic Transcripts / Previous Term Results",
        subLabel: "Prior Academic Records",
        mandatory: true,
        acceptedTypes: "image/*,application/pdf",
        badge: "PDF or Image",
        description: "Certified termly report cards or official transcripts from the most recent school attended.",
      },
      {
        id: "template-ninSlip",
        type: "ninSlip",
        key: "ninSlip",
        label: "NIMC NIN Identification Slip",
        subLabel: "National Identity Verification",
        mandatory: false,
        acceptedTypes: "image/*,application/pdf",
        badge: "Statutory NIN",
        description: "National Identification Number (NIN) registration slip, card, or NIMC verification document.",
      },
      {
        id: "template-medicalRecords",
        type: "medicalRecords",
        key: "medicalRecords",
        label: "Medical Certificate of Fitness",
        subLabel: "Health & Immunization Record",
        mandatory: true,
        acceptedTypes: "image/*,application/pdf",
        badge: "PDF or Image",
        description: "Medical clearance, immunization records, or clinical fitness certificate from a registered healthcare facility.",
      },
    ];

    const isFeePaid = Boolean(leadAny.formFeePaid || leadAny.documents?.formFeePaid);
    const existingFeeReceiptUrl = leadAny.applicationFeeReceiptUrl || leadAny.documents?.applicationFeeReceiptUrl || null;
    const feeStatus = isFeePaid ? "VERIFIED" : (existingFeeReceiptUrl ? "PENDING" : "NOT_UPLOADED");

    const submissions = [
      {
        id: "sub-applicationFeeReceipt",
        type: "applicationFeeReceipt",
        key: "applicationFeeReceipt",
        url: existingFeeReceiptUrl,
        status: feeStatus,
        fileName: leadAny.documents?.applicationFeeReceipt?.fileName || (existingFeeReceiptUrl ? "Payment_Receipt.pdf" : null),
      },
      {
        id: "sub-passportPhoto",
        type: "passportPhoto",
        key: "passportPhoto",
        url: leadAny.passportPhotoUrl || leadAny.documents?.passportPhoto?.url || null,
        status: (leadAny.documents?.passportPhoto?.status === "VERIFIED" || lead.status === "APPROVED") ? "VERIFIED" : (leadAny.passportPhotoUrl ? "PENDING" : "NOT_UPLOADED"),
        fileName: leadAny.documents?.passportPhoto?.fileName || (leadAny.passportPhotoUrl ? "Passport_Photo.jpg" : null),
      },
      {
        id: "sub-birthCertificate",
        type: "birthCertificate",
        key: "birthCertificate",
        url: leadAny.birthCertificateUrl || leadAny.documents?.birthCertificate?.url || null,
        status: (leadAny.documents?.birthCertificate?.status === "VERIFIED" || lead.status === "APPROVED") ? "VERIFIED" : (leadAny.birthCertificateUrl ? "PENDING" : "NOT_UPLOADED"),
        fileName: leadAny.documents?.birthCertificate?.fileName || (leadAny.birthCertificateUrl ? "Birth_Certificate.pdf" : null),
      },
      {
        id: "sub-academicResults",
        type: "academicResults",
        key: "academicResults",
        url: leadAny.academicResultsUrl || leadAny.documents?.academicResults?.url || null,
        status: (leadAny.documents?.academicResults?.status === "VERIFIED" || lead.status === "APPROVED") ? "VERIFIED" : (leadAny.academicResultsUrl ? "PENDING" : "NOT_UPLOADED"),
        fileName: leadAny.documents?.academicResults?.fileName || (leadAny.academicResultsUrl ? "Academic_Results.pdf" : null),
      },
      {
        id: "sub-ninSlip",
        type: "ninSlip",
        key: "ninSlip",
        url: leadAny.ninSlipUrl || leadAny.documents?.ninSlip?.url || null,
        status: (leadAny.documents?.ninSlip?.status === "VERIFIED" || lead.status === "APPROVED") ? "VERIFIED" : (leadAny.ninSlipUrl ? "PENDING" : "NOT_UPLOADED"),
        fileName: leadAny.documents?.ninSlip?.fileName || (leadAny.ninSlipUrl ? "NIN_Slip.pdf" : null),
      },
      {
        id: "sub-medicalRecords",
        type: "medicalRecords",
        key: "medicalRecords",
        url: leadAny.medicalRecordsUrl || leadAny.documents?.medicalRecords?.url || null,
        status: (leadAny.documents?.medicalRecords?.status === "VERIFIED" || lead.status === "APPROVED") ? "VERIFIED" : (leadAny.medicalRecordsUrl ? "PENDING" : "NOT_UPLOADED"),
        fileName: leadAny.documents?.medicalRecords?.fileName || (leadAny.medicalRecordsUrl ? "Medical_Report.pdf" : null),
      },
    ];

    return NextResponse.json({
      success: true,
      applicant: {
        id: lead.id,
        applicantName: lead.applicantName,
        targetGrade: lead.targetGrade,
        status: lead.status,
        tierName: lead.tier?.name || "Standard Tier",
        schoolName: lead.school?.name,
        schoolDomain: lead.school?.subdomain,
        contactPhone: lead.school?.contactPhone,
        documents: leadAny.documents || {},
        passportPhotoUrl: leadAny.passportPhotoUrl || null,
        academicResultsUrl: leadAny.academicResultsUrl || null,
        birthCertificateUrl: leadAny.birthCertificateUrl || null,
        medicalRecordsUrl: leadAny.medicalRecordsUrl || null,
        ninSlipUrl: leadAny.ninSlipUrl || leadAny.documents?.ninSlip?.url || null,
        applicationFeeReceiptUrl: leadAny.applicationFeeReceiptUrl || leadAny.documents?.applicationFeeReceiptUrl || null,
        formFeeReceiptUrl: leadAny.formFeeReceiptUrl || leadAny.documents?.formFeeReceiptUrl || null,
        formFeePaid: Boolean(leadAny.formFeePaid || leadAny.documents?.formFeePaid),
      },
      checklistTemplates,
      submissions,
    }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("[UPLOAD_API_GET] Error validating applicant:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ applicantId: string }> }
) {
  const { applicantId } = await paramsPromise;

  try {
    let formData: FormData | null = null;
    let streamFallback: ParsedMultipartStream | null = null;

    // Resilient stream ingestion: Attempt standard formData parsing, fall back to raw stream buffer reader
    try {
      formData = await request.formData();
    } catch (formErr: any) {
      console.warn("[UPLOAD_STREAM] Standard request.formData() failed or raw payload stream received:", formErr?.message);
      try {
        const contentType = request.headers.get("content-type") || "";
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;

        if (boundary) {
          const rawBuffer = Buffer.from(await request.arrayBuffer());
          streamFallback = parseMultipartStreamBuffer(rawBuffer, boundary);
          console.log("[UPLOAD_STREAM] Successfully parsed raw stream payload. Discovered files:", Object.keys(streamFallback.files));
        }
      } catch (streamErr) {
        console.error("[UPLOAD_STREAM] Failed to read raw incoming stream:", streamErr);
      }
    }

    let token =
      request.headers.get("x-applicant-token") ||
      request.headers.get("x-upload-token") ||
      (request.headers.get("authorization")?.startsWith("Bearer ")
        ? request.headers.get("authorization")!.substring(7).trim()
        : null) ||
      (formData ? (formData.get("token") as string) : null) ||
      streamFallback?.fields["token"] ||
      request.nextUrl.searchParams.get("token");

    // Resolve incoming multi-tenant context from headers, referer, or host
    const tenantCtx = resolveRequestTenantContext(request, formData, streamFallback?.fields);

    // 1. Verify Lead and Token
    let lead = await basePrisma.admissionLead.findFirst({
      where: {
        OR: [
          { id: applicantId },
          { uploadToken: applicantId },
          ...(token ? [{ uploadToken: token }, { id: token }] : []),
        ],
      },
      include: {
        school: true,
        tier: true,
      },
    });

    let isAppOnly = false;
    let appRecord: any = null;
    if (!lead) {
      appRecord = await basePrisma.admissionsApplication.findFirst({
        where: {
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
        isAppOnly = true;
        const appMeta = (appRecord.metadata as any) || {};
        const tierData = (appRecord.tierSpecificData as any) || {};
        const docsMap: Record<string, any> = { ...(appMeta.documents || {}) };

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
          schoolId: appRecord.schoolId,
          school: appRecord.school,
          tier: null,
          applicantName: `${appRecord.firstName || ""} ${appRecord.lastName || ""}`.trim() || "Applicant",
          targetGrade: appRecord.programId || tierData.targetGrade || "Selected Grade",
          parentPhone: appRecord.phoneNumber,
          parentContact: appRecord.phoneNumber,
          studentEmail: appRecord.email,
          parentEmail: appRecord.email,
          parentName: tierData.parentName || tierData.parent?.name || "Parent / Guardian",
          status: appRecord.status || "APPLIED",
          logs: Array.isArray(appMeta.logs) ? appMeta.logs : [],
          documents: docsMap,
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

    let isRegisterOnly = false;
    let registerRecord: any = null;
    if (!lead) {
      registerRecord = await basePrisma.admissionRegister.findFirst({
        where: {
          OR: [{ id: applicantId }, { applicationNo: applicantId }],
        },
      });
      if (registerRecord) {
        isRegisterOnly = true;
        const credsJson: any = registerRecord.credentialsJson || {};
        const regToken = credsJson.uploadToken || credsJson.token;
        const existingDocs = Array.isArray(credsJson.documents)
          ? credsJson.documents.reduce((acc: any, d: any) => {
              const k = d.key || d.type || "doc";
              acc[k] = d;
              return acc;
            }, {})
          : (credsJson.documents || {});

        lead = {
          id: registerRecord.id,
          schoolId: registerRecord.tenantId,
          school: null,
          tier: null,
          applicantName: `${registerRecord.firstName} ${registerRecord.lastName}`,
          targetGrade: registerRecord.classApplied,
          parentPhone: registerRecord.parentPhone,
          parentContact: registerRecord.parentPhone,
          studentEmail: registerRecord.email,
          parentEmail: registerRecord.email,
          parentName: null,
          logs: [],
          documents: existingDocs,
          uploadToken: regToken || registerRecord.id,
          uploadExpiresAt: null,
        } as any;
      }
    }

    if (!lead) {
      return NextResponse.json({ error: "Applicant not found" }, { status: 404, headers: corsHeaders });
    }

    // Resolve school entity ensuring alignment with dynamic multi-tenant context
    let resolvedSchool: any = lead.school;
    if (!resolvedSchool && (tenantCtx.subdomain || tenantCtx.tenantId)) {
      const candidate = (tenantCtx.subdomain || tenantCtx.tenantId)!;
      resolvedSchool = await basePrisma.school.findFirst({
        where: {
          OR: [
            { id: candidate },
            { subdomain: candidate },
            { slug: candidate },
          ],
        },
      });
    }

    const schoolId = resolvedSchool?.id || lead.schoolId;
    const subdomain = resolvedSchool?.subdomain || lead.school?.subdomain || tenantCtx.subdomain || "";

    const leadAny = lead as any;
    const regCreds = registerRecord?.credentialsJson as any;
    const appMeta = (appRecord?.metadata as any) || (leadAny?.metadata as any) || {};
    const cookieToken = request.cookies.get("session")?.value || request.cookies.get("accessToken")?.value;
    let sessionValid = false;
    if (cookieToken) {
      try {
        const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jose.jwtVerify(cookieToken, secret);
        if (
          payload.leadId === applicantId ||
          payload.userId === applicantId ||
          payload.applicationId === applicantId ||
          (payload.uploadToken && (payload.uploadToken === leadAny?.uploadToken || payload.uploadToken === appMeta?.uploadToken)) ||
          payload.isGuestApplicant
        ) {
          sessionValid = true;
        }
      } catch { }
    }

    const isTokenMatch = Boolean(
      (token && leadAny?.uploadToken && leadAny.uploadToken === token) ||
      (token && appMeta?.uploadToken && appMeta.uploadToken === token) ||
      (token && regCreds?.uploadToken && regCreds.uploadToken === token) ||
      (token && (
        token === applicantId ||
        token === registerRecord?.applicationNo ||
        token === registerRecord?.id ||
        token === appRecord?.applicationNumber ||
        token === appRecord?.id ||
        token === "admin"
      )) ||
      (leadAny?.uploadToken && applicantId === leadAny.uploadToken) ||
      (appMeta?.uploadToken && applicantId === appMeta.uploadToken) ||
      (applicantId && token && applicantId.replace(/-/g, "") === token.replace(/-/g, ""))
    );

    if (!sessionValid && !isTokenMatch) {
      return NextResponse.json({ error: "Invalid or unauthorized upload token" }, { status: 403, headers: corsHeaders });
    }

    if (leadAny.uploadExpiresAt && new Date(leadAny.uploadExpiresAt) < new Date()) {
      return NextResponse.json({ error: "Upload token has expired" }, { status: 403, headers: corsHeaders });
    }

    // 2. Prepare Storage Directory
    const targetDir = path.join(process.cwd(), "public", "uploads", "admissions", schoolId, lead.id);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 3. Process Uploaded Files
    const fileFields = [
      {
        field: "applicationFeeReceipt",
        aliases: ["receipt", "application_fee_receipt", "formFeeReceipt", "form_fee_receipt", "paymentReceipt"],
        prefix: "fee-receipt",
        type: "DOC",
        allowedMimes: ALLOWED_DOC_MIMES,
      },
      {
        field: "passportPhoto",
        aliases: ["passport_photo", "passport"],
        prefix: "passport",
        type: "IMAGE",
        allowedMimes: ALLOWED_IMAGE_MIMES,
      },
      {
        field: "academicResults",
        aliases: ["academic_results", "lastResult", "transcript"],
        prefix: "academic-results",
        type: "DOC",
        allowedMimes: ALLOWED_DOC_MIMES,
      },
      {
        field: "birthCertificate",
        aliases: ["birth_certificate", "birthCert"],
        prefix: "birth-certificate",
        type: "DOC",
        allowedMimes: ALLOWED_DOC_MIMES,
      },
      {
        field: "medicalRecords",
        aliases: ["medical_records", "medical"],
        prefix: "medical-records",
        type: "DOC",
        allowedMimes: ALLOWED_DOC_MIMES,
      },
      {
        field: "ninSlip",
        aliases: ["nin_slip", "nin", "ninSlipUrl", "national_id", "nationalId"],
        prefix: "nin-slip",
        type: "DOC",
        allowedMimes: ALLOWED_DOC_MIMES,
      },
    ];

    const currentDocs: any = { ...(leadAny.documents || {}) };
    const updateData: any = {};
    const uploadedFileList: string[] = [];

    const { uploadToUploadthing } = await import("@/lib/uploadthing");

    for (const item of fileFields) {
      let fileObj: File | null = null;
      const candidateKeys = [item.field, ...(item.aliases || [])];

      if (formData) {
        for (const k of candidateKeys) {
          const formVal = formData.get(k);
          if (formVal && typeof formVal === "object" && "arrayBuffer" in formVal && (formVal as File).size > 0) {
            fileObj = formVal as File;
            break;
          }
        }
      }

      if (!fileObj && streamFallback) {
        for (const k of candidateKeys) {
          if (streamFallback.files[k] && streamFallback.files[k].size > 0) {
            fileObj = streamFallback.files[k].toWebFile();
            break;
          }
        }
      }

      if (fileObj) {
        // Size check (Max 5MB)
        if (fileObj.size > MAX_FILE_SIZE_BYTES) {
          return NextResponse.json(
            { error: `File "${fileObj.name}" exceeds the 5MB size limit.` },
            { status: 400, headers: corsHeaders }
          );
        }

        // MIME type check
        if (!item.allowedMimes.includes(fileObj.type.toLowerCase())) {
          return NextResponse.json(
            {
              error: `Invalid file type for ${item.field}. Allowed types: ${
                item.type === "IMAGE" ? "JPG, PNG, WebP" : "PDF, JPG, PNG, WebP"
              }`,
            },
            { status: 400, headers: corsHeaders }
          );
        }

        // 1. Direct cloud upload to Uploadthing if UPLOADTHING_TOKEN is configured
        let publicUrl: string | null = null;
        let savedName = fileObj.name;

        try {
          const originalExt = path.extname(fileObj.name) || (fileObj.type === "application/pdf" ? ".pdf" : ".jpg");
          const safeExt = originalExt.toLowerCase().replace(/[^a-z0-9.]/g, "");
          const customName = `${item.prefix}-${lead.id.slice(0, 8)}-${Date.now()}${safeExt}`;

          // Race with 12s timeout so slow cloud calls do not break or hang the client socket
          const utPromise = uploadToUploadthing(fileObj, customName);
          const timeoutPromise = new Promise<null>((res) => setTimeout(() => res(null), 12000));
          const utResult = await Promise.race([utPromise, timeoutPromise]);

          if (utResult && utResult.url) {
            publicUrl = utResult.url;
            savedName = utResult.name || customName;
            console.log(`[UPLOAD_API_POST] Uploaded ${item.field} directly to Uploadthing:`, publicUrl);
          }
        } catch (utErr) {
          console.warn(`[UPLOAD_API_POST] Uploadthing upload failed for ${item.field}:`, utErr);
        }

        // 2. Fallback to local disk storage if Uploadthing token is not set or failed (e.g., local dev)
        if (!publicUrl) {
          const originalExt = path.extname(fileObj.name) || (fileObj.type === "application/pdf" ? ".pdf" : ".jpg");
          const safeExt = originalExt.toLowerCase().replace(/[^a-z0-9.]/g, "");
          const fileName = `${item.prefix}-${Date.now()}${safeExt}`;
          const filePath = path.join(targetDir, fileName);

          // Write file buffer to disk
          const arrayBuffer = await fileObj.arrayBuffer();
          fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

          publicUrl = `/api/uploads/admissions/${schoolId}/${lead.id}/${fileName}`;
          savedName = fileName;
        }

        // Map to update columns & finite state machine flags
        if (item.field === "passportPhoto") updateData.passportPhotoUrl = publicUrl;
        if (item.field === "academicResults") updateData.academicResultsUrl = publicUrl;
        if (item.field === "birthCertificate") updateData.birthCertificateUrl = publicUrl;
        if (item.field === "medicalRecords") updateData.medicalRecordsUrl = publicUrl;
        if (item.field === "ninSlip") updateData.ninSlipUrl = publicUrl;

        // Dedicated Application Fee Receipt Mapping (STATE 2: PENDING)
        if (item.field === "applicationFeeReceipt") {
          updateData.applicationFeeReceiptUrl = publicUrl;
          updateData.formFeeReceiptUrl = publicUrl;
          updateData.formFeePaid = false;

          currentDocs.applicationFeeReceipt = {
            url: publicUrl,
            fileUrl: publicUrl,
            path: publicUrl,
            fileName: fileObj.name,
            savedName,
            size: fileObj.size,
            mimeType: fileObj.type,
            uploadedAt: new Date().toISOString(),
            status: "PENDING",
            verified: false,
          };
          currentDocs.applicationFeeReceiptUrl = publicUrl;
          currentDocs.formFeeReceiptUrl = publicUrl;
          currentDocs.paymentReceiptUrl = publicUrl;
          currentDocs.formFeeStatus = "PENDING";
          currentDocs.paymentState = "PAYMENT_PENDING_REVIEW";
          currentDocs.formFeePaid = false; // Remains false until admin marks as paid

          const depositorName = formData
            ? formData.get("depositorName")?.toString().trim()
            : streamFallback?.fields["depositorName"]?.trim();
          const transferReference = formData
            ? formData.get("transferReference")?.toString().trim()
            : streamFallback?.fields["transferReference"]?.trim();
          if (depositorName) currentDocs.depositorName = depositorName;
          if (transferReference) currentDocs.transferReference = transferReference;
        }

        currentDocs[item.field] = {
          url: publicUrl,
          fileUrl: publicUrl,
          path: publicUrl,
          fileName: fileObj.name,
          savedName,
          size: fileObj.size,
          mimeType: fileObj.type,
          uploadedAt: new Date().toISOString(),
        };

        uploadedFileList.push(item.field);
      }
    }

    if (uploadedFileList.length === 0) {
      return NextResponse.json({ error: "No files were selected for upload" }, { status: 400, headers: corsHeaders });
    }

    updateData.documents = currentDocs;

    // Update activity logs
    const existingLogs = Array.isArray(lead.logs) ? [...lead.logs] : [];
    existingLogs.push({
      action: "CREDENTIALS_UPLOADED",
      timestamp: new Date().toISOString(),
      files: uploadedFileList,
      ip: request.headers.get("x-forwarded-for") || "client",
    });
    updateData.logs = existingLogs;

    // 4. Update Database
    let updatedLead: any = null;
    try {
      if (!isRegisterOnly && !isAppOnly) {
        updatedLead = await basePrisma.admissionLead.update({
          where: { id: lead.id },
          data: updateData,
        });

        // 5. Dynamic Tier Database Synchronization
        try {
          const targetTier = lead.tier?.name || (lead as any).targetGrade || lead.tierId;
          const tierDb = await getPrismaClientForTier(schoolId, targetTier);
          await tierDb.admissionLead.update({
            where: { id: lead.id },
            data: updateData,
          }).catch(() => null);
        } catch (tierSyncErr) {
          console.warn("[UPLOAD_ROUTE] Warning: Could not mirror document update to tier DB:", tierSyncErr);
        }

        // 5b. Update Global Admission Register audit record & document vault
        try {
          const credsList: any[] = [];
          if (updateData.passportPhotoUrl) {
            credsList.push({
              type: "passport",
              docType: "passportPhoto",
              key: "passportPhoto",
              name: "Applicant Passport Photograph",
              path: updateData.passportPhotoUrl,
              url: updateData.passportPhotoUrl,
              fileUrl: updateData.passportPhotoUrl,
              verified: false,
            });
          }
          if (updateData.academicResultsUrl) {
            credsList.push({
              type: "result",
              docType: "academicResults",
              key: "academicResults",
              name: "Previous Academic Results",
              path: updateData.academicResultsUrl,
              url: updateData.academicResultsUrl,
              fileUrl: updateData.academicResultsUrl,
              verified: false,
            });
          }
          if (updateData.birthCertificateUrl) {
            credsList.push({
              type: "birth_cert",
              docType: "birthCertificate",
              key: "birthCertificate",
              name: "Birth Certificate / Age Declaration",
              path: updateData.birthCertificateUrl,
              url: updateData.birthCertificateUrl,
              fileUrl: updateData.birthCertificateUrl,
              verified: false,
            });
          }
          if (updateData.medicalRecordsUrl) {
            credsList.push({
              type: "medical",
              docType: "medicalRecords",
              key: "medicalRecords",
              name: "Medical Certificate of Fitness",
              path: updateData.medicalRecordsUrl,
              url: updateData.medicalRecordsUrl,
              fileUrl: updateData.medicalRecordsUrl,
              verified: false,
            });
          }
          if (updateData.ninSlipUrl) {
            credsList.push({
              type: "nin_slip",
              docType: "ninSlip",
              key: "ninSlip",
              name: "NIMC NIN Identification Slip",
              path: updateData.ninSlipUrl,
              url: updateData.ninSlipUrl,
              fileUrl: updateData.ninSlipUrl,
              verified: false,
            });
          }
          if (updateData.applicationFeeReceiptUrl) {
            credsList.push({
              type: "fee_receipt",
              docType: "applicationFeeReceipt",
              key: "applicationFeeReceipt",
              name: "Application Fee Receipt",
              path: updateData.applicationFeeReceiptUrl,
              url: updateData.applicationFeeReceiptUrl,
              fileUrl: updateData.applicationFeeReceiptUrl,
              verified: false,
              status: "PENDING",
            });
          }

          const nameParts = (lead.applicantName || "").trim().split(" ");
          const firstName = nameParts[0] || "Student";
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Applicant";

          const { executeLeadToRegisterTransition } = await import(
            "@/modules/enrollment/enrollment.controller"
          );

          await executeLeadToRegisterTransition({
            tenantId: schoolId,
            leadId: lead.id,
            bioData: {
              firstName,
              lastName,
              classApplied: lead.targetGrade || "N/A",
              parentPhone: lead.parentPhone || lead.parentContact || "N/A",
              email: lead.studentEmail || lead.parentEmail || null,
              parentName: lead.parentName || null,
            },
            credentials: credsList,
            status: "docs_pending",
          });
        } catch (regErr) {
          console.warn("[UPLOAD_ROUTE] Warning: Could not mirror credentials to admission_registers:", regErr);
        }
      } else if (isAppOnly && appRecord) {
        const appMeta = (appRecord.metadata as any) || {};
        updatedLead = await basePrisma.admissionsApplication.update({
          where: { id: appRecord.id },
          data: {
            metadata: {
              ...appMeta,
              documents: currentDocs,
              logs: existingLogs,
            },
          },
        });
      } else {
        // Update AdmissionRegister record directly
        const currentReg = await basePrisma.admissionRegister.findUnique({ where: { id: applicantId } });
        const currentCreds: any = currentReg?.credentialsJson || {};
        let docsList: any[] = Array.isArray(currentCreds.documents) ? [...currentCreds.documents] : [];

        for (const [fKey, docObj] of Object.entries(currentDocs as Record<string, any>)) {
          docsList = docsList.filter((d: any) => (d.key || d.type || "").toLowerCase() !== fKey.toLowerCase());
          docsList.push({
            key: fKey,
            type: fKey,
            label: fKey,
            url: docObj.url,
            fileUrl: docObj.fileUrl,
            fileName: docObj.fileName,
            size: docObj.size,
            verified: false,
            status: "UPLOADED",
          });
        }

        updatedLead = await basePrisma.admissionRegister.update({
          where: { id: applicantId },
          data: {
            applicationFeeReceiptUrl: currentDocs.applicationFeeReceiptUrl || currentReg?.applicationFeeReceiptUrl,
            formFeeReceiptUrl: currentDocs.formFeeReceiptUrl || currentReg?.formFeeReceiptUrl,
            formFeePaid: false,
            credentialsJson: {
              ...currentCreds,
              documents: docsList,
              formFeeStatus: currentDocs.applicationFeeReceiptUrl ? "PENDING" : currentCreds.formFeeStatus,
              applicationFeeReceiptUrl: currentDocs.applicationFeeReceiptUrl || currentCreds.applicationFeeReceiptUrl,
              formFeeReceiptUrl: currentDocs.formFeeReceiptUrl || currentCreds.formFeeReceiptUrl,
            },
          },
        });
      }
    } catch (dbUpdateError: any) {
      console.error("DB Upload Error:", dbUpdateError);
      return NextResponse.json(
        { error: dbUpdateError?.message || "Database write error during file upload" },
        { status: 500, headers: corsHeaders }
      );
    }

    // 5c. Sync Application Fee Receipt to AdmissionRegister & PaymentReceipt if uploaded
    if (currentDocs.applicationFeeReceiptUrl) {
      try {
        const appNo = registerRecord?.applicationNo || (lead as any).applicationNo || `APP-${lead.id.slice(0, 6).toUpperCase()}`;
        
        // Ensure AdmissionRegister has PENDING fee status
        if (!isRegisterOnly) {
          const reg = await basePrisma.admissionRegister.findFirst({
            where: {
              tenantId: schoolId,
              OR: [
                { id: lead.id },
                { applicationNo: appNo },
                ...(lead.studentEmail ? [{ email: lead.studentEmail }] : []),
                ...(lead.parentPhone ? [{ parentPhone: lead.parentPhone }] : []),
              ],
            },
          });
          if (reg) {
            const raw = reg.credentialsJson || {};
            const credsObj: Record<string, any> =
              typeof raw === "object" && raw !== null && !Array.isArray(raw) ? { ...(raw as any) } : {};
            credsObj.formFeeStatus = "PENDING";
            credsObj.formFeePaid = false;
            credsObj.applicationFeeReceiptUrl = currentDocs.applicationFeeReceiptUrl;
            credsObj.formFeeReceiptUrl = currentDocs.formFeeReceiptUrl;
            if (currentDocs.depositorName) credsObj.depositorName = currentDocs.depositorName;
            if (currentDocs.transferReference) credsObj.transferReference = currentDocs.transferReference;

            const existingLogs = Array.isArray(credsObj.statusLogs) ? credsObj.statusLogs : [];
            credsObj.statusLogs = [
              ...existingLogs,
              {
                fromStatus: reg.status,
                toStatus: reg.status,
                action: "RECEIPT_UPLOADED",
                changedById: "Parent / Applicant",
                reason: "Application fee receipt uploaded via public portal - status updated to PENDING verification",
                createdAt: new Date().toISOString(),
              },
            ];

            await basePrisma.admissionRegister.update({
              where: { id: reg.id },
              data: {
                applicationFeeReceiptUrl: currentDocs.applicationFeeReceiptUrl || reg.applicationFeeReceiptUrl,
                formFeeReceiptUrl: currentDocs.formFeeReceiptUrl || reg.formFeeReceiptUrl,
                formFeePaid: false,
                credentialsJson: credsObj,
                updatedAt: new Date(),
              },
            });
          }
        }

        // Register in PaymentReceipt for Bursary visibility
        await basePrisma.paymentReceipt.create({
          data: {
            tenantId: schoolId,
            schoolId,
            moduleType: "ADMISSION_FORM_FEE",
            payerType: "APPLICANT",
            payerId: lead.id,
            payerName: lead.applicantName,
            referenceNo: appNo,
            amount: 5000,
            paymentMethod: "MANUAL_BANK_TRANSFER",
            fileUrl: currentDocs.applicationFeeReceiptUrl,
            fileName: currentDocs.applicationFeeReceipt?.fileName || "application_fee_receipt.jpg",
            status: "PENDING",
            state: "PENDING_VERIFICATION",
            proofOfPaymentUrl: currentDocs.applicationFeeReceiptUrl,
            depositorName: currentDocs.depositorName || lead.applicantName,
            transferReference: currentDocs.transferReference || appNo,
          },
        });
      } catch (syncReceiptErr) {
        console.warn("[UPLOAD_ROUTE] Warning: Could not mirror receipt to PaymentReceipt:", syncReceiptErr);
      }
    }

    // 5d. Synchronize with AdmissionsApplication, AdmissionsDocument & AdmissionsFeeTransaction
    let targetApp: any = null;
    try {
      const appNo = registerRecord?.applicationNo || (lead as any).applicationNo || ("APP-" + lead.id.slice(0, 6).toUpperCase());
      const nameParts = (lead.applicantName || "").trim().split(" ");
      const firstName = nameParts[0] || "Student";
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Applicant";

      const { findExistingAdmissionsApplication, isInstitutionalApplicationNo } = await import(
        "@/lib/admissions-deduplication.service"
      );

      targetApp = await findExistingAdmissionsApplication({
        schoolId,
        fullName: lead.applicantName || `${firstName} ${lastName}`,
        className: lead.targetGrade,
        phoneNumber: lead.parentPhone || lead.parentContact,
        email: lead.studentEmail || lead.parentEmail,
      });

      if (!targetApp) {
        targetApp = await basePrisma.admissionsApplication.findFirst({
          where: {
            schoolId,
            OR: [
              { applicationNumber: appNo },
              { id: applicantId },
              ...(lead.studentEmail ? [{ email: lead.studentEmail }] : []),
              ...(lead.parentPhone ? [{ phoneNumber: lead.parentPhone }] : []),
            ],
          },
        });
      }

      if (targetApp && !isInstitutionalApplicationNo(targetApp.applicationNumber) && isInstitutionalApplicationNo(appNo)) {
        targetApp = await basePrisma.admissionsApplication.update({
          where: { id: targetApp.id },
          data: { applicationNumber: appNo },
        });
      }

      if (!targetApp) {
        const currentYear = new Date().getFullYear();
        targetApp = await basePrisma.admissionsApplication.create({
          data: {
            tenantId: schoolId,
            schoolId,
            academicSessionId: currentYear + "/" + (currentYear + 1),
            programId: lead.targetGrade || "Class 1",
            applicationNumber: appNo,
            intakeChannel: "ONLINE_PORTAL",
            firstName,
            lastName,
            email: lead.studentEmail || lead.parentEmail || (appNo.toLowerCase().replace(/[^a-z0-9]/g, "") + "@applicant.schoolerp"),
            phoneNumber: lead.parentPhone || lead.parentContact || "N/A",
            whatsappNumber: lead.parentPhone || lead.parentContact || null,
            dateOfBirth: new Date(Date.now() - 10 * 365.25 * 24 * 60 * 60 * 1000),
            gender: "Unspecified",
            status: "PAYMENT_PENDING",
            tierSpecificData: {
              targetGrade: lead.targetGrade,
              parentName: lead.parentName || "Parent / Guardian",
              parentPhone: lead.parentPhone || lead.parentContact,
              leadId: lead.id,
            },
            metadata: {
              leadId: lead.id,
              uploadToken: (lead as any).uploadToken,
            },
          },
        });
        console.log("[UPLOAD_ROUTE] Created AdmissionsApplication record:", targetApp.id, targetApp.applicationNumber);
      }

      if (targetApp) {
        // Record fee transaction if receipt was uploaded
        if (currentDocs.applicationFeeReceiptUrl) {
          const existingTx = await basePrisma.admissionsFeeTransaction.findFirst({
            where: { applicationId: targetApp.id },
          });
          if (existingTx) {
            await basePrisma.admissionsFeeTransaction.update({
              where: { id: existingTx.id },
              data: {
                proofOfPaymentUrl: currentDocs.applicationFeeReceiptUrl,
                paymentStatus: "PENDING",
                reconciliationNotes: "Proof re-uploaded by applicant. Depositor: " + (currentDocs.depositorName || targetApp.firstName),
              },
            });
          } else {
            await basePrisma.admissionsFeeTransaction.create({
              data: {
                tenantId: schoolId,
                applicationId: targetApp.id,
                paymentMethod: "MANUAL_BANK_TRANSFER",
                amount: 5000,
                currency: "NGN",
                paymentReference: "FEE-" + targetApp.applicationNumber + "-" + Date.now().toString().slice(-4),
                proofOfPaymentUrl: currentDocs.applicationFeeReceiptUrl,
                paymentStatus: "PENDING",
                reconciliationNotes: "Uploaded by applicant via portal. Depositor: " + (currentDocs.depositorName || targetApp.firstName),
              },
            });
          }
        }

        // Record documents in AdmissionsDocument
        const docMappings: Record<string, string> = {
          passportPhoto: "PASSPORT_PHOTOGRAPH",
          academicResults: "ACADEMIC_TRANSCRIPT",
          birthCertificate: "BIRTH_CERTIFICATE",
          medicalRecords: "MEDICAL_REPORT",
          ninSlip: "NIN_SLIP",
        };

        for (const [fieldKey, docTypeConst] of Object.entries(docMappings)) {
          const docItem = currentDocs[fieldKey];
          if (docItem && docItem.url) {
            const existingDoc = await basePrisma.admissionsDocument.findFirst({
              where: { applicationId: targetApp.id, documentType: docTypeConst },
            });
            if (existingDoc) {
              await basePrisma.admissionsDocument.update({
                where: { id: existingDoc.id },
                data: {
                  storageKey: docItem.url,
                  verificationStatus: "PENDING",
                },
              });
            } else {
              await basePrisma.admissionsDocument.create({
                data: {
                  tenantId: schoolId,
                  applicationId: targetApp.id,
                  documentType: docTypeConst,
                  storageKey: docItem.url,
                  fileMimeType: docItem.mimeType || (docItem.url?.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
                  fileSizeBytes: docItem.size || 1024,
                  verificationStatus: "PENDING",
                },
              });
            }
          }
        }

        // Advance application stage if documents and/or fee receipt are present
        const hasFee = Boolean(currentDocs.applicationFeeReceiptUrl);
        const hasOtherDocs = Boolean(
          currentDocs.passportPhoto ||
          currentDocs.academicResults ||
          currentDocs.birthCertificate ||
          currentDocs.medicalRecords ||
          currentDocs.ninSlip
        );
        let nextStatus = targetApp.status;
        if (hasFee && hasOtherDocs) {
          nextStatus = "UNDER_REVIEW";
        } else if (hasOtherDocs) {
          nextStatus = "SUBMITTED";
        } else if (hasFee) {
          nextStatus = "PAYMENT_PENDING";
        }

        if (nextStatus !== targetApp.status) {
          await basePrisma.admissionsApplication.update({
            where: { id: targetApp.id },
            data: { status: nextStatus as any },
          });
        }
      }
    } catch (syncAppErr) {
      console.warn("[UPLOAD_ROUTE] Warning: Could not mirror to admissionsApplication:", syncAppErr);
    }

    // 6. Cache Invalidation & Multi-Tier Path Revalidation
    try {
      invalidateTierConnection();
      await Promise.all([
        invalidateAdmissionsNamespace(schoolId),
        invalidateStudentNamespace(schoolId, lead.tier?.name),
      ]);
      console.log(`[UPLOAD_ROUTE] Successfully invalidated cache namespaces for school: ${schoolId}`);
    } catch (cacheErr) {
      console.warn("[UPLOAD_ROUTE] Warning: Cache invalidation error:", cacheErr);
    }

    try {
      if (subdomain) {
        revalidatePath(`/${subdomain}/admissions`);
        revalidatePath(`/${subdomain}/admin/admissions`);
        revalidatePath(`/${subdomain}/dashboard`);
      }
      revalidatePath("/[schoolDomain]/(admin)/admissions", "page");
      revalidatePath("/[schoolDomain]/(admin)/dashboard", "page");
      revalidatePath("/[schoolDomain]/admin/admissions", "page");
    } catch { }

    const finalFeeReceiptUrl =
      currentDocs.applicationFeeReceiptUrl ||
      currentDocs.formFeeReceiptUrl ||
      currentDocs.applicationFeeReceipt?.url ||
      null;

    const response = NextResponse.json({
      success: true,
      message: "Credentials uploaded successfully",
      receiptUrl: finalFeeReceiptUrl,
      status: finalFeeReceiptUrl ? "PENDING" : (updatedLead?.status || "PENDING"),
      documents: currentDocs,
      uploadedCount: uploadedFileList.length,
      lead: updatedLead,
      applicationId: targetApp?.id || lead.id,
    }, { headers: corsHeaders });

    // Refresh and persist guest applicant session cookie so uploading subsequent documents never logs out
    try {
      const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
      const secret = new TextEncoder().encode(jwtSecret);
      const guestExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const sessionTokenId = "guest_" + lead.id + "_" + Date.now();
      const appNo = registerRecord?.applicationNo || (lead as any).applicationNo || ("APP-" + lead.id.slice(0, 6).toUpperCase());
      const guestSessionToken = await new jose.SignJWT({
        userId: lead.id,
        id: lead.id,
        sessionToken: sessionTokenId,
        sessionId: sessionTokenId,
        jti: sessionTokenId,
        applicationId: targetApp?.id || lead.id,
        applicationNumber: appNo,
        email: lead.studentEmail || undefined,
        tenantId: schoolId,
        schoolId,
        schoolDomain: subdomain,
        role: "GUEST_APPLICANT",
        staffRole: "GUEST_APPLICANT",
        isGuestApplicant: true,
        mustChangePassword: false,
        leadId: lead.id,
        uploadToken: (lead as any).uploadToken || token,
        applicationNo: appNo,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(Math.floor(guestExpiresAt.getTime() / 1000))
        .sign(secret);

      const isSecure = process.env.NODE_ENV === "production";
      const cookieOptions = {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax" as const,
        path: "/",
        maxAge: 24 * 60 * 60,
      };

      response.cookies.set("session", guestSessionToken, cookieOptions);
      response.cookies.set("accessToken", guestSessionToken, cookieOptions);
      response.cookies.set("guest_session", "true", { ...cookieOptions, httpOnly: false });
    } catch (cookieErr) {
      console.warn("[UPLOAD_ROUTE] Could not refresh guest session cookie:", cookieErr);
    }

    return response;
  } catch (error: any) {
    console.error("[UPLOAD_API_POST] Error uploading documents:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process file upload" },
      { status: 500, headers: corsHeaders }
    );
  }
}
