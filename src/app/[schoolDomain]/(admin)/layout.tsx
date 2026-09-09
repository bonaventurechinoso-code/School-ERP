import { ReactNode } from "react";
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
  });

  if (!school) return null;

  return (
    <ClientLayout 
      schoolName={school.name}
      headerContent={<WalletTopUp schoolId={school.id} walletBalance={school.walletBalance} />}
    >
      {children}
    </ClientLayout>
  );
}
