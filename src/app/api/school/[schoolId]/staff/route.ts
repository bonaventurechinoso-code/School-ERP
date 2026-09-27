import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import { setUserMustChangePassword, BCRYPT_ROUNDS } from "@/lib/security-service";
import { sendStaffEnrollmentConfirmationEmail } from "@/lib/email-service";

async function resolveSchool(schoolParam: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolParam);
  return basePrisma.school.findFirst({
    where: isUuid
      ? { id: schoolParam }
      : { OR: [{ subdomain: schoolParam.toLowerCase().trim() }, { slug: schoolParam.toLowerCase().trim() }, { id: schoolParam }] },
  });
}

export async function POST(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const { schoolId: schoolParam } = await paramsPromise;
    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      role = "TEACHER",
      departmentId,
      password,
      tempPassword,
      baseSalary,
      bankName,
      bankAccountNumber,
      accountName,
    } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "First name, last name, and email are required." },
        { status: 400 }
      );
    }

    const school = await resolveSchool(schoolParam);
    if (!school) {
      return NextResponse.json(
        { error: `School not found for identifier '${schoolParam}'.` },
        { status: 404 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const schoolId = school.id;
    const generatedTempPassword = tempPassword || password || "Password@123";
    const hashedPassword = await bcrypt.hash(generatedTempPassword, BCRYPT_ROUNDS);

    // Map role to standard Role enum
    const rawRole = (role || "").toUpperCase();
    let userRole = "TEACHER";
    if (rawRole.includes("VICE PRINCIPAL")) userRole = "VICE_PRINCIPAL";
    else if (rawRole.includes("PRINCIPAL")) userRole = "PRINCIPAL";
    else if (rawRole.includes("HEADMASTER")) userRole = "HEADMASTER";
    else if (rawRole.includes("BURSAR")) userRole = "BURSAR";
    else if (rawRole.includes("ADMIN")) userRole = "SCHOOL_ADMIN";

    // Resolve or fallback department
    let finalDeptId = departmentId;
    if (!finalDeptId) {
      const existingDept = await basePrisma.department.findFirst({
        where: { schoolId },
      });
      if (existingDept) {
        finalDeptId = existingDept.id;
      } else {
        const createdDept = await basePrisma.department.create({
          data: { name: "Academic Administration", schoolId },
        });
        finalDeptId = createdDept.id;
      }
    }

    // 1. Create or upsert in the single authoritative User table
    const user = await basePrisma.user.upsert({
      where: { schoolId_email: { schoolId, email: normalizedEmail } },
      update: {
        passwordHash: hashedPassword,
        role: userRole as any,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        status: "ACTIVE",
        mustChangePassword: true,
      },
      create: {
        schoolId,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role: userRole as any,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });

    // 2. Create Staff record with userId foreign key linking directly to User.id (no duplicate auth fields)
    const existingStaff = await basePrisma.staff.findFirst({
      where: { schoolId, email: normalizedEmail },
    });

    let staff;
    if (existingStaff) {
      staff = await basePrisma.staff.update({
        where: { id: existingStaff.id },
        data: {
          userId: user.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          departmentId: finalDeptId || null,
          baseSalary: baseSalary ? Number(baseSalary) : null,
          bankName: bankName || null,
          bankAccountNumber: bankAccountNumber || null,
          accountName: accountName || null,
          status: "ACTIVE",
        },
        include: {
          user: { select: { role: true, mustChangePassword: true, status: true } },
        },
      });
    } else {
      staff = await basePrisma.staff.create({
        data: {
          schoolId,
          userId: user.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: normalizedEmail,
          status: "ACTIVE",
          departmentId: finalDeptId || null,
          baseSalary: baseSalary ? Number(baseSalary) : null,
          bankName: bankName || null,
          bankAccountNumber: bankAccountNumber || null,
          accountName: accountName || null,
          activeAt: new Date(),
        },
        include: {
          user: { select: { role: true, mustChangePassword: true, status: true } },
        },
      });
    }

    // 3. Mark user security status
    await setUserMustChangePassword(user.id, schoolId, true);

    // Dispatch enrollment confirmation email to staff member
    sendStaffEnrollmentConfirmationEmail({
      schoolId,
      staffId: staff.id,
      schoolName: school.name,
      subdomain: school.subdomain,
      staffName: `${firstName.trim()} ${lastName.trim()}`,
      staffEmail: normalizedEmail,
      role: userRole,
      departmentId: finalDeptId || null,
      temporaryPassword: generatedTempPassword,
    }).catch((emailErr) => {
      console.error("[EMAIL_DISPATCH] Staff enrollment confirmation error in api/school/[schoolId]/staff:", emailErr);
    });

    return NextResponse.json(
      {
        success: true,
        staff: {
          ...staff,
          role: userRole,
          mustChangePassword: true,
        },
        user,
        tempPassword: generatedTempPassword,
        mustChangePassword: true,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[CREATE_STAFF_API_ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create staff member." },
      { status: 500 }
    );
  }
}
