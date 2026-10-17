import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { exec } from "child_process";
import util from "util";
import bcrypt from "bcryptjs";
import { ensureSecurityTables, hashPassword, validatePasswordStrength } from "@/lib/security-service";
import { logAuditEvent } from "@/lib/audit-logger";
import { createTenantWithAdmin } from "@/lib/tenant-service";

const execAsync = util.promisify(exec);

const VALID_TIERS = [
  'Creche / Daycare',
  'Nursery / Kindergarten',
  'Primary School',
  'Junior Secondary School',
  'Senior Secondary School',
  'Technical / Vocational School',
  'Islamiyya / Quranic School',
  'University',
  'Polytechnic',
  'College of Education',
  'Monotechnic',
  'College of Nursing / Health Sciences',
  'Professional / Postgraduate Institute',
  'NURSERY',
  'DAYCARE',
  'PRIMARY',
  'SECONDARY',
  'PRIMARY_SECONDARY'
];

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

    // Provision the new tenant using unified createTenantWithAdmin
    const { school } = await createTenantWithAdmin({
      slug: formattedSubdomain,
      name: schoolName,
      adminEmail,
      adminPassword: adminPasswordToSave,
      tiers,
      isSelfRegistration: false,
      mustChangePassword: true,
      isTemporaryPassword: true,
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
      tenant: school,
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
