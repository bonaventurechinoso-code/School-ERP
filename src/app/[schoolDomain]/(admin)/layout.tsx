import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { getCachedSchool } from "@/lib/cache";
import { isAdminExecutive, getDevMockRoleConfig } from "@/lib/permissions";
import ClientLayout from "../ClientLayout";

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

  if (!school) return null;

  const currentTier = cookieStore.get("activeTier")?.value || null;
  const sessionToken = cookieStore.get("session")?.value;

  let userRole = "";
  let staffRole = "";
  if (sessionToken) {
    try {
      const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(sessionToken, secret);
      userRole = ((payload.role as string) || "").toUpperCase();
      staffRole = (payload.staffRole as string) || "";
    } catch (err) {
      console.error("[AdminLayout] Invalid session token:", err);
    }
  }

  const isDev = process.env.NODE_ENV === "development";
  const devMockRoleSetting = isDev ? process.env.NEXT_PUBLIC_DEV_MOCK_ROLE : null;
  if (!userRole && isDev && devMockRoleSetting) {
    const mock = getDevMockRoleConfig(devMockRoleSetting);
    if (mock) {
      userRole = mock.role.toUpperCase();
      staffRole = mock.staffRole;
    }
  }

  // 1. ISOLATE STUDENTS FROM ADMINISTRATIVE WORKSPACES
  if (userRole === "STUDENT") {
    redirect("/portal/student");
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
