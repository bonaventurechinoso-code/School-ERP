import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCachedSchool } from "@/lib/cache";
import { getSession } from "@/lib/auth";
import { isTenantSuspended, isTrialExpired } from "@/lib/tenantStatus";
import ClientLayout from "../ClientLayout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({
  children,
  params: paramsPromise,
}: {
  children: ReactNode;
  params: Promise<{ schoolDomain: string }>;
}) {
  // Parallel resolution of routing params and request cookies
  const [params, cookieStore] = await Promise.all([
    paramsPromise,
    cookies(),
  ]);

  // High-performance Redis cache pre-fetch (<1ms from memory)
  const school = await getCachedSchool(params.schoolDomain);

  if (!school) {
    redirect(`/login?error=tenant_not_found&school=${encodeURIComponent(params.schoolDomain)}`);
  }

  // Strict Request-Scoped Server Auth Verification (bound to target tenant)
  const session = await getSession(undefined, params.schoolDomain);
  if (!session) {
    redirect(`/login?school=${encodeURIComponent(params.schoolDomain)}`);
  }

  const currentTier = cookieStore.get("activeTier")?.value || null;
  const userRole = (session.role || session.userRole || "").toUpperCase();
  const isSuperAdmin =
    userRole === "SUPER_ADMIN" ||
    Boolean(session.isSuperAdmin) ||
    session.email === "bonaventure.chinoso@gmail.com" ||
    session.email === "admin@bonaveeict.com.ng";

  // SUSPENSION ENFORCEMENT: Immediately eject active sessions of suspended institutions
  const isSuspended =
    school.isActive === false ||
    school.isSuspended === true ||
    String(school.status || "").toUpperCase() === "SUSPENDED" ||
    String(school.subscriptionStatus || "").toUpperCase() === "SUSPENDED" ||
    isTenantSuspended(school);

  if (isSuspended && !isSuperAdmin) {
    redirect(`/${params.schoolDomain}/login?error=suspended&code=${encodeURIComponent(params.schoolDomain)}`);
  }

  // TRIAL EXPIRY LOCK: Lock access and redirect to upgrade page when 14-day free trial has lapsed
  const isTrialOver = isTrialExpired(school);
  if (isTrialOver && !isSuperAdmin) {
    redirect("/trial-expired");
  }

  // 1. ISOLATE NON-ADMINISTRATIVE ROLES FROM ADMINISTRATIVE WORKSPACES
  if (userRole === "STUDENT") {
    redirect(`/${params.schoolDomain}/portal/student`);
  }
  if (userRole === "PARENT") {
    redirect(`/${params.schoolDomain}/portal/parent`);
  }
  if (
    (userRole === "TEACHER" || userRole === "STAFF") &&
    !isSuperAdmin &&
    !["SCHOOL_ADMIN", "TENANT_ADMIN", "ADMIN", "PRINCIPAL", "HEADMASTER", "VICE_PRINCIPAL"].includes(userRole)
  ) {
    redirect(`/${params.schoolDomain}/portal/staff`);
  }

  // 2. ENFORCE MANDATORY INITIAL PASSWORD CHANGE (Bypassed conditionally for demo tenant)
  const isDemoTenant = params.schoolDomain?.toLowerCase() === "demo";
  if (!isDemoTenant && session.mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <ClientLayout 
      schoolName={school.name}
      headerContent={null}
      tiers={(school.academicTiers || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        databaseName: t.databaseName,
        databaseUrl: t.databaseUrl,
      }))}
      currentTier={currentTier}
    >
      {children}
    </ClientLayout>
  );
}
