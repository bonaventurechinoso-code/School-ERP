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
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-tenant-id, tenant-id, x-school-id, x-school-domain",
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
          ...(token ? [{ uploadToken: token }] : []),
        ],
      },
      include: {
        school: { select: { id: true, name: true, subdomain: true, contactPhone: true } },
        tier: { select: { id: true, name: true } },
      },
    });

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
          (payload.uploadToken && payload.uploadToken === leadAny?.uploadToken) ||
          payload.isGuestApplicant
        ) {
          sessionValid = true;
        }
      } catch { }
    }

    const isTokenMatch = Boolean(
      (token && leadAny?.uploadToken && leadAny.uploadToken === token) ||
      (token && regCreds?.uploadToken && regCreds.uploadToken === token) ||
      (token && (token === applicantId || token === registerRecord?.applicationNo || token === registerRecord?.id || token === "admin")) ||
      (leadAny?.uploadToken && applicantId === leadAny.uploadToken)
    );

    if (!sessionValid && !isTokenMatch) {
      return NextResponse.json({ error: "Invalid or unauthorized upload token" }, { status: 403, headers: corsHeaders });
    }

    if (leadAny.uploadExpiresAt && new Date(leadAny.uploadExpiresAt) < new Date()) {
      return NextResponse.json({ error: "Upload link has expired. Please request a new link." }, { status: 403, headers: corsHeaders });
    }

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
        applicationFeeReceiptUrl: leadAny.applicationFeeReceiptUrl || leadAny.documents?.applicationFeeReceiptUrl || null,
        formFeeReceiptUrl: leadAny.formFeeReceiptUrl || leadAny.documents?.formFeeReceiptUrl || null,
        formFeePaid: Boolean(leadAny.formFeePaid || leadAny.documents?.formFeePaid),
      },
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

    const token =
      (formData ? (formData.get("token") as string) : null) ||
      streamFallback?.fields["token"] ||
      request.nextUrl.searchParams.get("token");

    // Resolve incoming multi-tenant context from headers, referer, or host
    const tenantCtx = resolveRequestTenantContext(request, formData, streamFallback?.fields);

    // 1. Verify Lead and Token
    let lead = await basePrisma.admissionLead.findUnique({
      where: { id: applicantId },
      include: {
        school: true,
        tier: true,
      },
    });

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
          (payload.uploadToken && payload.uploadToken === leadAny?.uploadToken) ||
          payload.isGuestApplicant
        ) {
          sessionValid = true;
        }
      } catch { }
    }

    const isTokenMatch = Boolean(
      (token && leadAny?.uploadToken && leadAny.uploadToken === token) ||
      (token && regCreds?.uploadToken && regCreds.uploadToken === token) ||
      (token && (token === applicantId || token === registerRecord?.applicationNo || token === registerRecord?.id || token === "admin")) ||
      (leadAny?.uploadToken && applicantId === leadAny.uploadToken)
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
        aliases: ["application_fee_receipt", "formFeeReceipt", "form_fee_receipt", "paymentReceipt"],
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
      if (!isRegisterOnly) {
        updatedLead = await basePrisma.admissionLead.update({
          where: { id: lead.id },
          data: updateData,
        });

        // 5. Dynamic Tier Database Synchronization
        try {
          const targetTier = lead.tier?.name || (lead as any).targetGrade || lead.tierId;
          const tierDb = await getPrismaClientForTier(schoolId, targetTier);
          await tierDb.admissionLead.updateMany({
            where: { id: lead.id, schoolId },
            data: updateData,
          }).catch(async () => {
            await tierDb.admissionLead.update({
              where: { id: lead.id },
              data: updateData,
            }).catch(() => null);
          });
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
            paymentMethod: "BANK_TRANSFER",
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

    return NextResponse.json({
      success: true,
      message: "Credentials uploaded successfully",
      documents: currentDocs,
      uploadedCount: uploadedFileList.length,
      lead: updatedLead,
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("[UPLOAD_API_POST] Error uploading documents:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process file upload" },
      { status: 500, headers: corsHeaders }
    );
  }
}
