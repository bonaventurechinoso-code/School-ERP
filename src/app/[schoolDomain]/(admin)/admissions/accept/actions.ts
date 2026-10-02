"use server";

import { basePrisma, getPrismaClientForTier, invalidateTierConnection, resolveTierIdForTierDb } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { generateAdmissionNumber } from "@/lib/tenant-tier-utils";
import { invalidateAdmissionsNamespace, invalidateStudentNamespace } from "@/lib/cache-invalidation";
import { sendStudentEnrollmentConfirmationEmail } from "@/lib/email-service";

export async function acceptOfferAction(token: string, schoolDomain: string) {
  try {
    const school = await basePrisma.school.findUnique({
      where: { subdomain: schoolDomain },
      select: { id: true, subdomain: true, name: true },
    });
    if (!school) throw new Error("School not found");

    const lead = await basePrisma.admissionLead.findUnique({
      where: { offerToken: token },
      include: { tier: true },
    });

    if (!lead || lead.status !== "APPROVED") {
      throw new Error("Invalid or expired offer token");
    }

    // 1. DYNAMIC ENROLLMENT TARGET ROUTING:
    // Resolve applicant's designated tier and route write directly to that tier's database
    const targetTier = lead.tier?.name || lead.tierId;
    const tierDb = await getPrismaClientForTier(school.id, targetTier);
    const isolatedTierId = await resolveTierIdForTierDb(tierDb, school.id, {
      id: lead.tierId,
      name: lead.tier?.name,
      level: lead.tier?.level,
    });

    // Map names
    const names = (lead.applicantName || "").trim().split(" ");
    const firstName = names[0] || "Student";
    const lastName = names.length > 1 ? names.slice(1).join(" ") : "Enrolled";

    // Compute unique admission number with authentic tier code (e.g. GW/SEC/2026/001)
    const studentCount = await tierDb.student.count();
    const admissionNumber = generateAdmissionNumber({
      schoolSubdomain: school.subdomain,
      tierName: lead.tier?.name,
      currentClass: lead.targetGrade,
      studentSequence: studentCount + 1,
    });

    // 2. Create or update Student profile in the isolated tier database
    const existingStudent = await tierDb.student.findFirst({
      where: {
        schoolId: school.id,
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
          schoolId: school.id,
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

    // 3. Update central lead status
    await basePrisma.admissionLead.update({
      where: { id: lead.id },
      data: { status: "ENROLLED", updatedAt: new Date() },
    });

    // 4. Invalidate tier connection and sync cache
    invalidateTierConnection();
    await Promise.all([
      invalidateAdmissionsNamespace(school.id),
      invalidateStudentNamespace(school.id, targetTier),
    ]);

    try {
      revalidatePath(`/${schoolDomain}/students`);
      revalidatePath(`/${schoolDomain}/admissions`);
      revalidatePath(`/${schoolDomain}/admissions/accept`);
      revalidatePath(`/${schoolDomain}/dashboard`);
      revalidatePath("/[schoolDomain]/(admin)/students", "page");
      revalidatePath("/[schoolDomain]/(admin)/admissions", "page");
    } catch {
      // safe fallback
    }

    // Dispatch enrollment confirmation email to student / parent
    try {
      await sendStudentEnrollmentConfirmationEmail({
        schoolId: school.id,
        schoolName: school.name,
        subdomain: school.subdomain,
        studentName: `${firstName} ${lastName}`.trim(),
        admissionNumber,
        currentClass: lead.targetGrade,
        tierName: targetTier,
        studentEmail: lead.studentEmail,
        parentEmail: lead.parentEmail,
        parentName: lead.parentName,
      });
    } catch (emailErr) {
      console.error("[EMAIL_DISPATCH] Student enrollment confirmation error in acceptOfferAction:", emailErr);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in acceptOfferAction:", error);
    return { error: error.message };
  }
}

export async function declineOfferAction(token: string, schoolDomain: string) {
  try {
    const school = await basePrisma.school.findUnique({
      where: { subdomain: schoolDomain },
    });
    if (!school) throw new Error("School not found");

    const lead = await basePrisma.admissionLead.findUnique({
      where: { offerToken: token },
    });

    if (!lead || lead.status !== "APPROVED") {
      throw new Error("Invalid or expired offer token");
    }

    await basePrisma.admissionLead.update({
      where: { id: lead.id },
      data: { status: "REJECTED", updatedAt: new Date() },
    });

    await invalidateAdmissionsNamespace(school.id);

    revalidatePath(`/${schoolDomain}/admissions/accept`);
    revalidatePath(`/${schoolDomain}/admissions`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
