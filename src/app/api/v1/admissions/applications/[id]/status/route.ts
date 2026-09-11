import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getPrismaClientForTier, invalidateTierConnection, resolveTierIdForTierDb } from "@/lib/tenant-prisma";
import { sendAdmissionOfferEmail } from "@/lib/email-service";
import { revalidatePath } from "next/cache";

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

    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, subdomain: true },
    });

    let updatedLead;

    if (status === "APPROVED") {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days

      updatedLead = await basePrisma.admissionLead.update({
        where: { id },
        data: {
          status,
          offerToken: token,
          offerExpiresAt: expiresAt,
        },
      });

      if (school) {
        try {
          await sendAdmissionOfferEmail(updatedLead, school as any, token);
        } catch (mailErr) {
          console.warn("Failed to dispatch admission offer email:", mailErr);
        }
      }
    } else if (status === "ENROLLED") {
      // 1. DYNAMIC ENROLLMENT TARGET ROUTING:
      const lead = await basePrisma.admissionLead.findUnique({
        where: { id },
        include: { tier: true },
      });

      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }

      const targetTier = lead.tier?.name || lead.tierId;
      const tierDb = await getPrismaClientForTier(schoolId, targetTier);
      const isolatedTierId = await resolveTierIdForTierDb(tierDb, schoolId, {
        id: lead.tierId,
        name: lead.tier?.name,
        level: lead.tier?.level,
      });

      const names = (lead.applicantName || "").trim().split(" ");
      const firstName = names[0] || "Student";
      const lastName = names.length > 1 ? names.slice(1).join(" ") : "Enrolled";

      const studentCount = await tierDb.student.count();
      const prefix = school?.subdomain ? school.subdomain.toUpperCase().substring(0, 3) : "SCH";
      const year = new Date().getFullYear();
      const seq = String(studentCount + 1).padStart(3, "0");
      const admissionNumber = `${prefix}/${year}/${seq}`;

      // Write directly into the isolated tier database's Student table
      const existingStudent = await tierDb.student.findFirst({
        where: {
          schoolId,
          OR: [
            ...(lead.studentEmail ? [{ email: lead.studentEmail }] : []),
            { admissionNumber },
          ],
        },
      });

      if (existingStudent) {
        await tierDb.student.update({
          where: { id: existingStudent.id },
          data: {
            status: "ENROLLED",
            enrolledAt: new Date(),
            tierId: isolatedTierId,
            currentClass: lead.targetGrade || existingStudent.currentClass,
          },
        });
      } else {
        await tierDb.student.create({
          data: {
            schoolId,
            tierId: isolatedTierId,
            firstName,
            lastName,
            email: lead.studentEmail || null,
            parentPhone: lead.parentPhone || lead.parentContact || null,
            parentEmail: lead.parentEmail || null,
            parentName: lead.parentName || null,
            currentClass: lead.targetGrade || null,
            admissionNumber,
            status: "ENROLLED",
            enrolledAt: new Date(),
          },
        });
      }

      updatedLead = await basePrisma.admissionLead.update({
        where: { id },
        data: { status: "ENROLLED", updatedAt: new Date() },
      });

      invalidateTierConnection();
      try {
        if (school?.subdomain) {
          revalidatePath(`/${school.subdomain}/students`);
          revalidatePath(`/${school.subdomain}/admissions`);
          revalidatePath(`/${school.subdomain}/dashboard`);
        }
        revalidatePath("/[schoolDomain]/(admin)/students", "page");
        revalidatePath("/[schoolDomain]/(admin)/admissions", "page");
      } catch {
        // safe fallback
      }
    } else {
      updatedLead = await basePrisma.admissionLead.update({
        where: { id },
        data: { status },
      });

      try {
        if (school?.subdomain) {
          revalidatePath(`/${school.subdomain}/admissions`);
          revalidatePath(`/${school.subdomain}/dashboard`);
        }
      } catch {
        // safe fallback
      }
    }

    return NextResponse.json({ success: true, data: updatedLead });
  } catch (error: any) {
    console.error("Error updating admission lead status:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
