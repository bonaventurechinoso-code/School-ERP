import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSchoolsStore } from "@/app/dashboard/super-admin/mock-data";
import { ensureEgedeAndDemoRestored } from "@/lib/tenant-status";

export const dynamic = "force-dynamic";

const TIER_LABEL_MAP: Record<string, string> = {
  CRECHE: "Creche / Daycare",
  NURSERY: "Nursery / Kindergarten",
  PRIMARY: "Primary School",
  SECONDARY: "Senior Secondary School",
  POLYTECHNIC: "Polytechnic",
  COLLEGE_OF_ED: "College of Education",
  UNIVERSITY: "University",
};

function buildDefaultTiers(
  rawTiers?: Array<{ id?: string; name: string }> | null,
  institutionTypes?: any,
  tierEnum?: string | null
): Array<{ id: string; name: string }> {
  if (Array.isArray(rawTiers) && rawTiers.length > 0) {
    return rawTiers.map((t, idx) => ({
      id: t.id || `tier-${idx}`,
      name: t.name,
    }));
  }
  if (Array.isArray(institutionTypes) && institutionTypes.length > 0) {
    return institutionTypes.map((name, idx) => ({
      id: `inst-${idx}`,
      name: String(name),
    }));
  }
  const resolvedLabel =
    (tierEnum && TIER_LABEL_MAP[tierEnum.toUpperCase()]) || "Primary School";
  return [{ id: "default-primary", name: resolvedLabel }];
}

export async function GET(req: NextRequest) {
  try {
    await ensureEgedeAndDemoRestored();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    // 1. Retrieve in-memory synced store (excluding soft-deleted rows)
    const storeSchools = [...getSchoolsStore()].filter(
      (s: any) =>
        !s.isDeleted &&
        String(s.status || "").toUpperCase() !== "DELETED" &&
        s.subdomain?.toLowerCase() !== "greenfield"
    );

    // 2. Query ALL real database schools from PostgreSQL (where deletedAt IS NULL AND status != 'DELETED')
    let dbSchools: any[] = [];
    try {
      dbSchools = await basePrisma.school.findMany({
        where: {
          deletedAt: null,
          status: { not: "DELETED" },
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

    // 3. Map database schools to SchoolTenant format (preserving ACTIVE and SUSPENDED, including Demo)
    const mappedDbSchools: any[] = dbSchools.map((school) => {
      const subLower = (school.subdomain || "").toLowerCase();
      const isDemo = subLower === "demo" || (school.slug || "").toLowerCase() === "demo";
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
        institutionTier: "PRIMARY",
        studentsCount: isDemo ? Math.max(120, school.students?.length || 0) : (school.students?.length || 0),
        students_count: isDemo ? Math.max(120, school.students?.length || 0) : (school.students?.length || 0),
        staff_count: school.staff?.length || 0,
        academic_tiers: buildDefaultTiers(school.academicTiers, null, "PRIMARY"),
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

    // 4. Merge DB schools and in-memory store schools (UNION, including Demo School)
    const combinedMap = new Map<string, any>();

    for (const s of storeSchools) {
      const subKey = s.subdomain.toLowerCase();
      const isSusp =
        s.subscriptionStatus === "Suspended" ||
        s.planStatus === "Suspended" ||
        (s as any).status === "SUSPENDED";
      combinedMap.set(subKey, {
        ...s,
        slug: s.subdomain,
        status: isSusp ? "SUSPENDED" : "ACTIVE",
        isActive: !isSusp,
        academic_tiers: buildDefaultTiers((s as any).academic_tiers, null, "PRIMARY"),
      });
    }

    for (const s of mappedDbSchools) {
      combinedMap.set(s.subdomain.toLowerCase(), s);
    }

    // 5. Query and augment with Tenant table records (excluding DELETED)
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
          institutionTypes: true,
          tier: true,
          status: true,
          statusReason: true,
          statusChangedAt: true,
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
          existing.institutionTier = t.tier || "PRIMARY";
          if (!existing.academic_tiers || existing.academic_tiers.length === 0) {
            existing.academic_tiers = buildDefaultTiers(null, t.institutionTypes, t.tier);
          }
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
            existing.suspensionReason = t.statusReason || t.suspendedReason || "Subscription overdue";
            existing.suspendedAt = t.suspendedAt ? new Date(t.suspendedAt).toISOString() : undefined;
          } else {
            existing.status = "ACTIVE";
            existing.isActive = true;
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
            suspensionReason: t.statusReason || t.suspendedReason || null,
            suspendedAt: t.suspendedAt ? new Date(t.suspendedAt).toISOString() : undefined,
            tier: t.isDemo || t.isTrial ? "Free" : "Basic",
            institutionTier: t.tier || "PRIMARY",
            studentsCount: t.isDemo ? 120 : 0,
            students_count: t.isDemo ? 120 : 0,
            staff_count: 0,
            academic_tiers: buildDefaultTiers(null, t.institutionTypes, t.tier),
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

    let result = Array.from(combinedMap.values());

    if (search) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.subdomain.toLowerCase().includes(search) ||
          s.code.toLowerCase().includes(search) ||
          s.adminName.toLowerCase().includes(search)
      );
    }

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
