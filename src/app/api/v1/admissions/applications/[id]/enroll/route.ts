import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getPrismaClientForTier, invalidateTierConnection, resolveTierIdForTierDb } from "@/lib/tenant-prisma";
import { invalidateStudentNamespace, invalidateAdmissionsNamespace } from "@/lib/cache-invalidation";
import { revalidatePath } from "next/cache";
import { sendStudentEnrollmentConfirmationEmail } from "@/lib/mail";

export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await paramsPromise;
  try {
    const { id } = resolvedParams;
    const body = await req.json();
    const { schoolId } = body;

    if (!schoolId) {
      return NextResponse.json(
        { error: "schoolId is required" },
        { status: 400 }
      );
    }

    // 1. Fetch the lead with its designated academic tier
    const lead = await basePrisma.admissionLead.findUnique({
      where: { id },
      include: { tier: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.status === "ENROLLED") {
      return NextResponse.json({ error: "Lead is already enrolled" }, { status: 400 });
    }

    // 2. DYNAMIC ENROLLMENT TARGET ROUTING:
    // Detect the applicant's designated tier and initialize that isolated tier's Prisma client
    const targetTier = lead.tier?.name || lead.tierId;
    const tierDb = await getPrismaClientForTier(schoolId, targetTier);
    const isolatedTierId = await resolveTierIdForTierDb(tierDb, schoolId, {
      id: lead.tierId,
      name: lead.tier?.name,
      level: lead.tier?.level,
    });

    const school = await basePrisma.school.findUnique({ 
      where: { id: schoolId },
      select: { id: true, subdomain: true, name: true }
    });

    const [firstName, ...lastNameParts] = (lead.applicantName || "").trim().split(" ");
    const lastName = lastNameParts.join(" ") || "Enrolled";

    // Compute unique admission number within the designated tier database
    const studentCount = await tierDb.student.count();
    const prefix = school ? school.subdomain.toUpperCase().substring(0, 3) : "SCH";
    const year = new Date().getFullYear();
    const seq = String(studentCount + 1).padStart(3, '0');
    const admissionNumber = `${prefix}/${year}/${seq}`;

    // 3. Write finalized student profile directly into the isolated tier database's Student table
    const existingStudent = await tierDb.student.findFirst({
      where: {
        schoolId: lead.schoolId,
        OR: [
          ...(lead.studentEmail ? [{ email: lead.studentEmail }] : []),
          { admissionNumber },
        ],
      },
    });

    let newStudent;
    if (existingStudent) {
      newStudent = await tierDb.student.update({
        where: { id: existingStudent.id },
        data: {
          status: "ENROLLED",
          enrolledAt: new Date(),
          tierId: isolatedTierId,
          currentClass: lead.targetGrade || existingStudent.currentClass,
        },
      });
    } else {
      newStudent = await tierDb.student.create({
        data: {
          schoolId: lead.schoolId,
          tierId: isolatedTierId,
          firstName: firstName || "Student",
          lastName,
          email: lead.studentEmail || null,
          parentName: lead.parentName || null,
          parentEmail: lead.parentEmail || null,
          parentPhone: lead.parentPhone || lead.parentContact || null,
          currentClass: lead.targetGrade || null,
          admissionNumber,
          status: "ENROLLED",
          enrolledAt: new Date(),
        },
      });
    }

    // 4. Update the AdmissionLead status to ENROLLED in the central admissions schema
    const updatedLead = await basePrisma.admissionLead.update({
      where: { id },
      data: {
        status: "ENROLLED",
        updatedAt: new Date(),
      },
    });

    // 5. ROSTER DYNAMIC SYNC REFRESH:
    // Invalidate cached views across students, admissions, and dashboard layouts
    invalidateTierConnection();
    await Promise.all([
      invalidateStudentNamespace(schoolId, lead.tier?.name),
      invalidateAdmissionsNamespace(schoolId),
    ]);
    try {
      if (school?.subdomain) {
        revalidatePath(`/${school.subdomain}/students`);
        revalidatePath(`/${school.subdomain}/admissions`);
        revalidatePath(`/${school.subdomain}/dashboard`);
        revalidatePath(`/${school.subdomain}/scheduling`);
      }
      revalidatePath("/[schoolDomain]/(admin)/students", "page");
      revalidatePath("/[schoolDomain]/(admin)/admissions", "page");
      revalidatePath("/[schoolDomain]/(admin)/dashboard", "page");
    } catch {
      // safe fallback
    }

    // Dispatch enrollment confirmation email to student / parent
    try {
      const emailResult = await sendStudentEnrollmentConfirmationEmail({
        schoolId: lead.schoolId,
        studentId: newStudent.id,
        schoolName: school?.name,
        subdomain: school?.subdomain,
        studentName: `${firstName} ${lastName}`.trim(),
        admissionNumber,
        currentClass: lead.targetGrade,
        tierName: lead.tier?.name,
        studentEmail: lead.studentEmail,
        parentEmail: lead.parentEmail,
        parentName: lead.parentName,
      });

      if (!emailResult.success) {
        console.error(`[EMAIL_SYNC_ERROR] [STUDENT_ENROLLMENT] Delivery failure for student ${newStudent.id}:`, emailResult.error);
      }
    } catch (emailErr) {
      console.error("[EMAIL_SYNC_ERROR] [STUDENT_ENROLLMENT] Student enrollment confirmation error in api enroll route:", emailErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        student: newStudent,
        lead: updatedLead,
        tierName: lead.tier?.name || "Default Tier",
        databaseRouting: "isolated_tier_db",
      },
    });
  } catch (error: any) {
    console.error("Error finalizing enrollment into tier database:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
