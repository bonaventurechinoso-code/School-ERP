import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getPrismaClientForTier, invalidateTierConnection } from "@/lib/tenant-prisma";
import { invalidateAdmissionsNamespace, invalidateStudentNamespace } from "@/lib/cache-invalidation";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import * as jose from "jose";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit

const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const ALLOWED_DOC_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

/**
 * Resolves the active multi-tenant context from incoming request headers, query, referer, or host.
 */
function resolveRequestTenantContext(request: NextRequest, formData?: FormData): {
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
    } catch {}
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
    const lead = await basePrisma.admissionLead.findUnique({
      where: { id: applicantId },
      include: {
        school: { select: { id: true, name: true, subdomain: true, contactPhone: true } },
        tier: { select: { id: true, name: true } },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
    }

    const leadAny = lead as any;
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
      } catch {}
    }

    if (!sessionValid && (!token || token !== leadAny.uploadToken)) {
      return NextResponse.json({ error: "Invalid or unauthorized upload token" }, { status: 403 });
    }

    if (leadAny.uploadExpiresAt && new Date(leadAny.uploadExpiresAt) < new Date()) {
      return NextResponse.json({ error: "Upload link has expired. Please request a new link." }, { status: 403 });
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
      },
    });
  } catch (err: any) {
    console.error("[UPLOAD_API_GET] Error validating applicant:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ applicantId: string }> }
) {
  const { applicantId } = await paramsPromise;

  try {
    const formData = await request.formData();
    const token = (formData.get("token") as string) || request.nextUrl.searchParams.get("token");

    // Resolve incoming multi-tenant context from headers, referer, or host
    const tenantCtx = resolveRequestTenantContext(request, formData);

    // 1. Verify Lead and Token
    const lead = await basePrisma.admissionLead.findUnique({
      where: { id: applicantId },
      include: {
        school: true,
        tier: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
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
      } catch {}
    }

    if (!sessionValid && (!token || token !== leadAny.uploadToken)) {
      return NextResponse.json({ error: "Invalid or unauthorized upload token" }, { status: 403 });
    }

    if (leadAny.uploadExpiresAt && new Date(leadAny.uploadExpiresAt) < new Date()) {
      return NextResponse.json({ error: "Upload token has expired" }, { status: 403 });
    }

    // 2. Prepare Storage Directory
    const targetDir = path.join(process.cwd(), "public", "uploads", "admissions", schoolId, lead.id);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 3. Process Uploaded Files
    const fileFields = [
      { field: "passportPhoto", prefix: "passport", type: "IMAGE", allowedMimes: ALLOWED_IMAGE_MIMES },
      { field: "academicResults", prefix: "academic-results", type: "DOC", allowedMimes: ALLOWED_DOC_MIMES },
      { field: "birthCertificate", prefix: "birth-certificate", type: "DOC", allowedMimes: ALLOWED_DOC_MIMES },
      { field: "medicalRecords", prefix: "medical-records", type: "DOC", allowedMimes: ALLOWED_DOC_MIMES },
    ];

    const currentDocs: any = { ...(leadAny.documents || {}) };
    const updateData: any = {};
    const uploadedFileList: string[] = [];

    const { uploadToUploadthing } = await import("@/lib/uploadthing");

    for (const item of fileFields) {
      const file = formData.get(item.field);
      if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
        const fileObj = file as File;

        // Size check (Max 5MB)
        if (fileObj.size > MAX_FILE_SIZE_BYTES) {
          return NextResponse.json(
            { error: `File "${fileObj.name}" exceeds the 5MB size limit.` },
            { status: 400 }
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
            { status: 400 }
          );
        }

        // 1. Direct cloud upload to Uploadthing if UPLOADTHING_TOKEN is configured
        let publicUrl: string | null = null;
        let savedName = fileObj.name;

        try {
          const originalExt = path.extname(fileObj.name) || (fileObj.type === "application/pdf" ? ".pdf" : ".jpg");
          const safeExt = originalExt.toLowerCase().replace(/[^a-z0-9.]/g, "");
          const customName = `${item.prefix}-${lead.id.slice(0, 8)}-${Date.now()}${safeExt}`;

          const utResult = await uploadToUploadthing(fileObj, customName);
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

          publicUrl = `/uploads/admissions/${schoolId}/${lead.id}/${fileName}`;
          savedName = fileName;
        }

        // Map to update columns
        if (item.field === "passportPhoto") updateData.passportPhotoUrl = publicUrl;
        if (item.field === "academicResults") updateData.academicResultsUrl = publicUrl;
        if (item.field === "birthCertificate") updateData.birthCertificateUrl = publicUrl;
        if (item.field === "medicalRecords") updateData.medicalRecordsUrl = publicUrl;

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
      return NextResponse.json({ error: "No files were selected for upload" }, { status: 400 });
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

    // 4. Update Central Database
    const updatedLead = await basePrisma.admissionLead.update({
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

      const nameParts = (lead.applicantName || "").trim().split(" ");
      const firstName = nameParts[0] || "Student";
      const lastName = nameParts.slice(1).join(" ") || "Applicant";

      const existingReg = await basePrisma.admissionRegister.findFirst({
        where: {
          tenantId: schoolId,
          OR: [
            { email: lead.studentEmail || lead.parentEmail || undefined },
            { parentPhone: lead.parentPhone || lead.parentContact || undefined },
            { firstName, lastName },
          ],
        },
      });

      if (existingReg) {
        await basePrisma.admissionRegister.update({
          where: { id: existingReg.id },
          data: {
            credentialsJson: credsList,
            status: "under_review",
          },
        });
      } else {
        const { generateApplicationNo } = await import("@/modules/enrollment/enrollment.controller");
        const appNo = await generateApplicationNo(schoolId);
        await basePrisma.admissionRegister.create({
          data: {
            tenantId: schoolId,
            applicationNo: appNo,
            firstName,
            lastName,
            classApplied: lead.targetGrade,
            parentPhone: lead.parentPhone || lead.parentContact || "N/A",
            email: lead.studentEmail || lead.parentEmail || null,
            credentialsJson: credsList,
            status: "under_review",
          },
        });
      }
    } catch (regErr) {
      console.warn("[UPLOAD_ROUTE] Warning: Could not mirror credentials to admission_registers:", regErr);
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
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Credentials uploaded successfully",
      documents: currentDocs,
      uploadedCount: uploadedFileList.length,
      lead: updatedLead,
    });
  } catch (error: any) {
    console.error("[UPLOAD_API_POST] Error uploading documents:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process file upload" },
      { status: 500 }
    );
  }
}

