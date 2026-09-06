import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { schoolId } = body;

    if (!schoolId) {
      return NextResponse.json(
        { error: "schoolId is required" },
        { status: 400 }
      );
    }

    const prisma = getTenantClient(schoolId);

    // Fetch the lead
    const lead = await prisma.admissionLead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.status === "ENROLLED") {
      return NextResponse.json({ error: "Lead is already enrolled" }, { status: 400 });
    }

    // Process enrollment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Student record
      const [firstName, ...lastNameParts] = lead.applicantName.split(" ");
      const lastName = lastNameParts.join(" ") || "Unknown";

      const school = await basePrisma.school.findUnique({ where: { id: schoolId } });
      const studentCount = await tx.student.count();
      const prefix = school ? school.subdomain.toUpperCase().substring(0, 3) : "SCH";
      const year = new Date().getFullYear();
      const seq = String(studentCount + 1).padStart(3, '0');
      const admissionNumber = `${prefix}/${year}/${seq}`;

      const newStudent = await tx.student.create({
        data: {
          schoolId: lead.schoolId,
          tierId: lead.tierId,
          firstName,
          lastName,
          email: lead.studentEmail,
          parentName: lead.parentName,
          parentEmail: lead.parentEmail,
          parentPhone: lead.parentPhone,
          currentClass: lead.targetGrade,
          admissionNumber,
          status: "ENROLLED",
          enrolledAt: new Date(),
        },
      });

      // 2. Update the AdmissionLead status to ENROLLED
      const updatedLead = await tx.admissionLead.update({
        where: { id },
        data: {
          status: "ENROLLED",
          updatedAt: new Date(),
        },
      });

      return { student: newStudent, lead: updatedLead };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error finalizing enrollment:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
