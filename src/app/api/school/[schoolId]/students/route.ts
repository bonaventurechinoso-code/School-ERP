import { NextResponse } from "next/server";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import { setUserMustChangePassword, BCRYPT_ROUNDS } from "@/lib/security-service";

async function resolveSchool(schoolParam: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolParam);
  return basePrisma.school.findFirst({
    where: isUuid
      ? { id: schoolParam }
      : { OR: [{ subdomain: schoolParam.toLowerCase().trim() }, { slug: schoolParam.toLowerCase().trim() }, { id: schoolParam }] },
    include: {
      academicTiers: {
        orderBy: { level: "asc" },
      },
    },
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
      tierId,
      currentClass,
      admissionNumber,
      password,
      tempPassword,
      parentName,
      parentEmail,
      parentPhone,
      dateOfBirth,
      stateOfOrigin,
    } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required." },
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
    let finalTierId = tierId;
    if (!finalTierId) {
      const defaultTier = school.academicTiers[0] || (await basePrisma.academicTier.findFirst({ where: { schoolId } }));
      finalTierId = defaultTier?.id;
    }

    if (!finalTierId) {
      const createdTier = await basePrisma.academicTier.create({
        data: { name: "Primary", level: 1, schoolId },
      });
      finalTierId = createdTier.id;
    }

    const normalizedEmail = email ? email.trim().toLowerCase() : null;
    const generatedTempPassword = tempPassword || password || "Welcome123";
    const hashedPassword = await bcrypt.hash(generatedTempPassword, BCRYPT_ROUNDS);

    let finalAdmissionNumber = admissionNumber;
    if (!finalAdmissionNumber) {
      const studentCount = await basePrisma.student.count({ where: { schoolId } });
      const prefix = school.subdomain ? school.subdomain.toUpperCase().slice(0, 3) : "SCH";
      const year = new Date().getFullYear();
      const seq = String(studentCount + 1).padStart(3, "0");
      finalAdmissionNumber = `${prefix}/${year}/${seq}`;
    }

    // 1. Create Student with mustChangePassword = true in Prisma
    const student = await basePrisma.student.create({
      data: {
        schoolId,
        tierId: finalTierId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        admissionNumber: finalAdmissionNumber,
        currentClass: currentClass || null,
        status: "ENROLLED",
        mustChangePassword: true,
        dynamicFields: {
          password: hashedPassword,
          isTemporaryPassword: true,
        },
        parentName: parentName || null,
        parentEmail: parentEmail || null,
        parentPhone: parentPhone || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        stateOfOrigin: stateOfOrigin || null,
        enrolledAt: new Date(),
      },
    });

    // 2. If student has email or portal access, upsert into User table with mustChangePassword = true
    const userEmail = normalizedEmail || `${finalAdmissionNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}@student.${school.subdomain || "portal"}`;

    await basePrisma.user.upsert({
      where: { schoolId_email: { schoolId, email: userEmail } },
      update: {
        passwordHash: hashedPassword,
        role: "STUDENT",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mustChangePassword: true,
      },
      create: {
        id: student.id,
        schoolId,
        email: userEmail,
        passwordHash: hashedPassword,
        role: "STUDENT",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mustChangePassword: true,
      },
    }).catch(() => {});

    // 3. Mark user security status
    await setUserMustChangePassword(student.id, schoolId, true);

    return NextResponse.json(
      {
        success: true,
        student,
        tempPassword: generatedTempPassword,
        mustChangePassword: true,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[CREATE_STUDENT_API_ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create student." },
      { status: 500 }
    );
  }
}
