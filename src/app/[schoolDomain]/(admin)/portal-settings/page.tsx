import { basePrisma } from "@/lib/tenant-prisma";
import PortalSettingsForm from "./PortalSettingsForm";
import { notFound } from "next/navigation";
import { Globe, Settings, ExternalLink, ShieldCheck, Sparkles, Landmark, CheckCircle2, AlertTriangle } from "lucide-react";
import { EntranceExamSettings } from "./actions";

export default async function PortalSettingsPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }> | { schoolDomain: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const params = await Promise.resolve(paramsPromise);
  const searchParams = searchParamsPromise ? await Promise.resolve(searchParamsPromise) : {};
  const initialTab = searchParams?.tab;

  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: {
      academicTiers: {
        orderBy: { level: "asc" }
      },
      admissionLeads: {
        select: { id: true, status: true }
      }
    }
  });

  if (!school) {
    return notFound();
  }

  const activeTiers = school.academicTiers.map((t) => t.name);
  const isBankConfigured = Boolean(
    school.settlementBankName && 
    school.settlementAccountNumber && 
    school.settlementAccountName
  );

  const schoolConfig = (school.tierDatabasesConfig as any) || {};
  const initialEntranceExamSettings: EntranceExamSettings = schoolConfig.entranceExamSettings || {
    enabled: true,
    tiers: {},
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Institutional Command Center
            </span>
            <span className="text-xs text-slate-400 font-medium">Session 2026/2027</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Institutional & Portal Settings
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 text-sm max-w-2xl">
            Configure your institution&apos;s public website, direct tuition collection bank account, online application gateways, and academic branding.
          </p>
        </div>

        {/* Quick Governance Badges */}
        <div className="flex items-center gap-2 shrink-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-2 rounded-2xl shadow-xs">
          <div className="px-3 py-1.5 text-center border-r border-slate-100 dark:border-zinc-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">Portal</div>
            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
              {school.isPublicPortalEnabled ? "LIVE" : "OFFLINE"}
            </div>
          </div>
          <div className="px-3 py-1.5 text-center border-r border-slate-100 dark:border-zinc-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">Settlement Bank</div>
            <div className={`text-xs font-black flex items-center justify-center gap-1 ${
              isBankConfigured 
                ? "text-emerald-600 dark:text-emerald-400" 
                : "text-amber-600 dark:text-amber-400"
            }`}>
              {isBankConfigured ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>ACTIVE</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  <span>ACTION REQ</span>
                </>
              )}
            </div>
          </div>
          <div className="px-3 py-1.5 text-center border-r border-slate-100 dark:border-zinc-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">Tiers</div>
            <div className="text-xs font-black text-indigo-600 dark:text-indigo-400">
              {activeTiers.length} Active
            </div>
          </div>
          <div className="px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase font-bold text-slate-400">Inquiries</div>
            <div className="text-xs font-black text-slate-800 dark:text-white">
              {school.admissionLeads.length}
            </div>
          </div>
        </div>
      </header>

      <PortalSettingsForm 
        schoolId={school.id} 
        subdomain={school.subdomain}
        initialName={school.name}
        initialPhone={school.contactPhone || ""}
        initialIsPublic={school.isPublicPortalEnabled}
        initialGreeting={school.welcomeGreeting || ""}
        academicTiers={activeTiers}
        initialBankName={school.settlementBankName || ""}
        initialBankCode={school.settlementBankCode || ""}
        initialAccountNumber={school.settlementAccountNumber || ""}
        initialAccountName={school.settlementAccountName || ""}
        initialPaymentInstruction={school.paymentInstruction || "Use Student Admission No as transfer narration"}
        initialEntranceExamSettings={initialEntranceExamSettings}
        initialTab={initialTab}
      />
    </div>
  );
}
