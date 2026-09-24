import React from "react";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import SecurityPasswordForm from "@/components/SecurityPasswordForm";
import { Shield, KeyRound, Lock, UserCheck } from "lucide-react";

export default async function AdminSecuritySettingsPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;

  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: schoolDomain.toLowerCase().trim() },
        { slug: schoolDomain.toLowerCase().trim() },
      ],
    },
  });

  if (!school) {
    return notFound();
  }

  const brandColor = (school as any)?.branding?.primaryColor || "#4f46e5";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
          <Shield className="w-4 h-4" />
          <span>Account Protection</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight">
          Personal Security Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
          Manage your credentials, update your login password, and review institutional security guidelines.
        </p>
      </div>

      <SecurityPasswordForm
        schoolDomain={school.subdomain}
        brandColor={brandColor}
        userRole="TENANT_ADMIN"
      />

      {/* Security Best Practices Card */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 text-xs text-slate-600 dark:text-zinc-400 space-y-3">
        <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200 flex items-center gap-2">
          <Lock className="w-4 h-4 text-indigo-500" />
          <span>Institutional Security Recommendations</span>
        </h3>
        <ul className="list-disc list-inside space-y-1.5 leading-relaxed">
          <li>Never share administrative login credentials or session recovery tokens with unauthorized personnel.</li>
          <li>Ensure passwords are unique to this educational institution and not reused across external websites.</li>
          <li>All staff password updates take effect immediately across all active browser sessions.</li>
        </ul>
      </div>
    </div>
  );
}
