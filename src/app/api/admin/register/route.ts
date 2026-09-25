import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { exec } from "child_process";
import util from "util";
import bcrypt from "bcryptjs";
import { ensureSecurityTables, hashPassword, validatePasswordStrength } from "@/lib/security-service";
import { logAuditEvent } from "@/lib/audit-logger";

const execAsync = util.promisify(exec);

const VALID_TIERS = ['NURSERY', 'DAYCARE', 'PRIMARY', 'SECONDARY', 'PRIMARY_SECONDARY', 'UNIVERSITY', 'POLYTECHNIC', 'COLLEGE_OF_EDUCATION'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { schoolName, adminEmail, contactPhone, subdomain, tiers, password } = body;

    // Validate inputs
    if (!schoolName || !adminEmail || !subdomain || !tiers || tiers.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields or academic tiers." },
        { status: 400 }
      );
    }

    // Validate standard backend enum metadata
    const invalidTiers = tiers.filter((t: string) => !VALID_TIERS.includes(t));
    if (invalidTiers.length > 0) {
      return NextResponse.json(
        { error: `Invalid academic tier subtypes provided: ${invalidTiers.join(', ')}` },
        { status: 400 }
      );
    }

    // Format subdomain (lowercase, remove spaces/special chars)
    const formattedSubdomain = subdomain.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

    if (!formattedSubdomain) {
      return NextResponse.json(
        { error: "Invalid subdomain." },
        { status: 400 }
      );
    }

    // Check if subdomain is unique
    const existingSchool = await basePrisma.school.findUnique({
      where: { subdomain: formattedSubdomain },
    });

    if (existingSchool) {
      return NextResponse.json(
        { error: "This URL slug is already taken. Please choose another." },
        { status: 409 }
      );
    }

    await ensureSecurityTables();

    let adminPasswordToSave = "Password123";
    let isUserProvidedPassword = false;

    if (password && typeof password === "string" && password.trim().length > 0) {
      if (password.trim().length < 8) {
        return NextResponse.json(
          { error: "Admin password must be at least 8 characters long." },
          { status: 400 }
        );
      }
      adminPasswordToSave = password.trim();
      isUserProvidedPassword = true;
    }

    const adminPasswordHash = await hashPassword(adminPasswordToSave);

    // Provision the new tenant inside a transaction
    const newSchool = await basePrisma.$transaction(async (tx) => {
      // Phase A: Create baseline Tenant management record
      // 1. Create School
      const school = await tx.school.create({
        data: {
          name: schoolName,
          subdomain: formattedSubdomain,
          slug: formattedSubdomain,
          isActive: true,
        },
      });

      // 2. Persist exact standardized backend enum keys as subtypes
      const tierPromises = tiers.map((tierName: string, index: number) => {
        return tx.academicTier.create({
          data: {
            schoolId: school.id,
            name: tierName,
            level: index + 1,
          },
        });
      });
      await Promise.all(tierPromises);

      // 3. Create a default admin account
      const user = await tx.user.upsert({
        where: { schoolId_email: { schoolId: school.id, email: adminEmail } },
        update: {
          passwordHash: adminPasswordHash,
          role: "SCHOOL_ADMIN",
          mustChangePassword: !isUserProvidedPassword,
        },
        create: {
          schoolId: school.id,
          email: adminEmail,
          passwordHash: adminPasswordHash,
          role: "SCHOOL_ADMIN",
          mustChangePassword: !isUserProvidedPassword,
        },
      });

      const staff = await tx.staff.create({
        data: {
          schoolId: school.id,
          userId: user.id,
          firstName: "Admin",
          lastName: "User",
          email: adminEmail,
          status: "ACTIVE",
          activeAt: new Date(),
        }
      });

      await tx.$executeRawUnsafe(`
        INSERT INTO bonavee_user_security (user_id, school_id, must_change_password, password_updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET must_change_password = $3, password_updated_at = NOW();
      `, user.id, school.id, !isUserProvidedPassword);

      // 4. Create a default department
      await tx.department.create({
        data: {
          schoolId: school.id,
          name: "Administration",
        }
      });

      // Phase B: Provision an isolated boundary
      await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "tenant_${formattedSubdomain}";`);

      return school;
    });

    // Schema Migration Handshake: Programmatically duplicate baseline structures
    if (process.env.DATABASE_URL) {
      const dbUrl = new URL(process.env.DATABASE_URL);
      dbUrl.searchParams.set("schema", `tenant_${formattedSubdomain}`);
      
      await execAsync("npx prisma db push --skip-generate", {
        env: { ...process.env, DATABASE_URL: dbUrl.toString() }
      });
    }

    return NextResponse.json({
      success: true,
      message: "Tenant successfully provisioned.",
      tenant: newSchool,
      redirectUrl: `/${formattedSubdomain}/dashboard`
    });

  } catch (error: any) {
    console.error("Tenant registration error:", error);
    return NextResponse.json(
      { error: "Internal server error during provisioning", details: error.message },
      { status: 500 }
    );
  }
}
