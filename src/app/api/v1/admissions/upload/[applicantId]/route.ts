import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
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
    const schoolId = lead.schoolId;
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

        // Determine extension safely
        const originalExt = path.extname(fileObj.name) || (fileObj.type === "application/pdf" ? ".pdf" : ".jpg");
        const safeExt = originalExt.toLowerCase().replace(/[^a-z0-9.]/g, "");
        const fileName = `${item.prefix}-${Date.now()}${safeExt}`;
        const filePath = path.join(targetDir, fileName);

        // Write file buffer to disk
        const arrayBuffer = await fileObj.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

        // Public static URL
        const publicUrl = `/uploads/admissions/${schoolId}/${lead.id}/${fileName}`;

        // Map to update columns
        if (item.field === "passportPhoto") updateData.passportPhotoUrl = publicUrl;
        if (item.field === "academicResults") updateData.academicResultsUrl = publicUrl;
        if (item.field === "birthCertificate") updateData.birthCertificateUrl = publicUrl;
        if (item.field === "medicalRecords") updateData.medicalRecordsUrl = publicUrl;

        currentDocs[item.field] = {
          url: publicUrl,
          fileName: fileObj.name,
          savedName: fileName,
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
      const targetTier = lead.tier?.name || lead.tierId;
      const tierDb = await getPrismaClientForTier(schoolId, targetTier);
      const tierLead = await tierDb.admissionLead.findUnique({ where: { id: lead.id } }).catch(() => null);
      if (tierLead) {
        await tierDb.admissionLead.update({
          where: { id: lead.id },
          data: updateData,
        }).catch(() => null);
      }
    } catch (tierSyncErr) {
      console.warn("[UPLOAD_ROUTE] Warning: Could not mirror document update to tier DB:", tierSyncErr);
    }

    // 5b. Update Global Admission Register audit record & document vault
    try {
      const credsList: any[] = [];
      if (updateData.passportPhotoUrl) credsList.push({ type: "passport", path: updateData.passportPhotoUrl, verified: false });
      if (updateData.academicResultsUrl) credsList.push({ type: "result", path: updateData.academicResultsUrl, verified: false });
      if (updateData.birthCertificateUrl) credsList.push({ type: "birth_cert", path: updateData.birthCertificateUrl, verified: false });
      if (updateData.medicalRecordsUrl) credsList.push({ type: "medical", path: updateData.medicalRecordsUrl, verified: false });

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

    // 6. Path Revalidation
    try {
      const subdomain = lead.school?.subdomain;
      if (subdomain) {
        revalidatePath(`/${subdomain}/admissions`);
        revalidatePath(`/${subdomain}/dashboard`);
      }
      revalidatePath("/[schoolDomain]/(admin)/admissions", "page");
      revalidatePath("/[schoolDomain]/(admin)/dashboard", "page");
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
