import { ReactNode } from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import ClientLayout from "../ClientLayout";
import WalletTopUp from "../WalletTopUp";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { schoolDomain: string };
}) {
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
