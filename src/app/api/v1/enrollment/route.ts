import { NextRequest, NextResponse } from "next/server";
import {
  storeApplication,
  getAllApplications,
} from "@/modules/enrollment/enrollment.controller";
import { basePrisma } from "@/lib/tenant-prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id") || searchParams.get("schoolId") || searchParams.get("schoolDomain");
    const status = searchParams.get("status") || undefined;

    if (!tenantId) {
      return NextResponse.json({ error: "tenant_id parameter is required" }, { status: 400 });
    }

    // Resolve tenant ID if domain is passed
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { id: tenantId },
          { subdomain: tenantId.toLowerCase().trim() },
          { slug: tenantId.toLowerCase().trim() },
        ],
      },
      select: { id: true },
    });

    const effectiveTenantId = school?.id || tenantId;
    const applications = await getAllApplications({ tenantId: effectiveTenantId, status });

    return NextResponse.json({ success: true, count: applications.length, data: applications });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch applications" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const tenantId = (formData.get("tenant_id") || formData.get("schoolId") || formData.get("schoolDomain")) as string;
      const firstName = (formData.get("first_name") || formData.get("firstName")) as string;
      const lastName = (formData.get("last_name") || formData.get("lastName")) as string;
      const classApplied = (formData.get("class_applied") || formData.get("classApplied") || formData.get("targetGrade")) as string;
      const parentPhone = (formData.get("parent_phone") || formData.get("parentPhone") || formData.get("parentContact")) as string;
      const email = (formData.get("email") || formData.get("studentEmail") || formData.get("parentEmail")) as string;

      const files: Array<{ type: string; buffer: Buffer; filename: string; originalName?: string }> = [];

      for (const [key, value] of formData.entries()) {
        if (value instanceof Blob) {
          const buffer = Buffer.from(await value.arrayBuffer());
          const filename = value.name || `${key}.pdf`;
          files.push({
            type: key,
            buffer,
            filename,
            originalName: value.name,
          });
        }
      }

      // Resolve school if subdomain provided
      const school = await basePrisma.school.findFirst({
        where: {
          OR: [
            { id: tenantId },
            { subdomain: tenantId.toLowerCase().trim() },
            { slug: tenantId.toLowerCase().trim() },
          ],
        },
        select: { id: true },
      });

      const effectiveTenantId = school?.id || tenantId;

      const applicant = await storeApplication({
        tenantId: effectiveTenantId,
        firstName,
        lastName,
        classApplied,
        parentPhone,
        email,
        files,
      });

      return NextResponse.json({
        success: true,
        application_no: applicant.applicationNo,
        data: applicant,
      }, { status: 201 });
    }

    // JSON body fallback
    const json = await request.json();
    const tenantId = json.tenant_id || json.tenantId || json.schoolId || json.schoolDomain;
    const firstName = json.first_name || json.firstName;
    const lastName = json.last_name || json.lastName;
    const classApplied = json.class_applied || json.classApplied || json.targetGrade;
    const parentPhone = json.parent_phone || json.parentPhone || json.parentContact;
    const email = json.email || json.studentEmail || json.parentEmail;

    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { id: tenantId },
          { subdomain: tenantId.toLowerCase().trim() },
          { slug: tenantId.toLowerCase().trim() },
        ],
      },
      select: { id: true },
    });

    const effectiveTenantId = school?.id || tenantId;

    const applicant = await storeApplication({
      tenantId: effectiveTenantId,
      firstName,
      lastName,
      classApplied,
      parentPhone,
      email,
    });

    return NextResponse.json({
      success: true,
      application_no: applicant.applicationNo,
      data: applicant,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to store application" }, { status: 500 });
  }
}
