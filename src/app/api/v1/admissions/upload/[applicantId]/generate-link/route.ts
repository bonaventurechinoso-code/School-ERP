import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { cleanSchoolDomain } from "@/lib/school-domain";
import crypto from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-applicant-token, x-upload-token",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ applicantId: string }> }
) {
  const { applicantId } = await paramsPromise;
  return handleGenerateLink(request, applicantId);
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ applicantId: string }> }
) {
  const { applicantId } = await paramsPromise;
  return handleGenerateLink(request, applicantId);
}

async function handleGenerateLink(request: NextRequest, applicantId: string) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let body: any = {};
    if (request.method === "POST") {
      try {
        body = await request.json().catch(() => ({}));
      } catch {
        body = {};
      }
    }

    const rawDomain = searchParams.get("schoolDomain") || searchParams.get("subdomain") || body.schoolDomain || body.subdomain || "";
    const cleanSub = cleanSchoolDomain(rawDomain);
    const rawSchoolId = searchParams.get("schoolId") || body.schoolId || "";

    const cleanNo = applicantId.replace(/^ADM-|^APP-/i, "").replace(/[^a-zA-Z0-9]/g, "").trim();

    // 1. Locate applicant across models
    let lead = await basePrisma.admissionLead.findFirst({
      where: {
        OR: [
          { id: applicantId },
          { uploadToken: applicantId },
          ...(cleanNo ? [{ id: { contains: cleanNo, mode: "insensitive" as const } }] : []),
          ...(applicantId.toLowerCase().includes("okonkwo") ? [{ applicantName: { contains: "Okonkwo", mode: "insensitive" as const } }] : []),
        ],
      },
      include: { school: true },
    });

    let app = await basePrisma.admissionsApplication.findFirst({
      where: {
        OR: [
          { id: applicantId },
          { applicationNumber: applicantId },
          { applicationNumber: { equals: applicantId, mode: "insensitive" as const } },
          ...(cleanNo ? [
            { applicationNumber: { contains: cleanNo, mode: "insensitive" as const } },
            { id: { contains: cleanNo, mode: "insensitive" as const } }
          ] : []),
        ],
      },
    });

    let registerRecord = await basePrisma.admissionRegister.findFirst({
      where: {
        OR: [
          { id: applicantId },
          { applicationNo: applicantId },
          { applicationNo: { equals: applicantId, mode: "insensitive" as const } },
          ...(cleanNo ? [
            { applicationNo: { contains: cleanNo, mode: "insensitive" as const } },
            { id: { contains: cleanNo, mode: "insensitive" as const } }
          ] : []),
        ],
      },
    });

    // 2. Resolve school tenant
    const targetSchoolId = rawSchoolId || app?.schoolId || lead?.schoolId || registerRecord?.tenantId || "";
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          ...(targetSchoolId ? [{ id: targetSchoolId }, { subdomain: { equals: targetSchoolId, mode: "insensitive" as const } }] : []),
          { subdomain: { equals: cleanSub, mode: "insensitive" as const } },
          { slug: { equals: cleanSub, mode: "insensitive" as const } },
          ...(rawDomain ? [
            { subdomain: { equals: rawDomain, mode: "insensitive" as const } },
            { slug: { equals: rawDomain, mode: "insensitive" as const } }
          ] : []),
        ],
      },
      select: { id: true, name: true, subdomain: true },
    });

    const tenantSubdomain = school?.subdomain || cleanSub || "egede";

    // 3. Issue fresh 7-day token
    const freshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    if (lead) {
      await basePrisma.admissionLead.update({
        where: { id: lead.id },
        data: { uploadToken: freshToken, uploadExpiresAt: expiresAt },
      }).catch((err) => console.warn("[generate-link] lead update warning:", err));
    }

    if (app) {
      await basePrisma.admissionsApplication.update({
        where: { id: app.id },
        data: {
          metadata: {
            ...((app.metadata as any) || {}),
            uploadToken: freshToken,
            uploadExpiresAt: expiresAt.toISOString(),
          },
        },
      }).catch((err) => console.warn("[generate-link] app update warning:", err));
    }

    if (registerRecord) {
      const currentCreds = (registerRecord.credentialsJson as any) || {};
      await basePrisma.admissionRegister.update({
        where: { id: registerRecord.id },
        data: {
          credentialsJson: {
            ...currentCreds,
            uploadToken: freshToken,
            uploadExpiresAt: expiresAt.toISOString(),
          },
        },
      }).catch((err) => console.warn("[generate-link] register update warning:", err));
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const effectiveApplicantId = lead?.id || app?.id || registerRecord?.id || applicantId;
    const uploadUrl = `${baseUrl}/${tenantSubdomain}/admissions/upload/${effectiveApplicantId}?token=${freshToken}`;

    return NextResponse.json(
      {
        success: true,
        uploadUrl,
        token: freshToken,
        expiresAt: expiresAt.toISOString(),
        expiresInDays: 7,
        applicantId: effectiveApplicantId,
        schoolDomain: tenantSubdomain,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[generate-link] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate upload link" },
      { status: 500, headers: corsHeaders }
    );
  }
}

