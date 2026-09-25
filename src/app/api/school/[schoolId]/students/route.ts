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
      feeStatus,
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
    const generatedTempPassword = tempPassword || password || "Password@123";
    const hashedPassword = await bcrypt.hash(generatedTempPassword, BCRYPT_ROUNDS);

    let finalAdmissionNumber = admissionNumber;
    if (!finalAdmissionNumber) {
      const studentCount = await basePrisma.student.count({ where: { schoolId } });
      const prefix = school.subdomain ? school.subdomain.toUpperCase().slice(0, 3) : "SCH";
      const year = new Date().getFullYear();
      const seq = String(studentCount + 1).padStart(3, "0");
      finalAdmissionNumber = `${prefix}/${year}/${seq}`;
    }

    const userEmail = normalizedEmail || `${finalAdmissionNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}@student.${school.subdomain || "portal"}`;

    // 1. Authoritative User table record with role = "STUDENT" and mustChangePassword = true
    const user = await basePrisma.user.upsert({
      where: { schoolId_email: { schoolId, email: userEmail } },
      update: {
        passwordHash: hashedPassword,
        role: "STUDENT",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        status: "ACTIVE",
        mustChangePassword: true,
      },
      create: {
        schoolId,
        email: userEmail,
        passwordHash: hashedPassword,
        role: "STUDENT",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });

    // Determine initial feeStatus based on Fee Payment table or existing payment proofs
    let initialFeeStatus = feeStatus || "UNPAID";
    if (!feeStatus) {
      const existingPayment = await basePrisma.payment.findFirst({
        where: {
          OR: [
            ...(normalizedEmail ? [{ student: { email: normalizedEmail } }] : []),
            { student: { admissionNumber: finalAdmissionNumber } },
          ],
        },
      });
      if (existingPayment) {
        initialFeeStatus = "PAID";
      }
    }

    // 2. Create Student with userId foreign key linking directly to User.id
    const student = await basePrisma.student.create({
      data: {
        schoolId,
        userId: user.id,
        tierId: finalTierId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        admissionNumber: finalAdmissionNumber,
        currentClass: currentClass || null,
        status: "ENROLLED",
        mustChangePassword: true,
        feeStatus: initialFeeStatus,
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
      include: {
        user: { select: { role: true, mustChangePassword: true, status: true } },
      },
    });

    // 3. Mark user security status
    await setUserMustChangePassword(user.id, schoolId, true);

    return NextResponse.json(
      {
        success: true,
        student,
        user,
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
