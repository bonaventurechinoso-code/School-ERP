import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import { DEFAULT_PLANS } from "@/lib/saas-plans";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const passwordHash = await bcrypt.hash("Password123", 10);

    // 1. Upsert Super Admin Accounts
    const adminEmails = ["admin@bonaveeict.com.ng", "superadmin@platform.com"];
    const seededAdmins = [];

    for (const email of adminEmails) {
      const admin = await basePrisma.platformAdmin.upsert({
        where: { email },
        update: {
          password: passwordHash,
        },
        create: {
          email,
          password: passwordHash,
          twoFactorEnabled: false,
        },
      });
      seededAdmins.push({ id: admin.id, email: admin.email });
    }

    // 2. Ensure Platform Wallet Exists
    let platformWallet = await basePrisma.platformWallet.findFirst();
    if (!platformWallet) {
      platformWallet = await basePrisma.platformWallet.create({
        data: { balance: 0.0, totalRevenue: 0.0 },
      });
    }

    // 3. Seed Default Plans if not present
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
      message: "Platform Super-Admin accounts and baseline SaaS structure successfully seeded!",
      superAdmins: seededAdmins,
      defaultPassword: "Password123",
      plansSeeded,
      platformWallet: {
        id: platformWallet.id,
        balance: platformWallet.balance,
      },
      nextSteps: "Navigate to /login and sign in with admin@bonaveeict.com.ng and Password123",
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
