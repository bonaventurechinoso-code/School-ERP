import { basePrisma } from "@/lib/tenant-prisma";
import PortalSettingsForm from "./PortalSettingsForm";
import { notFound } from "next/navigation";

export default async function PortalSettingsPage({
  params,
}: {
  params: { schoolDomain: string };
}) {
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
  });

  if (!school) {
    return notFound();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Public Portal Settings</h1>
        <p className="text-slate-500 mt-2">Manage your institution&apos;s public-facing application portal.</p>
      </div>

      <PortalSettingsForm 
        schoolId={school.id} 
        subdomain={school.subdomain}
        initialIsPublic={school.isPublicPortalEnabled}
        initialGreeting={school.welcomeGreeting || ""}
      />
    </div>
  );
}
