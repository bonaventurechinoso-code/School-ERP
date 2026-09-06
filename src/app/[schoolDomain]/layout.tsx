import { ReactNode } from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import { TenantProvider } from "@/lib/tenant-context";
export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { schoolDomain: string };
}) {
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: { academicTiers: true },
  });

  if (!school) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
          <p>No school registered under domain: {params.schoolDomain}</p>
        </div>
      </div>
    );
  }

  const isHigherEd = school.academicTiers.some(tier => 
    tier.name.toUpperCase().includes("UNIVERSITY") || 
    tier.name.toUpperCase().includes("POLYTECHNIC") || 
    tier.name.toUpperCase().includes("COLLEGE") ||
    tier.name.toUpperCase().includes("HIGHER ED")
  );

  const tenantData: any = {
    id: school.id,
    name: school.name,
    subdomain: school.subdomain,
    institutionType: isHigherEd ? "HIGHER_ED" : "K12",
    branding: {
      primaryColor: "#0f172a", // Defaulting to slate-900
    },
  };

  return (
    <TenantProvider tenant={tenantData}>
      {children}
    </TenantProvider>
  );
}
