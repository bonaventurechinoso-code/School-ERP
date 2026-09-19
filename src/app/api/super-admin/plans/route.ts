import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLANS } from "@/lib/saas-plans";


export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { priceNgn: "asc" },
      include: {
        _count: {
          select: { tenants: true, subscriptions: true },
        },
      },
    });
    return NextResponse.json({ success: true, data: plans });
  } catch (error: any) {
    console.error("[SuperAdmin:Plans GET] Failed to fetch plans:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve subscription plans" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { seed } = body;

    if (seed) {
      const createdPlans = [];
      for (const planDef of DEFAULT_PLANS) {
        const existing = await prisma.plan.findFirst({
          where: { name: planDef.name },
        });
        if (!existing) {
          const created = await prisma.plan.create({
            data: planDef,
          });
          createdPlans.push(created);
        } else {
          createdPlans.push(existing);
        }
      }
      return NextResponse.json({
        success: true,
        message: "Baseline SaaS plans seeded successfully",
        data: createdPlans,
      });
    }

    const {
      name,
      priceNgn,
      billingCycle,
      maxStudents,
      maxStaff,
      maxStorageGb,
      modules,
      commissionPercent,
    } = body;

    if (!name || priceNgn === undefined || !billingCycle) {
      return NextResponse.json(
        { error: "Name, priceNgn, and billingCycle are required" },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        priceNgn: Number(priceNgn),
        billingCycle,
        maxStudents: Number(maxStudents) || 100,
        maxStaff: Number(maxStaff) || 10,
        maxStorageGb: Number(maxStorageGb) || 10,
        modules: Array.isArray(modules) ? modules : ["academics"],
        commissionPercent: Number(commissionPercent) || 2.0,
      },
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error: any) {
    console.error("[SuperAdmin:Plans POST] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create/seed plans" },
      { status: 500 }
    );
  }
}
