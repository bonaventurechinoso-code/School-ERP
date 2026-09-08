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
  let school = null;
  try {
    school = await basePrisma.school.findUnique({
      where: { subdomain: params.schoolDomain },
      include: { academicTiers: true },
    });
  } catch (error) {
    console.error("Tenant DB fetch error:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Tenant Offline / Under Maintenance</h2>
          <p>We are unable to connect to this tenant's metadata context at the moment. Please try again later.</p>
        </div>
      </div>
    );
  }

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

  // Resolve precise tier based on academicTiers
  let preciseTier = "K12_GENERIC";
  if (school.academicTiers.length > 0) {
    const tierNames = school.academicTiers.map(t => t.name.toUpperCase());
    const hasPrimary = tierNames.some(t => t.includes("PRIMARY"));
    const hasSecondary = tierNames.some(t => t.includes("SECONDARY") || t.includes("HIGH SCHOOL"));
    
    if (tierNames.some(t => t.includes("UNIVERSITY"))) preciseTier = "UNIVERSITY";
    else if (tierNames.some(t => t.includes("POLYTECHNIC"))) preciseTier = "POLYTECHNIC";
    else if (tierNames.some(t => t.includes("COLLEGE"))) preciseTier = "COLLEGE_OF_EDUCATION";
    else if (tierNames.some(t => t.includes("HIGHER ED"))) preciseTier = "UNIVERSITY";
    else if (hasPrimary && hasSecondary) preciseTier = "PRIMARY_SECONDARY";
    else if (hasPrimary) preciseTier = "PRIMARY";
    else if (hasSecondary) preciseTier = "SECONDARY";
    else if (tierNames.some(t => t.includes("NURSERY") || t.includes("DAYCARE") || t.includes("EARLY CARE"))) preciseTier = "NURSERY";
  }

  const tenantData: any = {
    id: school.id,
    name: school.name,
    subdomain: school.subdomain,
    institutionType: isHigherEd ? "HIGHER_ED" : "K12",
    preciseTier: preciseTier,
    subscriptionPlan: school.subscriptionPlan,
    branding: {
      primaryColor: "#0f172a", // Defaulting to slate-900
    },
  };

  try {
    const { cookies } = await import("next/headers");
    const sessionToken = cookies().get("session")?.value;
    if (sessionToken) {
      const { jwtVerify } = await import("jose");
      const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(sessionToken, secret);
      tenantData.userRole = payload.role as string;
    }
  } catch (err) {
    console.error("Failed to decode session role for tenant context");
  }

  return (
    <TenantProvider tenant={tenantData}>
      {children}
    </TenantProvider>
  );
}
