import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { getAllowedLevelsByTier } from "@/lib/school-tiers";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant } = await params;

    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: tenant.toLowerCase().trim() },
          { slug: tenant.toLowerCase().trim() },
          { id: tenant },
        ],
      },
      include: { academicTiers: true },
    });

    const schoolTier = school?.academicTiers?.[0]?.name || (tenant.toLowerCase().includes("primary") ? "PRIMARY" : "PRIMARY");
    const allowedClasses = getAllowedLevelsByTier(schoolTier);

    return NextResponse.json({
      success: true,
      tenant,
      tier: schoolTier,
      classes: allowedClasses,
      count: allowedClasses.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch classes" },
      { status: 500 }
    );
  }
}
