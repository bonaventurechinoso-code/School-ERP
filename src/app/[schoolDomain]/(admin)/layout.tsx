import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { basePrisma } from "@/lib/tenant-prisma";
import ClientLayout from "../ClientLayout";
import WalletTopUp from "../WalletTopUp";

export default async function AdminLayout({
  children,
  params: paramsPromise,
}: {
  children: ReactNode;
  params: Promise<{ schoolDomain: string }>;
}) {
  const params = await paramsPromise;
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: {
      academicTiers: {
        orderBy: { level: "asc" },
      },
    },
  });

  if (!school) return null;

  const cookieStore = await cookies();
  const currentTier = cookieStore.get("activeTier")?.value || null;
  const sessionToken = cookieStore.get("session")?.value;

  let userRole = "";
  if (sessionToken) {
    try {
      const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(sessionToken, secret);
      userRole = ((payload.role as string) || "").toUpperCase();
    } catch (err) {
      console.error("[AdminLayout] Invalid session token:", err);
    }
  }

  const isDev = process.env.NODE_ENV === "development";

  // 1. ISOLATE STUDENTS AND STAFF FROM ADMIN DASHBOARD (Skipped in development testing)
  if (!isDev) {
    if (userRole === "STUDENT") {
      redirect("/portal/student?denied=true");
    }

    if (userRole === "STAFF") {
      redirect("/portal/staff?denied=true");
    }
  }

  // 2. SECURE WALLET BALANCE ACCESSIBILITY (SUPER_ADMIN & SCHOOL_ADMIN ONLY)
  const isWalletAuthorized = isDev || userRole === "SUPER_ADMIN" || userRole === "SCHOOL_ADMIN";
  const walletElement = isWalletAuthorized ? (
    <WalletTopUp schoolId={school.id} walletBalance={school.walletBalance} />
  ) : null;

  return (
    <ClientLayout 
      schoolName={school.name}
      headerContent={walletElement}
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
