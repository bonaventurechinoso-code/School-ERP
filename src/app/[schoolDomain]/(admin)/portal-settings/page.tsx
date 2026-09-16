import { basePrisma } from "@/lib/tenant-prisma";
import PortalSettingsForm from "./PortalSettingsForm";
import { notFound } from "next/navigation";

export default async function PortalSettingsPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }> | { schoolDomain: string };
}) {
  const params = await Promise.resolve(paramsPromise);
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
  });

  if (!school) {
    return notFound();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Public Portal Settings</h1>
        <p className="text-slate-500 mt-1">Configure your institution&apos;s public website, online application links, and branding details.</p>
      </div>

      <PortalSettingsForm 
        schoolId={school.id} 
        subdomain={school.subdomain}
        initialName={school.name}
        initialPhone={school.contactPhone || ""}
        initialIsPublic={school.isPublicPortalEnabled}
        initialGreeting={school.welcomeGreeting || ""}
      />
    </div>
  );
}
