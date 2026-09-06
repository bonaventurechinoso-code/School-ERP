import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { sendAdmissionOfferEmail } from "@/lib/email-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { status, schoolId } = await request.json();

    if (!schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const tenantDb = getTenantClient(schoolId);

    // If status is APPROVED, generate offer token and send email
    if (status === "APPROVED") {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days

      const updatedLead = await tenantDb.admissionLead.update({
        where: { id: params.id },
        data: { 
          status,
          offerToken: token,
          offerExpiresAt: expiresAt
        }
      });

      const school = await basePrisma.school.findUnique({ where: { id: schoolId } });
      if (school) {
        // Send notification email
        await sendAdmissionOfferEmail(updatedLead, school, token);
      }
    } else if (status === "ENROLLED") {
      await basePrisma.$transaction(async (tx) => {
        // 1. Update lead
        const updatedLead = await tx.admissionLead.update({
          where: { id: params.id, schoolId },
          data: { status }
        });

        // 2. Extract first/last name
        const names = updatedLead.applicantName.split(" ");
        const firstName = names[0];
        const lastName = names.length > 1 ? names.slice(1).join(" ") : "Student";

        // 3. Create student using basePrisma within the transaction
        await tx.student.create({
          data: {
            schoolId,
            tierId: updatedLead.tierId,
            firstName,
            lastName,
            parentPhone: updatedLead.parentContact,
            status: "ENROLLED",
            enrolledAt: new Date(),
          }
        });
      });
    } else {
      await tenantDb.admissionLead.update({
        where: { id: params.id },
        data: { status }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to update lead status", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
