import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import { setUserMustChangePassword, BCRYPT_ROUNDS } from "@/lib/security-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      role = "TEACHER",
      firstName,
      lastName,
      schoolId: requestedSchoolId,
      schoolDomain,
      password,
      tempPassword,
      departmentId,
    } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required.", code: "MISSING_EMAIL" },
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
        { error: "Institution context could not be resolved.", code: "SCHOOL_NOT_FOUND" },
        { status: 400 }
      );
    }

    const schoolId = school.id;
    const generatedTempPassword = tempPassword || password || "Password@123";
    const hashedPassword = await bcrypt.hash(generatedTempPassword, BCRYPT_ROUNDS);

    // Normalize role to Role enum
    const rawRole = (role || "").toUpperCase();
    let canonicalRole: any = "TEACHER";
    if (rawRole.includes("SUPER")) canonicalRole = "SUPER_ADMIN";
    else if (rawRole.includes("PRINCIPAL") && rawRole.includes("VICE")) canonicalRole = "VICE_PRINCIPAL";
    else if (rawRole.includes("PRINCIPAL")) canonicalRole = "PRINCIPAL";
    else if (rawRole.includes("HEADMASTER")) canonicalRole = "HEADMASTER";
    else if (rawRole.includes("BURSAR")) canonicalRole = "BURSAR";
    else if (rawRole.includes("ADMIN")) canonicalRole = "SCHOOL_ADMIN";
    else if (rawRole.includes("STUDENT")) canonicalRole = "STUDENT";
    else canonicalRole = "TEACHER";

    // 1. Authoritative User table record with mustChangePassword = true
    const user = await basePrisma.user.upsert({
      where: { schoolId_email: { schoolId, email: normalizedEmail } },
      update: {
        passwordHash: hashedPassword,
        role: canonicalRole,
        firstName: firstName?.trim() || undefined,
        lastName: lastName?.trim() || undefined,
        status: "ACTIVE",
        mustChangePassword: true,
      },
      create: {
        schoolId,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role: canonicalRole,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });

    // 2. Link to Staff or Student based on role
    if (canonicalRole === "STUDENT") {
      const existingStudent = await basePrisma.student.findFirst({
        where: { schoolId, email: normalizedEmail },
      });
      if (existingStudent) {
        await basePrisma.student.update({
          where: { id: existingStudent.id },
          data: { userId: user.id },
        });
      } else {
        const tier = await basePrisma.academicTier.findFirst({ where: { schoolId } });
        if (tier) {
          await basePrisma.student.create({
            data: {
              schoolId,
              userId: user.id,
              tierId: tier.id,
              firstName: firstName?.trim() || "Student",
              lastName: lastName?.trim() || "User",
              email: normalizedEmail,
              status: "ENROLLED",
              mustChangePassword: true,
            },
          });
        }
      }
    } else if (canonicalRole !== "SUPER_ADMIN") {
      const existingStaff = await basePrisma.staff.findFirst({
        where: { schoolId, email: normalizedEmail },
      });
      if (existingStaff) {
        await basePrisma.staff.update({
          where: { id: existingStaff.id },
          data: { userId: user.id },
        });
      } else {
        await basePrisma.staff.create({
          data: {
            schoolId,
            userId: user.id,
            firstName: firstName?.trim() || "Staff",
            lastName: lastName?.trim() || "User",
            email: normalizedEmail,
            status: "ACTIVE",
            departmentId: departmentId || null,
          },
        });
      }
    }

    await setUserMustChangePassword(user.id, schoolId, true);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          mustChangePassword: true,
        },
        tempPassword: generatedTempPassword,
        mustChangePassword: true,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[CREATE_USER_API_ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create user." },
      { status: 500 }
    );
  }
}
