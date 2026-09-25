import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const identifier = (url.searchParams.get("slug") || url.searchParams.get("subdomain") || "").toLowerCase().trim();

    if (!identifier) {
      return NextResponse.json({ error: "Tenant slug or subdomain parameter is required." }, { status: 400 });
    }

    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { slug: identifier },
          { subdomain: identifier },
        ],
      },
      select: {
        id: true,
        name: true,
        subdomain: true,
        slug: true,
        isActive: true,
        isBanned: true,
        trialStartDate: true,
        trialEndDate: true,
      },
    });

    if (!school) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const now = new Date();
    const isExpired = school.trialEndDate ? new Date(school.trialEndDate) < now : false;
    const isBanned = school.isBanned || !school.isActive;

    return NextResponse.json({
      schoolId: school.id,
      subdomain: school.subdomain,
      isBanned,
      isExpired,
      trialStartDate: school.trialStartDate,
      trialEndDate: school.trialEndDate,
      isAccessAllowed: !isBanned && !isExpired,
    });
  } catch (error: any) {
    console.error("[TENANT_STATUS_CHECK_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal server error during tenant status evaluation", details: error?.message },
      { status: 500 }
    );
  }
}
