import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import { setUserMustChangePassword, BCRYPT_ROUNDS } from "@/lib/security-service";

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
      departmentId,
      password,
      tempPassword,
      phone,
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

    const schoolId = school.id;
    const normalizedEmail = email.trim().toLowerCase();
    const generatedTempPassword = tempPassword || password || "Welcome123";
    const hashedPassword = await bcrypt.hash(generatedTempPassword, BCRYPT_ROUNDS);

    // Resolve or fallback department (e.g. Bursary / Finance)
    let finalDeptId = departmentId;
    if (!finalDeptId) {
      const existingDept = await basePrisma.department.findFirst({
        where: { schoolId },
      });
      if (existingDept) {
        finalDeptId = existingDept.id;
      } else {
        const createdDept = await basePrisma.department.upsert({
          where: { schoolId_name: { schoolId, name: "Bursary & Accounts" } },
          update: {},
          create: { name: "Bursary & Accounts", schoolId },
        });
        finalDeptId = createdDept.id;
      }
    }

    // 1. Create Staff with role = "BURSAR" and mustChangePassword = true
    const bursar = await basePrisma.staff.create({
      data: {
        schoolId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: "BURSAR",
        status: "ACTIVE",
        mustChangePassword: true,
        departmentId: finalDeptId || null,
        baseSalary: baseSalary ? Number(baseSalary) : null,
        bankName: bankName || null,
        bankAccountNumber: bankAccountNumber || null,
        accountName: accountName || null,
        activeAt: new Date(),
      },
    });

    // 2. Create / Upsert User with role = "BURSAR" and mustChangePassword = true
    await basePrisma.user.upsert({
      where: { schoolId_email: { schoolId, email: normalizedEmail } },
      update: {
        passwordHash: hashedPassword,
        role: "BURSAR",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mustChangePassword: true,
      },
      create: {
        id: bursar.id,
        schoolId,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role: "BURSAR",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mustChangePassword: true,
      },
    });

    // 3. Mark user security status
    await setUserMustChangePassword(bursar.id, schoolId, true);

    return NextResponse.json(
      {
        success: true,
        bursar,
        tempPassword: generatedTempPassword,
        mustChangePassword: true,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[CREATE_BURSAR_API_ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create bursar." },
      { status: 500 }
    );
  }
}
