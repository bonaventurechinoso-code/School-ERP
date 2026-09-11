import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { sendAdmissionOfferEmail } from "@/lib/email-service";

export async function PATCH(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await paramsPromise;
  try {
    const { id } = resolvedParams;
    const body = await req.json();
    const { status, schoolId } = body;

    if (!status || !schoolId) {
      return NextResponse.json(
        { error: "status and schoolId are required" },
        { status: 400 }
      );
    }

    const prisma = getTenantClient(schoolId);

    let updatedLead;

    if (status === "APPROVED") {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days

      updatedLead = await prisma.admissionLead.update({
        where: { id },
        data: {
          status,
          offerToken: token,
          offerExpiresAt: expiresAt,
        },
      });

      const school = await basePrisma.school.findUnique({ where: { id: schoolId } });
      if (school) {
        await sendAdmissionOfferEmail(updatedLead, school, token);
      }
    } else {
      updatedLead = await prisma.admissionLead.update({
        where: { id },
        data: { status },
      });
    }

    return NextResponse.json({ success: true, data: updatedLead });
  } catch (error: any) {
    console.error("Error updating admission lead status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
