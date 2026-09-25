import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import { validatePasswordStrength, setUserMustChangePassword, BCRYPT_ROUNDS } from "@/lib/security-service";
import { POST as registerTenantPOST } from "@/app/api/tenants/register/route";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, firstName, lastName, schoolId, schoolDomain, role = "STUDENT" } = body;

    // If caller passes tenant onboarding payload (schoolName, adminEmail, subdomain), delegate to tenant register
    if (body.schoolName && (body.adminEmail || body.email)) {
      const clonedReq = new Request(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify({
          ...body,
          adminEmail: body.adminEmail || body.email,
        }),
      });
      return registerTenantPOST(clonedReq);
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required for registration.", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const validation = validatePasswordStrength(password);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Password does not meet complexity rules.", code: "WEAK_PASSWORD" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Resolve target school
    let resolvedSchoolId = schoolId;
    if (!resolvedSchoolId && schoolDomain) {
      const school = await basePrisma.school.findFirst({
        where: {
          OR: [
            { subdomain: schoolDomain.toLowerCase().trim() },
            { slug: schoolDomain.toLowerCase().trim() },
          ],
        },
      });
      resolvedSchoolId = school?.id;
    }

    if (!resolvedSchoolId) {
      const firstSchool = await basePrisma.school.findFirst();
      resolvedSchoolId = firstSchool?.id;
    }

    if (!resolvedSchoolId) {
      return NextResponse.json(
        { error: "No active school institution found to register user under.", code: "SCHOOL_NOT_FOUND" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Self-registration flow: user sets their own password, so mustChangePassword MUST BE FALSE
    const user = await basePrisma.user.upsert({
      where: {
        schoolId_email: {
          schoolId: resolvedSchoolId,
          email: normalizedEmail,
        },
      },
      update: {
        passwordHash: hashedPassword,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        mustChangePassword: false, // Strictly false for self-registration
      },
      create: {
        schoolId: resolvedSchoolId,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role as any,
        mustChangePassword: false, // Strictly false for self-registration
      },
    });

    await setUserMustChangePassword(user.id, resolvedSchoolId, false);

    return NextResponse.json(
      {
        success: true,
        message: "User self-registered successfully.",
        mustChangePassword: false,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          mustChangePassword: false,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[SELF_REGISTRATION_ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during self-registration." },
      { status: 500 }
    );
  }
}
