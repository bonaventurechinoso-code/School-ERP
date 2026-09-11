import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import { cookies } from "next/headers";
import { normalizeRole, getDefaultPermissionsForRole, UserRole } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password, schoolDomain } = await req.json();

    if (!email || !password || !schoolDomain) {
      return NextResponse.json({ error: "Missing required credentials or domain context." }, { status: 400 });
    }

    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const alg = "HS256";

    // 0. DEVELOPMENT BYPASS HOOK
    if (process.env.NODE_ENV === "development") {
      const tenant = await basePrisma.school.findUnique({
        where: { subdomain: schoolDomain },
        include: {
          academicTiers: {
            orderBy: { level: "asc" },
          },
        },
      });

      if (tenant && tenant.isActive) {
        const activeTiers = tenant.academicTiers.map(t => t.name);

        let devRole: UserRole | null = null;
        let devUserId = "";

        if ((email === "staff@school.edu" || email === "admin@school.edu") && password === "Password123") {
          devRole = "SCHOOL_ADMIN";
          devUserId = "test-admin-123";
        } else if (email === "superadmin@school.edu" && password === "Password123") {
          devRole = "SUPER_ADMIN";
          devUserId = "test-superadmin-001";
        } else if ((email === "teacher@school.edu" || email === "bursar@school.edu") && password === "Password123") {
          devRole = "STAFF";
          devUserId = email.includes("teacher") ? "test-teacher-456" : "test-bursar-789";
        } else if (email === "student@school.edu" && password === "Password123") {
          devRole = "STUDENT";
          devUserId = "test-student-999";
        }

        if (devRole) {
          const permissions = getDefaultPermissionsForRole(devRole);

          const sessionToken = await new jose.SignJWT({
            userId: devUserId,
            email: email,
            tenantId: tenant.id,
            schoolDomain: tenant.subdomain,
            tenantName: tenant.name,
            role: devRole,
            activeTiers: activeTiers,
            permissions: permissions,
          })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime("12h")
            .sign(secret);

          const cookieStore = await cookies();
          cookieStore.set("session", sessionToken, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 12,
          });

          return NextResponse.json({ 
            success: true, 
            role: devRole, 
            schoolDomain: tenant.subdomain,
            activeTiers,
            permissions,
          });
        }
      }
    }

    // 1. DUAL-KEY TENANT VERIFICATION
    const tenant = await basePrisma.school.findUnique({
      where: { subdomain: schoolDomain },
      include: {
        academicTiers: {
          orderBy: { level: "asc" },
        },
      },
    });

    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: "Unauthorized: Tenant does not exist or is inactive." }, { status: 401 });
    }

    const activeTiers = tenant.academicTiers.map(t => t.name);
    let resolvedRole: UserRole | null = null;
    let authenticatedUserId = "";
    let authenticatedEmail = email;

    // A. Check Platform Admin (SUPER_ADMIN)
    const platformAdmin = await basePrisma.platformAdmin.findUnique({
      where: { email: email },
    });

    if (platformAdmin && platformAdmin.password) {
      const isPasswordValid = await bcrypt.compare(password, platformAdmin.password);
      if (isPasswordValid) {
        resolvedRole = "SUPER_ADMIN";
        authenticatedUserId = platformAdmin.id;
      }
    }

    // B. Check Staff (SCHOOL_ADMIN / STAFF)
    if (!resolvedRole) {
      const staff = await basePrisma.staff.findFirst({
        where: { 
          email: email, 
          schoolId: tenant.id 
        },
      });

      if (staff && staff.password) {
        const isPasswordValid = await bcrypt.compare(password, staff.password);
        if (isPasswordValid) {
          resolvedRole = normalizeRole(staff.role);
          authenticatedUserId = staff.id;
        }
      }
    }

    // C. Check Student (STUDENT)
    if (!resolvedRole) {
      const student = await basePrisma.student.findFirst({
        where: {
          email: email,
          schoolId: tenant.id,
        },
      });

      // If student matched by email & standard default password
      if (student && password === "Password123") {
        resolvedRole = "STUDENT";
        authenticatedUserId = student.id;
      }
    }

    if (!resolvedRole) {
      return NextResponse.json({ error: "Invalid Credentials." }, { status: 401 });
    }

    // 2. FETCH ROLE PERMISSIONS
    const permissions = getDefaultPermissionsForRole(resolvedRole);

    // 3. SECURE JWT SESSION GENERATION WITH EXPANDED CLAIMS
    const sessionToken = await new jose.SignJWT({
      userId: authenticatedUserId,
      email: authenticatedEmail,
      tenantId: tenant.id,
      schoolDomain: tenant.subdomain,
      tenantName: tenant.name,
      role: resolvedRole,
      activeTiers: activeTiers,
      permissions: permissions,
    })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(secret);

    // Bake into HTTP-only secure cookie
    const cookieStore = await cookies();
    cookieStore.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });

    return NextResponse.json({ 
      success: true, 
      role: resolvedRole, 
      schoolDomain: tenant.subdomain,
      activeTiers,
      permissions,
    });

  } catch (error: any) {
    console.error("Auth Login Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
