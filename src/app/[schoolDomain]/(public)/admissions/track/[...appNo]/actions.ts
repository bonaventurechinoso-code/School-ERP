"use server";

import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export async function uploadApplicantDocsAction(formData: FormData) {
  try {
    const schoolId = formData.get("schoolId") as string;
    const schoolDomain = formData.get("schoolDomain") as string;
    const appNo = formData.get("appNo") as string;

    if (!schoolId || !appNo) {
      return { success: false, error: "Missing required schoolId or application number." };
    }

    // 1. Locate AdmissionRegister record
    const applicant = await basePrisma.admissionRegister.findFirst({
      where: {
        tenantId: schoolId,
        OR: [
          { applicationNo: appNo },
          { id: appNo },
        ],
      },
    });

    if (!applicant) {
      return { success: false, error: "Application record not found in admissions register." };
    }

    console.log("[UPLOAD_DIAGNOSE] schoolDomain param:", schoolDomain);
    console.log("[UPLOAD_DIAGNOSE] applicationId (appNo):", appNo, "applicant ID:", applicant.id);

    // 2. Prepare upload destination folder
    const targetDir = path.join(process.cwd(), "public", "uploads", "admissions", schoolId, applicant.applicationNo);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 3. Process the 4 designated credential files
    const fileConfigs = [
      { key: "birthCertificate", type: "NPC Birth Cert", altType: "birthCertificate", label: "NPC National Birth Certificate" },
      { key: "passportPhoto", type: "Recent Passport", altType: "passportPhoto", label: "Recent Passport Photograph" },
      { key: "lastResult", type: "Previous Academic Results", altType: "academicResults", label: "Previous Term Academic Results" },
      { key: "nin", type: "Medical Fitness", altType: "medicalRecords", label: "Medical Fitness Certificate" },
    ];

    const currentCreds = Array.isArray(applicant.credentialsJson)
      ? [...applicant.credentialsJson]
      : [];

    const leadDocsToUpdate: Record<string, any> = {};
    const leadColumns: Record<string, any> = {};
    let uploadCount = 0;

    for (const config of fileConfigs) {
      const file = formData.get(config.key);
      if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
        const fileObj = file as File;

        if (fileObj.size > MAX_FILE_SIZE_BYTES) {
          return {
            success: false,
            error: `File "${fileObj.name}" exceeds the 10MB limit. Please upload a smaller file.`,
          };
        }

        const originalExt = path.extname(fileObj.name) || ".pdf";
        const safeExt = originalExt.toLowerCase().replace(/[^a-z0-9.]/g, "");
        const fileName = `${config.key}-${Date.now()}${safeExt}`;
        const filePath = path.join(targetDir, fileName);

        const arrayBuffer = await fileObj.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
        console.log("[UPLOAD_DIAGNOSE] file path saved:", filePath);

        const publicUrl = `/uploads/admissions/${schoolId}/${applicant.applicationNo}/${fileName}`;

        const docEntry = {
          type: config.type,
          docType: config.type,
          key: config.key,
          altType: config.altType,
          name: config.label,
          originalName: fileObj.name,
          fileName: fileObj.name,
          filename: fileName,
          fileUrl: publicUrl,
          url: publicUrl,
          path: publicUrl,
          size: fileObj.size,
          mimeType: fileObj.type,
          verified: false,
          uploadedAt: new Date().toISOString(),
        };

        // Remove older entry for same docType if re-uploading
        const filteredCreds = currentCreds.filter(
          (c: any) =>
            c.type !== config.type &&
            c.docType !== config.type &&
            c.key !== config.key &&
            c.type !== config.altType
        );
        currentCreds.length = 0;
        currentCreds.push(...filteredCreds, docEntry);

        leadDocsToUpdate[config.key] = docEntry;
        leadDocsToUpdate[config.type] = docEntry;
        leadDocsToUpdate[config.altType] = docEntry;

        if (config.key === "passportPhoto") leadColumns.passportPhotoUrl = publicUrl;
        if (config.key === "birthCertificate") leadColumns.birthCertificateUrl = publicUrl;
        if (config.key === "lastResult") leadColumns.academicResultsUrl = publicUrl;
        if (config.key === "nin") leadColumns.medicalRecordsUrl = publicUrl;

        uploadCount++;
      }
    }

    if (uploadCount === 0) {
      return { success: false, error: "Please select at least one document to upload." };
    }

    // 4. Update status to docs_submitted
    const updatedRegister = await basePrisma.admissionRegister.update({
      where: { id: applicant.id },
      data: {
        credentialsJson: currentCreds as any,
        status: "docs_submitted",
        updatedAt: new Date(),
      },
    });

    console.log("[UPLOAD_DIAGNOSE] prisma result after register update:", {
      id: updatedRegister.id,
      applicationNo: updatedRegister.applicationNo,
      credentialsCount: Array.isArray(updatedRegister.credentialsJson) ? updatedRegister.credentialsJson.length : 0,
      status: updatedRegister.status,
    });

    // 5. Mirror to AdmissionLead if linked
    try {
      const cleanRef = applicant.applicationNo.replace(/^ADM-/, "").trim().toLowerCase();
      const lead = await basePrisma.admissionLead.findFirst({
        where: {
          schoolId,
          OR: [
            { id: { startsWith: cleanRef, mode: "insensitive" } },
            { id: applicant.id },
            { applicantName: { equals: `${applicant.firstName} ${applicant.lastName}`.trim(), mode: "insensitive" } },
            { applicantName: { equals: `${applicant.lastName} ${applicant.firstName}`.trim(), mode: "insensitive" } },
            { applicantName: { contains: applicant.lastName || applicant.firstName, mode: "insensitive" } },
            ...(applicant.email ? [{ studentEmail: applicant.email }, { parentEmail: applicant.email }] : []),
            ...(applicant.parentPhone ? [{ parentPhone: applicant.parentPhone }, { parentContact: applicant.parentPhone }] : []),
          ],
        },
      });

      if (lead) {
        const existingDocs = (lead.documents as any) || {};
        const updatedLead = await basePrisma.admissionLead.update({
          where: { id: lead.id },
          data: {
            ...leadColumns,
            documents: {
              ...existingDocs,
              ...leadDocsToUpdate,
            },
            status: lead.status === "INQUIRY" ? "APPLIED" : lead.status,
          },
        });
        console.log("[UPLOAD_DIAGNOSE] prisma result after lead update:", {
          id: updatedLead.id,
          documents: updatedLead.documents,
          status: updatedLead.status,
        });
      } else {
        console.log("[UPLOAD_DIAGNOSE] No admissionLead found matching cleanRef:", cleanRef, "or name:", applicant.firstName, applicant.lastName);
      }
    } catch (leadSyncErr) {
      console.warn("[uploadApplicantDocsAction] Non-fatal: Could not sync to admissionLead:", leadSyncErr);
    }

    // Revalidate paths
    try {
      if (schoolDomain) {
        revalidatePath(`/${schoolDomain}/admissions`);
        revalidatePath(`/${schoolDomain}/admissions/track/${applicant.applicationNo}`);
      }
      revalidatePath("/[schoolDomain]/(admin)/admissions", "page");
    } catch {}

    return {
      success: true,
      status: "docs_submitted",
      credentials: currentCreds,
      message: "Documents uploaded successfully! Your application status has been updated to Documents Submitted.",
    };
  } catch (error: any) {
    console.error("[uploadApplicantDocsAction] Error:", error);
    if (error?.code === "P2002") {
      return { success: false, error: "A unique record conflict occurred during document submission." };
    }
    return { success: false, error: error?.message || "Failed to upload applicant documents." };
  }
}
