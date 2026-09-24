import { NextResponse } from "next/server";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { createPasswordResetToken } from "@/lib/security-service";
import { sendPasswordResetEmail } from "@/lib/email-service";
import { BASE_TENANT_DOMAIN } from "@/lib/session-manager";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, schoolDomain } = body;

    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "Email address is required.", code: "EMAIL_REQUIRED" },
        { status: 400 }
      );
    }

    if (!schoolDomain) {
      return NextResponse.json(
        { error: "School domain context is required.", code: "DOMAIN_REQUIRED" },
        { status: 400 }
      );
    }

    // 1. Locate tenant school
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: schoolDomain.toLowerCase().trim() },
          { slug: schoolDomain.toLowerCase().trim() },
        ],
      },
      include: { academicTiers: true },
    });

    if (!school) {
      return NextResponse.json(
        { error: "School institution not found.", code: "TENANT_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2. Verify email belongs to that specific tenant school
    // A. Check Staff first
    let userType: "STAFF" | "STUDENT" | null = null;
    let userId = "";
    let userName = "";

    const staff = await basePrisma.staff.findFirst({
      where: {
        schoolId: school.id,
        email: normalizedEmail,
        status: { not: "TERMINATED" },
      },
    });

    if (staff) {
      userType = "STAFF";
      userId = staff.id;
      userName = `${staff.firstName} ${staff.lastName}`.trim();
    }

    // B. Check Student if not found in Staff
    if (!userType) {
      let student = await basePrisma.student.findFirst({
        where: {
          schoolId: school.id,
          email: normalizedEmail,
          status: { notIn: ["EXPELLED"] },
        },
      });

      if (!student && school.databaseUrl) {
        try {
          const tenantDb = await getTenantClient(school.id);
          student = await tenantDb.student.findFirst({
            where: {
              schoolId: school.id,
              email: normalizedEmail,
            },
          });
        } catch {}
      }

      if (student) {
        userType = "STUDENT";
        userId = student.id;
        userName = `${student.firstName} ${student.lastName}`.trim();
      }
    }

    // Security practice: Return generic positive message even if email wasn't found in tenant
    // to prevent email enumeration attacks, BUT do not dispatch email if unverified.
    if (!userType || !userId) {
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists for this institution, a recovery link has been dispatched.",
      });
    }

    // 3. Generate secure time-limited token (60 mins)
    const resetToken = await createPasswordResetToken({
      schoolId: school.id,
      email: normalizedEmail,
      userId,
      userType,
      expiresMinutes: 60,
    });

    // 4. Compile recovery link preserving the tenant slug
    const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const rawHost = hostHeader.split(":")[0].toLowerCase().trim();

    let baseUrl = `${proto}://${hostHeader}`;
    if (!hostHeader) {
      baseUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || `https://${BASE_TENANT_DOMAIN}`).replace(/\/$/, "");
    }

    // Preserve the tenant slug cleanly
    const resetUrl = `${baseUrl}/${school.subdomain}/reset-password?token=${encodeURIComponent(resetToken)}`;

    // 5. Transmit transactional email via mail delivery service
    await sendPasswordResetEmail({
      school,
      recipientEmail: normalizedEmail,
      recipientName: userName,
      resetUrl,
      expiresMinutes: 60,
    });

    return NextResponse.json({
      success: true,
      message: "A password recovery email with instructions has been dispatched to your email address.",
      resetUrlPreview: process.env.NODE_ENV === "development" ? resetUrl : undefined,
    });
  } catch (error: any) {
    console.error("[AUTH_FORGOT_PASSWORD_ERROR]:", error);
    return NextResponse.json(
      { error: "Could not initiate password recovery.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
