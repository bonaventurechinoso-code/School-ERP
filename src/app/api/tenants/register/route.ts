import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
const basePrisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

const VALID_TIERS = ['NURSERY', 'DAYCARE', 'PRIMARY', 'SECONDARY', 'PRIMARY_SECONDARY', 'UNIVERSITY', 'POLYTECHNIC', 'COLLEGE_OF_EDUCATION'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { schoolName, adminEmail, contactPhone, subdomain, tiers } = body;

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

    // Provision the new tenant inside a transaction
    if (tiers.includes('COMBINED_NURSERY_PRIMARY_SECONDARY')) {
      const subdomains = [
          { suffix: '-nursery', tier: 'DAYCARE', name: `${schoolName} Nursery` },
          { suffix: '-primary', tier: 'PRIMARY', name: `${schoolName} Primary` },
          { suffix: '-secondary', tier: 'SECONDARY', name: `${schoolName} Secondary` }
      ];
      
      const newSchools = await basePrisma.$transaction(async (tx) => {
        const createdSchools = [];
        for (const sub of subdomains) {
          const tenantSubdomain = formattedSubdomain + sub.suffix;
          const school = await tx.school.create({
            data: {
              name: sub.name,
              subdomain: tenantSubdomain,
              contactPhone,
              isActive: true,
            },
          });
          
          await tx.academicTier.create({
            data: { schoolId: school.id, name: sub.tier, level: 1 }
          });
          
          const dept = await tx.department.create({
            data: { schoolId: school.id, name: "Administration" }
          });
          
          await tx.staff.create({
            data: {
              schoolId: school.id,
              firstName: "Admin",
              lastName: "User",
              email: adminEmail,
              role: "ADMIN",
              departmentId: dept.id,
              status: "ACTIVE",
              activeAt: new Date(),
              password: ""
            }
          });
          
          await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "tenant_${tenantSubdomain}";`);
          createdSchools.push(school);
        }
        return createdSchools;
      });
      
      return NextResponse.json({
        success: true,
        message: "Combined tenants successfully provisioned.",
        tenant: newSchools[0],
        redirectUrl: `/${formattedSubdomain}-primary/dashboard`
      });
    }

    const newSchool = await basePrisma.$transaction(async (tx) => {
      // Phase A: Create baseline Tenant management record
      // 1. Create School
      const school = await tx.school.create({
        data: {
          name: schoolName,
          subdomain: formattedSubdomain,
          contactPhone,
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
      await tx.staff.create({
        data: {
          schoolId: school.id,
          firstName: "Admin",
          lastName: "User",
          email: adminEmail,
          role: "ADMIN",
          status: "ACTIVE",
          activeAt: new Date(),
          password: ""
        }
      });

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
