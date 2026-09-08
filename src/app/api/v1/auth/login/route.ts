import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { email, password, schoolDomain } = await req.json();

    if (!email || !password || !schoolDomain) {
      return NextResponse.json({ error: "Missing required credentials or domain context." }, { status: 400 });
    }

    // 0. DEVELOPMENT BYPASS HOOK
    if (process.env.NODE_ENV === "development") {
      if (email === "staff@school.edu" && password === "Password123") {
        const tenant = await basePrisma.school.findUnique({
          where: { subdomain: schoolDomain }
        });

        if (!tenant || !tenant.isActive) {
          return NextResponse.json({ error: "Unauthorized: Tenant does not exist or is inactive." }, { status: 401 });
        }

        const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
        const secret = new TextEncoder().encode(jwtSecret);
        const alg = "HS256";

        const sessionToken = await new jose.SignJWT({
          userId: "test-admin-123",
          tenantId: tenant.id,
          role: "ADMIN",
          schoolDomain: tenant.subdomain
        })
          .setProtectedHeader({ alg })
          .setIssuedAt()
          .setExpirationTime("12h")
          .sign(secret);

        cookies().set("session", sessionToken, {
          httpOnly: true,
          secure: false, // TS knows we are in development block
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 12
        });

        return NextResponse.json({ 
          success: true, 
          role: "ADMIN", 
          schoolDomain: tenant.subdomain 
        });
      } else if (email === "teacher@school.edu" && password === "Password123") {
        const tenant = await basePrisma.school.findUnique({
          where: { subdomain: schoolDomain }
        });

        if (!tenant || !tenant.isActive) {
          return NextResponse.json({ error: "Unauthorized: Tenant does not exist or is inactive." }, { status: 401 });
        }

        const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
        const secret = new TextEncoder().encode(jwtSecret);
        const alg = "HS256";

        const sessionToken = await new jose.SignJWT({
          userId: "test-teacher-456",
          tenantId: tenant.id,
          role: "TEACHER",
          schoolDomain: tenant.subdomain
        })
          .setProtectedHeader({ alg })
          .setIssuedAt()
          .setExpirationTime("12h")
          .sign(secret);

        cookies().set("session", sessionToken, {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 12
        });

        return NextResponse.json({ 
          success: true, 
          role: "TEACHER", 
          schoolDomain: tenant.subdomain 
        });
      }
    }

    // 1. DUAL-KEY TENANT VERIFICATION
    const tenant = await basePrisma.school.findUnique({
      where: { subdomain: schoolDomain }
    });

    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: "Unauthorized: Tenant does not exist or is inactive." }, { status: 401 });
    }

    // Query Staff (User) model matching email AND tenant boundary
    const staff = await basePrisma.staff.findFirst({
      where: { 
        email: email, 
        schoolId: tenant.id 
      }
    });

    if (!staff) {
      return NextResponse.json({ error: "Invalid Credentials." }, { status: 401 });
    }

    if (!staff.password) {
      return NextResponse.json({ error: "Invalid Credentials." }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, staff.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid Credentials." }, { status: 401 });
    }

    // 2. ROLE-BASED ACCESS CONTROL (RBAC) FILTER
    const uppercaseRole = staff.role.toUpperCase();
    if (["STUDENT", "GUEST"].includes(uppercaseRole) || !["ADMIN", "TEACHER", "SUPERVISOR", "STAFF"].includes(uppercaseRole)) {
      return NextResponse.json({ 
        error: "Access Denied: This portal is strictly reserved for authorized institutional staff." 
      }, { status: 403 });
    }

    // 3. SECURE JWT SESSION GENERATION
    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const alg = "HS256";

    const sessionToken = await new jose.SignJWT({
      userId: staff.id,
      tenantId: tenant.id,
      role: staff.role,
      schoolDomain: tenant.subdomain
    })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(secret);

    // Bake into HTTP-only secure cookie
    cookies().set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12 // 12 hours
    });

    return NextResponse.json({ 
      success: true, 
      role: staff.role, 
      schoolDomain: tenant.subdomain 
    });

  } catch (error: any) {
    console.error("Auth Login Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
