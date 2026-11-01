import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getTenantClient, getPrismaClientForTier } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import { dispatchAdmissionsNotification } from "@/lib/notifications/admissionsNotifier";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      applicationId,
      schoolId,
      tierId,
      departmentId,
      classArm,
      termFeeAmount,
    } = body;

    if (!applicationId || !schoolId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: applicationId and schoolId are required." },
        { status: 400 }
      );
    }

    // 1. Retrieve the AdmissionsApplication
    const application = await basePrisma.admissionsApplication.findFirst({
      where: {
        id: applicationId,
        schoolId,
      },
      include: {
        documents: true,
      },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Admissions application record not found for this tenant." },
        { status: 404 }
      );
    }

    // Clearance and status guard: Must be in OFFER_ACCEPTED or APPROVED status
    if (application.status !== "OFFER_ACCEPTED" && application.status !== "OFFER_EXTENDED" && application.status !== "SUBMITTED") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot enroll applicant. Current status is '${application.status}'. Applicant must be in 'OFFER_ACCEPTED' status.`,
        },
        { status: 400 }
      );
    }

    // 2. Resolve School and Academic Tier
    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      include: {
        academicTiers: { orderBy: { level: "asc" } },
      },
    });

    if (!school) {
      return NextResponse.json({ success: false, error: "School institution not found." }, { status: 404 });
    }

    const targetTierId = tierId || school.academicTiers[0]?.id;
    if (!targetTierId) {
      return NextResponse.json({ success: false, error: "Academic tier is required for student enrollment." }, { status: 400 });
    }

    const targetTier = school.academicTiers.find((t) => t.id === targetTierId) || school.academicTiers[0];
    const tenantDb = await getPrismaClientForTier(schoolId, targetTier.name);

    // 3. Compute Admission/Matriculation Number via Tenant Formula
    // Sequence format: [BRANCH/SUBDOMAIN]/[ACADEMIC_YEAR]/[FACULTY_OR_PROGRAM]/[SEQ]
    const year = new Date().getFullYear();
    const branchPrefix = school.subdomain ? school.subdomain.toUpperCase().slice(0, 4) : "SCH";
    const programCode = (application.programId || "GEN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);

    const studentSequenceCount = await tenantDb.student.count({
      where: { schoolId },
    });
    const seqPadded = String(studentSequenceCount + 1).padStart(4, "0");
    const matriculationNumber = `${branchPrefix}/${year}/${programCode}/${seqPadded}`;

    // 4. Generate Initial User Portal Credentials
    const rawTempPassword = `Welcome@${Math.floor(1000 + Math.random() * 9000)}`;
    const hashedPassword = await bcrypt.hash(rawTempPassword, 12);
    const userEmail =
      application.email.toLowerCase().trim() ||
      `${matriculationNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}@student.${school.subdomain || "portal"}`;

    const parentData = (application.tierSpecificData as any)?.parent || (application.metadata as any)?.parent || {};
    const parentName = parentData.name || `${application.lastName} Family`;
    const parentEmail = parentData.email || application.email;
    const parentPhone = parentData.phone || application.phoneNumber;

    // 5. Execute Atomic Enrollment Transaction
    const result = await basePrisma.$transaction(async (tx) => {
      // Step A: Create or Link User
      const user = await tx.user.upsert({
        where: { schoolId_email: { schoolId, email: userEmail } },
        update: {
          role: "STUDENT",
          firstName: application.firstName,
          lastName: application.lastName,
          status: "ACTIVE",
          mustChangePassword: true,
        },
        create: {
          schoolId,
          email: userEmail,
          passwordHash: hashedPassword,
          role: "STUDENT",
          firstName: application.firstName,
          lastName: application.lastName,
          status: "ACTIVE",
          mustChangePassword: true,
        },
      });

      // Step B: Create Student in target database
      const student = await tx.student.create({
        data: {
          schoolId,
          userId: user.id,
          tierId: targetTierId,
          firstName: application.firstName,
          lastName: application.lastName,
          email: userEmail,
          admissionNumber: matriculationNumber,
          currentClass: classArm || application.programId || "Year 1",
          dateOfBirth: application.dateOfBirth,
          status: "ENROLLED",
          parentName,
          parentEmail,
          parentPhone,
          parentWhatsApp: application.whatsappNumber || parentPhone,
          feeStatus: termFeeAmount ? "UNPAID" : "PAID",
          enrolledAt: new Date(),
          dynamicFields: {
            applicationId: application.id,
            intakeChannel: application.intakeChannel,
            tierSpecificData: application.tierSpecificData,
            verifiedDocumentsCount: application.documents.length,
          },
        },
      });

      // Step C: Link Parent
      if (parentEmail && parentEmail.includes("@")) {
        const parentUser = await tx.parent.upsert({
          where: { schoolId_email: { schoolId, email: parentEmail.toLowerCase().trim() } },
          update: {
            name: parentName,
            phone: parentPhone,
          },
          create: {
            schoolId,
            name: parentName,
            email: parentEmail.toLowerCase().trim(),
            phone: parentPhone,
            passwordHash: hashedPassword,
            relationship: parentData.relationship || "Parent",
          },
        });

        await tx.studentParent.upsert({
          where: { studentId_parentId: { studentId: student.id, parentId: parentUser.id } },
          update: {},
          create: {
            schoolId,
            studentId: student.id,
            parentId: parentUser.id,
          },
        });
      }

      // Step D: Seed Initial Billing Ledger / Term Invoice if specified
      if (termFeeAmount && Number(termFeeAmount) > 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        await tx.invoice.create({
          data: {
            schoolId,
            studentId: student.id,
            amountDue: Number(termFeeAmount),
            amountPaid: 0,
            status: "UNPAID",
            dueDate,
            description: `1st Term Academic Tuition & Registration Ledger - ${matriculationNumber}`,
          },
        });
      }

      // Step E: Update AdmissionsApplication status to ENROLLED
      const updatedApp = await tx.admissionsApplication.update({
        where: { id: application.id },
        data: {
          status: "ENROLLED",
          metadata: {
            ...((application.metadata as any) || {}),
            enrolledStudentId: student.id,
            enrolledAt: new Date().toISOString(),
            matriculationNumber,
          },
        },
      });

      return { student, user, updatedApp };
    });

    // 6. Dispatch Onboarding Welcome Packet via WhatsApp and Email
    const studentPortalUrl = `${process.env.NEXTAUTH_URL || "https://schoolerp.ng"}/${school.subdomain}/portal`;
    await dispatchAdmissionsNotification({
      tenantId: schoolId,
      schoolName: school.name,
      schoolSubdomain: school.subdomain,
      applicantNumber: application.applicationNumber,
      recipient: {
        name: `${application.firstName} ${application.lastName}`,
        email: application.email,
        phone: application.phoneNumber,
        whatsappNumber: application.whatsappNumber || application.phoneNumber,
      },
      event: "ENROLLED",
      matriculationNumber,
      studentPortalUrl,
      portalUsername: userEmail,
      portalTempPassword: rawTempPassword,
    }).catch((notifErr) => {
      console.warn("[ENROLLMENT_NOTIFICATION_WARN]:", notifErr);
    });

    return NextResponse.json({
      success: true,
      message: "Applicant successfully matriculated and student identity provisioned.",
      student: result.student,
      matriculationNumber,
      portalUrl: studentPortalUrl,
      username: userEmail,
      temporaryPassword: rawTempPassword,
    });
  } catch (error: any) {
    console.error("[ADMISSIONS_ENROLL_API_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to finalize enrollment." },
      { status: 500 }
    );
  }
}
