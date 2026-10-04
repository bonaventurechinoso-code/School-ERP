import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import { DEFAULT_PLANS } from "@/lib/saas-plans";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleSeed(req);
}

export async function POST(req: Request) {
  return handleSeed(req);
}

async function handleSeed(req: Request) {
  try {
    const isProd = process.env.NODE_ENV === "production";
    const isSeedDisabled = process.env.DISABLE_SEED === "true";
    const seedSecret = process.env.SEED_SECRET_KEY;
    const headerSecret = req.headers.get("x-seed-secret") || req.headers.get("x-seed-key");

    // 1. Guard against unauthorized public access
    if (isProd) {
      if (isSeedDisabled || !seedSecret || headerSecret !== seedSecret) {
        return NextResponse.json(
          { error: "Forbidden: Seeding is disabled or invalid x-seed-secret provided.", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    } else if (seedSecret && headerSecret !== seedSecret) {
      return NextResponse.json(
        { error: "Forbidden: Invalid x-seed-secret header.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // 2. Prevent re-seeding if tenants already exist
    const existingTenantsCount = await basePrisma.school.count();
    const existingAdmin = await basePrisma.platformAdmin.findUnique({
      where: { email: "admin@bonaveeict.com.ng" },
    });

    if (existingTenantsCount > 0 && existingAdmin) {
      // Purge any residual superadmin@platform.com or deleted riverside in DB
      await basePrisma.platformAdmin.deleteMany({
        where: { email: { equals: "superadmin@platform.com", mode: "insensitive" } },
      }).catch(() => {});
      await basePrisma.superAdmin.deleteMany({
        where: { email: { equals: "superadmin@platform.com", mode: "insensitive" } },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: "Tenants and Super Admin already exist in database. Seed skipped to protect tenant isolation.",
        superAdmins: [{ email: "admin@bonaveeict.com.ng" }],
      });
    }

    // 3. Upsert Super Admin Account (Keep ONLY admin@bonaveeict.com.ng, NEVER overwrite existing password)
    const defaultPasswordHash = await bcrypt.hash("Password123", 12);
    const adminEmail = "admin@bonaveeict.com.ng";

    const admin = await basePrisma.platformAdmin.upsert({
      where: { email: adminEmail },
      update: {
        // DO NOT overwrite password if already set - allows password change to persist
      },
      create: {
        email: adminEmail,
        password: defaultPasswordHash,
        twoFactorEnabled: false,
      },
    });

    // Clean out superadmin@platform.com if it exists
    await basePrisma.platformAdmin.deleteMany({
      where: { email: { equals: "superadmin@platform.com", mode: "insensitive" } },
    }).catch(() => {});
    await basePrisma.superAdmin.deleteMany({
      where: { email: { equals: "superadmin@platform.com", mode: "insensitive" } },
    }).catch(() => {});

    // 4. Ensure Platform Wallet Exists
    let platformWallet = await basePrisma.platformWallet.findFirst();
    if (!platformWallet) {
      platformWallet = await basePrisma.platformWallet.create({
        data: { balance: 0.0, totalRevenue: 0.0 },
      });
    }

    // 5. Seed Default Plans if not present
    let plansSeeded = 0;
    for (const planDef of DEFAULT_PLANS) {
      const existing = await basePrisma.plan.findFirst({
        where: { name: planDef.name },
      });
      if (!existing) {
        await basePrisma.plan.create({
          data: planDef,
        });
        plansSeeded++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Platform Super-Admin account and baseline SaaS structure successfully verified!",
      superAdmins: [{ id: admin.id, email: admin.email }],
      plansSeeded,
      platformWallet: {
        id: platformWallet.id,
        balance: platformWallet.balance,
      },
      nextSteps: "Navigate to /login and sign in with admin@bonaveeict.com.ng",
    });
  } catch (error: any) {
    console.error("[SEED_SUPER_ADMIN_ERROR]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to seed Super Admin",
        details: error?.message || error,
      },
      { status: 500 }
    );
  }
}
