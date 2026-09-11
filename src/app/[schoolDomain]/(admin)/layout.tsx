import { ReactNode } from "react";
import { cookies } from "next/headers";
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

  return (
    <ClientLayout 
      schoolName={school.name}
      headerContent={<WalletTopUp schoolId={school.id} walletBalance={school.walletBalance} />}
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
