import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import { setUserMustChangePassword, BCRYPT_ROUNDS } from "@/lib/security-service";
import { sendStaffEnrollmentConfirmationEmail } from "@/lib/email-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      role = "TEACHER",
      schoolId: requestedSchoolId,
      schoolDomain,
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

    const normalizedEmail = email.trim().toLowerCase();

    // Resolve school
    let school = null;
    if (requestedSchoolId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedSchoolId);
      school = await basePrisma.school.findFirst({
        where: isUuid
          ? { id: requestedSchoolId }
          : { OR: [{ subdomain: requestedSchoolId.toLowerCase().trim() }, { slug: requestedSchoolId.toLowerCase().trim() }] },
      });
    } else if (schoolDomain) {
      school = await basePrisma.school.findFirst({
        where: {
          OR: [{ subdomain: schoolDomain.toLowerCase().trim() }, { slug: schoolDomain.toLowerCase().trim() }],
        },
      });
    }

    if (!school) {
      school = await basePrisma.school.findFirst();
    }

    if (!school) {
      return NextResponse.json(
        { error: "Institution context could not be resolved." },
        { status: 400 }
      );
    }

    const schoolId = school.id;
    const generatedTempPassword = tempPassword || password || "Password@123";
    const hashedPassword = await bcrypt.hash(generatedTempPassword, BCRYPT_ROUNDS);

    // Normalize role
    const rawRole = (role || "").toUpperCase();
    let canonicalRole: any = "TEACHER";
    if (rawRole.includes("VICE PRINCIPAL")) canonicalRole = "VICE_PRINCIPAL";
    else if (rawRole.includes("PRINCIPAL")) canonicalRole = "PRINCIPAL";
    else if (rawRole.includes("HEADMASTER")) canonicalRole = "HEADMASTER";
    else if (rawRole.includes("BURSAR")) canonicalRole = "BURSAR";
    else if (rawRole.includes("ADMIN")) canonicalRole = "SCHOOL_ADMIN";
    else canonicalRole = "TEACHER";

    // Resolve department
    let finalDeptId = departmentId;
    if (!finalDeptId) {
      const existingDept = await basePrisma.department.findFirst({ where: { schoolId } });
      if (existingDept) {
        finalDeptId = existingDept.id;
      } else {
        const createdDept = await basePrisma.department.create({
          data: { name: "Academic Administration", schoolId },
        });
        finalDeptId = createdDept.id;
      }
    }

    // 1. Authoritative User table record with mustChangePassword = true
    const user = await basePrisma.user.upsert({
      where: { schoolId_email: { schoolId, email: normalizedEmail } },
      update: {
        passwordHash: hashedPassword,
        role: canonicalRole,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        status: "ACTIVE",
        mustChangePassword: true,
      },
      create: {
        schoolId,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role: canonicalRole,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });

    // 2. Staff table record linked via userId foreign key (no duplicate role or auth fields)
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
          status: "ACTIVE",
          departmentId: finalDeptId || null,
          baseSalary: baseSalary ? Number(baseSalary) : null,
          bankName: bankName || null,
          bankAccountNumber: bankAccountNumber || null,
          accountName: accountName || null,
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

    await setUserMustChangePassword(user.id, schoolId, true);

    // Dispatch enrollment confirmation email to staff member
    try {
      await sendStaffEnrollmentConfirmationEmail({
        schoolId,
        staffId: staff.id,
        schoolName: school.name,
        subdomain: school.subdomain,
        staffName: `${firstName.trim()} ${lastName.trim()}`,
        staffEmail: normalizedEmail,
        role: canonicalRole,
        departmentId: finalDeptId || null,
        temporaryPassword: generatedTempPassword,
      });
    } catch (emailErr) {
      console.error("[EMAIL_DISPATCH] Staff enrollment confirmation error in api/staff/create:", emailErr);
    }

    return NextResponse.json(
      {
        success: true,
        staff: {
          ...staff,
          role: canonicalRole,
          mustChangePassword: true,
        },
        user,
        tempPassword: generatedTempPassword,
        mustChangePassword: true,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[STAFF_CREATE_API_ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create staff member." },
      { status: 500 }
    );
  }
}
