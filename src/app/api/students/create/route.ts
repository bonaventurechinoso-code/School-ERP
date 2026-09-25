import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/lib/security-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      schoolId: requestedSchoolId,
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

    // Resolve School
    let school = null;
    if (requestedSchoolId) {
      school = await basePrisma.school.findFirst({
        where: {
          OR: [
            { id: requestedSchoolId },
            { subdomain: requestedSchoolId.toLowerCase().trim() },
            { slug: requestedSchoolId.toLowerCase().trim() },
          ],
        },
        include: { academicTiers: { orderBy: { level: "asc" } } },
      });
    }

    if (!school) {
      school = await basePrisma.school.findFirst({
        include: { academicTiers: { orderBy: { level: "asc" } } },
      });
    }

    if (!school) {
      return NextResponse.json({ error: "No school found to register student." }, { status: 400 });
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

    const userEmail =
      normalizedEmail ||
      `${finalAdmissionNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}@student.${school.subdomain || "portal"}`;

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

    // 2. Fee calculation from payments/invoices if available
    let computedFeeStatus = feeStatus || "UNPAID";
    const existingInvoices = await basePrisma.invoice.findMany({
      where: { schoolId, student: { admissionNumber: finalAdmissionNumber } },
    }).catch(() => []);

    if (existingInvoices.length > 0) {
      const totalInvoiced = existingInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.totalAmount) || 0), 0);
      const totalPaid = existingInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.paidAmount) || 0), 0);
      if (totalPaid >= totalInvoiced && totalInvoiced > 0) {
        computedFeeStatus = "PAID";
      } else if (totalPaid > 0) {
        computedFeeStatus = "PARTIAL";
      }
    }

    // 3. Create Student record linked to User via userId
    const student = await basePrisma.student.create({
      data: {
        schoolId,
        userId: user.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: userEmail,
        admissionNumber: finalAdmissionNumber,
        currentClass: currentClass || "JSS 1",
        tierId: finalTierId,
        parentName: parentName || null,
        parentEmail: parentEmail || null,
        parentPhone: parentPhone || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        stateOfOrigin: stateOfOrigin || null,
        feeStatus: computedFeeStatus,
        status: "ACTIVE",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            mustChangePassword: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Student created successfully.",
        student: {
          ...student,
          tempPassword: generatedTempPassword,
          mustChangePassword: true,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[POST /api/students/create] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
