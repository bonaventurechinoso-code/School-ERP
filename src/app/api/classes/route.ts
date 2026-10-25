import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { getAllowedLevelsByTier } from "@/lib/school-tiers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("schoolDomain") || searchParams.get("domain") || req.headers.get("x-tenant-slug") || "";

    let school = null;
    if (domain) {
      school = await basePrisma.school.findFirst({
        where: {
          OR: [
            { subdomain: domain.toLowerCase().trim() },
            { slug: domain.toLowerCase().trim() },
          ],
        },
        include: { academicTiers: true },
      });
    }

    const schoolTier = school?.academicTiers?.[0]?.name || (domain.toLowerCase().includes("primary") ? "PRIMARY" : "PRIMARY");
    const allowedClasses = getAllowedLevelsByTier(schoolTier);

    return NextResponse.json({
      success: true,
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
