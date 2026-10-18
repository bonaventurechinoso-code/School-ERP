import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCachedSchool } from "@/lib/cache";
import { getSession } from "@/lib/auth";
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

  // 1. ISOLATE STUDENTS FROM ADMINISTRATIVE WORKSPACES
  if (userRole === "STUDENT") {
    redirect(`/${params.schoolDomain}/portal/student`);
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
      tiers={school.academicTiers.map((t) => ({
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
