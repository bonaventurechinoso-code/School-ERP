import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSchoolsStore, SchoolTenant } from "@/app/dashboard/super-admin/mock-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    // 1. Retrieve in-memory synced store
    const storeSchools = [...getSchoolsStore()];

    // 2. Query real database schools from PostgreSQL
    let dbSchools: any[] = [];
    try {
      dbSchools = await basePrisma.school.findMany({
        include: {
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          students: {
            select: { id: true },
          },
          staff: {
            take: 1,
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (dbErr) {
      console.warn("[SuperAdmin:Tenants GET] DB query failed or offline:", dbErr);
    }

    // 3. Map database schools to SchoolTenant format
    const mappedDbSchools: SchoolTenant[] = dbSchools.map((school) => {
      const isDemo = school.subdomain === "demo" || school.slug === "demo";
      const isTrial =
        !isDemo &&
        (school.status === "trial" ||
          Boolean(school.trialEndDate) ||
          school.subscriptions?.some((s: any) => s.plan === "14_DAY_TRIAL"));

      const activeSub = school.subscriptions?.[0];
      const admin = school.staff?.[0];

      return {
        id: school.id,
        name: school.name,
        code: school.subdomain ? school.subdomain.toUpperCase().slice(0, 6) : "SCH",
        subdomain: school.subdomain,
        tier: (isDemo || isTrial ? "Free" : "Basic") as any,
        studentsCount: isDemo ? 120 : (school.students?.length || 0),
        planStatus: (isTrial ? "Trial" : school.isActive ? "Active" : "Suspended") as any,
        subscriptionStatus: (isTrial
          ? "Free Trial"
          : school.isBanned
          ? "Suspended"
          : "Active") as any,
        monthlyRevenue: isDemo || isTrial ? 0 : Number(activeSub?.amount || 0),
        contactEmail: admin?.email || `${school.subdomain}@bonaveeict.com.ng`,
        contactPhone: school.contactPhone || "+234 800 000 0000",
        joinedDate: new Date(school.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        adminName: admin ? `${admin.firstName} ${admin.lastName}` : (isDemo ? "Demo Administrator" : "Administrator"),
        isDemo,
        isTrial,
        trialEndsAt: school.trialEndDate ? new Date(school.trialEndDate).toISOString() : undefined,
      };
    });

    // 4. Merge DB schools and in-memory store schools (UNION, avoiding duplicate demo)
    const combinedMap = new Map<string, SchoolTenant>();

    // First populate from in-memory store
    for (const s of storeSchools) {
      combinedMap.set(s.subdomain.toLowerCase(), s);
    }

    // Then overwrite/augment with real database records (DB records take priority)
    for (const s of mappedDbSchools) {
      combinedMap.set(s.subdomain.toLowerCase(), s);
    }

    // Sort to place real trials and active institutions in prominent view
    let result = Array.from(combinedMap.values()).sort((a, b) => {
      if (a.isTrial && !b.isTrial) return -1;
      if (!a.isTrial && b.isTrial) return 1;
      if (a.isDemo && !b.isDemo) return 1;
      if (!a.isDemo && b.isDemo) return -1;
      return 0;
    });

    // Filter by search if provided
    if (search) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.subdomain.toLowerCase().includes(search) ||
          s.code.toLowerCase().includes(search) ||
          s.adminName.toLowerCase().includes(search)
      );
    }

    // Filter by status if provided
    if (status !== "ALL") {
      result = result.filter(
        (s) => s.subscriptionStatus.toUpperCase() === status.toUpperCase()
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tenants: result,
        schools: result,
        totalCount: result.length,
      },
    });
  } catch (error: any) {
    console.error("[SuperAdmin:Tenants GET] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve tenants list" },
      { status: 500 }
    );
  }
}
