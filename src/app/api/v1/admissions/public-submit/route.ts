import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { triggerInquiryNotification } from "@/lib/admissions-events";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { 
      schoolDomain, 
      applicantName, 
      studentEmail,
      studentPhone,
      parentName, 
      parentContact, 
      parentEmail, 
      tierId, 
      targetGrade 
    } = data;

    if (!schoolDomain || !applicantName || !tierId || !targetGrade) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Lookup tenant ID from slug
    const school = await basePrisma.school.findUnique({
      where: { subdomain: schoolDomain }
    });

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const tenantDb = getTenantClient(school.id);

    // Insert new application explicitly as INQUIRY
    const newLead = await tenantDb.admissionLead.create({
      data: {
        schoolId: school.id,
        applicantName,
        studentEmail,
        studentPhone,
        parentName,
        parentContact: parentContact || "N/A", // Ensure backward compatibility or required schema field
        parentPhone: parentContact || null,
        parentEmail,
        tierId,
        targetGrade,
        source: "Website",
        status: "INQUIRY", // Force explicitly to INQUIRY
      }
    });

    // Trigger initial inquiry email automation
    triggerInquiryNotification({
      leadId: newLead.id,
      schoolId: school.id,
      lead: newLead,
      school,
    });

    return NextResponse.json({ success: true, lead: newLead });
  } catch (error: any) {
    console.error("Public submission error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit application" }, { status: 500 });
  }
}
