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

    // 2. Query ALL real database schools from PostgreSQL (ACTIVE, SUSPENDED, INACTIVE)
    let dbSchools: any[] = [];
    try {
      dbSchools = await basePrisma.school.findMany({
        where: {
          deletedAt: null,
        },
        include: {
          academicTiers: true,
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          students: {
            select: { id: true },
          },
          staff: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          users: {
            where: { role: { in: ["SCHOOL_ADMIN", "PRINCIPAL", "HEADMASTER"] } },
            take: 1,
            select: { email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (dbErr) {
      console.warn("[SuperAdmin:Tenants GET] DB query failed or offline:", dbErr);
    }

    // 3. Map database schools to SchoolTenant format (preserving ACTIVE and SUSPENDED)
    const mappedDbSchools: any[] = dbSchools.map((school) => {
      const isDemo = school.subdomain === "demo" || school.slug === "demo";
      const isSuspended =
        !school.isActive ||
        Boolean(school.isBanned) ||
        String(school.status || "").toUpperCase() === "SUSPENDED";
      const normalizedStatus = isSuspended ? "SUSPENDED" : "ACTIVE";
      const isTrial =
        !isDemo &&
        !isSuspended &&
        (school.status === "trial" ||
          Boolean(school.trialEndDate) ||
          school.subscriptions?.some((s: any) => s.plan === "14_DAY_TRIAL"));

      const activeSub = school.subscriptions?.[0];
      const admin = school.staff?.[0];
      const adminUserEmail = school.users?.[0]?.email;

      return {
        id: school.id,
        name: school.name,
        code: school.subdomain ? school.subdomain.toUpperCase().slice(0, 6) : "SCH",
        subdomain: school.subdomain,
        slug: school.slug || school.subdomain,
        status: normalizedStatus,
        isActive: !isSuspended,
        tier: (isDemo || isTrial ? "Free" : "Basic") as any,
        studentsCount: isDemo ? 120 : (school.students?.length || 0),
        students_count: isDemo ? 120 : (school.students?.length || 0),
        staff_count: school.staff?.length || 0,
        academic_tiers: (school.academicTiers || []).map((t: any) => ({
          id: t.id,
          name: t.name,
        })),
        planStatus: (isSuspended ? "Suspended" : isTrial ? "Trial" : "Active") as any,
        subscriptionStatus: (isSuspended
          ? "Suspended"
          : isTrial
          ? "Free Trial"
          : "Active") as any,
        monthlyRevenue: isDemo || isTrial ? 0 : Number(activeSub?.amount || 0),
        contactEmail: adminUserEmail || admin?.email || `${school.subdomain}@bonaveeict.com.ng`,
        email: adminUserEmail || admin?.email || `${school.subdomain}@bonaveeict.com.ng`,
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
    const combinedMap = new Map<string, any>();

    // First populate from in-memory store
    for (const s of storeSchools) {
      const isSusp = s.subscriptionStatus === "Suspended" || s.planStatus === "Suspended";
      combinedMap.set(s.subdomain.toLowerCase(), {
        ...s,
        slug: s.subdomain,
        status: isSusp ? "SUSPENDED" : "ACTIVE",
        isActive: !isSusp,
      });
    }

    // Then overwrite/augment with real database records (DB records take priority)
    for (const s of mappedDbSchools) {
      combinedMap.set(s.subdomain.toLowerCase(), s);
    }

    // 5. Query and augment with Tenant table records across all statuses
    try {
      const dbTenants = await basePrisma.tenant.findMany({
        where: {
          status: { in: ["ACTIVE", "SUSPENDED", "INACTIVE", "PENDING"] },
        },
        select: {
          id: true,
          schoolName: true,
          subdomain: true,
          adminEmail: true,
          contactPhone: true,
          status: true,
          subscriptionStatus: true,
          suspendedReason: true,
          suspendedAt: true,
          isDemo: true,
          isTrial: true,
          trialEndsAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      for (const t of dbTenants) {
        const sub = t.subdomain.toLowerCase();
        const existing = combinedMap.get(sub);
        const isTenantSuspended = String(t.status || "").toUpperCase() === "SUSPENDED";
        if (existing) {
          existing.isDemo = Boolean(t.isDemo);
          existing.isTrial = Boolean(t.isTrial);
          if (t.trialEndsAt) existing.trialEndsAt = new Date(t.trialEndsAt).toISOString();
          if (t.adminEmail) {
            existing.contactEmail = t.adminEmail;
            existing.email = t.adminEmail;
          }
          if (isTenantSuspended || existing.status === "SUSPENDED") {
            existing.status = "SUSPENDED";
            existing.isActive = false;
            existing.planStatus = "Suspended";
            existing.subscriptionStatus = "Suspended";
            existing.suspensionReason = t.suspendedReason || "Subscription overdue";
            existing.suspendedAt = t.suspendedAt ? new Date(t.suspendedAt).toISOString() : undefined;
          }
        } else {
          combinedMap.set(sub, {
            id: t.id,
            name: t.schoolName,
            code: t.subdomain ? t.subdomain.toUpperCase().slice(0, 6) : "SCH",
            subdomain: t.subdomain,
            slug: t.subdomain,
            status: isTenantSuspended ? "SUSPENDED" : "ACTIVE",
            isActive: !isTenantSuspended,
            suspensionReason: t.suspendedReason || null,
            suspendedAt: t.suspendedAt ? new Date(t.suspendedAt).toISOString() : undefined,
            tier: t.isDemo || t.isTrial ? "Free" : "Basic",
            studentsCount: t.isDemo ? 120 : 0,
            students_count: t.isDemo ? 120 : 0,
            staff_count: 0,
            academic_tiers: [],
            planStatus: isTenantSuspended ? "Suspended" : t.isTrial ? "Trial" : "Active",
            subscriptionStatus: (isTenantSuspended
              ? "Suspended"
              : t.subscriptionStatus || (t.isTrial ? "Free Trial" : "Active")) as any,
            monthlyRevenue: 0,
            contactEmail: t.adminEmail,
            email: t.adminEmail,
            contactPhone: t.contactPhone || "+234 800 000 0000",
            joinedDate: new Date(t.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            adminName: t.isDemo ? "Demo Administrator" : "Administrator",
            isDemo: Boolean(t.isDemo),
            isTrial: Boolean(t.isTrial),
            trialEndsAt: t.trialEndsAt ? new Date(t.trialEndsAt).toISOString() : undefined,
          });
        }
      }
    } catch (tErr) {
      console.warn("[SuperAdmin:Tenants GET] Tenant DB query warning:", tErr);
    }

    // Sort to place real institutions first, keeping suspended tenants visible
    let result = Array.from(combinedMap.values()).sort((a, b) => {
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

    // Filter by status if explicitly requested (ALL shows ACTIVE, SUSPENDED, INACTIVE)
    if (status !== "ALL") {
      const upperStatus = status.toUpperCase();
      result = result.filter(
        (s) =>
          String(s.status || "").toUpperCase() === upperStatus ||
          String(s.subscriptionStatus || "").toUpperCase() === upperStatus
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
