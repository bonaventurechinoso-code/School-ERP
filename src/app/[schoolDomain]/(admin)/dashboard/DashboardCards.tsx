import React from "react";
import Link from "next/link";
import { Users, BookOpen, FileText, CreditCard, Calendar, Clock, Building2 } from "lucide-react";
import { getTierConfig } from "@/lib/tier-config";
import {
  getEnrolledStudentsCount,
  getActiveStaffCount,
  getPendingApplicationsCount,
  getTermlyRevenue,
  getEventsCount,
  getPendingVerificationsCount,
  getSchoolCollectionBank,
} from "./actions";

/**
 * Standard Dashboard Skeleton Placeholder:
 * Matches exact geometry and typography of modular cards to eliminate CLS (Cumulative Layout Shift).
 */
export function DashboardSkeleton() {
  return (
    <div className="col-span-1 p-6 rounded-2xl shadow-xs min-h-[165px] sm:min-h-[175px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 border-t-[3.5px] border-t-slate-200 dark:border-t-zinc-700 animate-pulse flex flex-col justify-between overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="h-3.5 bg-slate-200 dark:bg-zinc-700 rounded-md w-28"></div>
        <div className="w-8 h-8 bg-slate-200 dark:bg-zinc-700 rounded-xl"></div>
      </div>
      <div className="h-9 sm:h-10 bg-slate-200 dark:bg-zinc-700 rounded-lg w-24 my-2"></div>
      <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="h-3 bg-slate-100 dark:bg-zinc-800 rounded-md w-32"></div>
        <div className="w-1.5 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full"></div>
      </div>
    </div>
  );
}

/**
 * 1. Modular Data Card: Student Roster
 * Asynchronously decoupled. Streams into view the millisecond student count cache resolves.
 */
export async function StudentRosterCard({
  schoolId,
  subdomain,
  activeTier,
  primaryColor,
}: {
  schoolId: string;
  subdomain: string;
  activeTier?: string;
  primaryColor?: string;
}) {
  const enrolledStudents = await getEnrolledStudentsCount(schoolId, activeTier);
  const accentColor = primaryColor || "#4f46e5";
  const tierConfig = getTierConfig(activeTier);

  return (
    <Link href={`/${subdomain}/students`} className="block col-span-1 active:scale-[0.98] transition-transform">
      <div 
        className="p-6 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-h-[165px] sm:min-h-[175px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 border-t-[3.5px] text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
        style={{ borderTopColor: accentColor }}
      >
        <div className="flex items-center justify-between gap-2 relative z-10">
          <h3 className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
            {tierConfig.terms.learnerPlural || tierConfig.terms.studentPlural} Enrolled
          </h3>
          <div 
            className="p-2 sm:p-2.5 rounded-xl shadow-2xs shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/5" 
            style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
          >
            <BookOpen className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
        </div>

        <div className="my-2 relative z-10">
          <p className="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-slate-900 dark:text-white leading-none truncate">
            {enrolledStudents.toLocaleString()}
          </p>
        </div>

        <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 relative z-10 flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate">
            Active Enrolled Roster
          </span>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        </div>
      </div>
    </Link>
  );
}

/**
 * 2. Modular Data Card: Staff Status
 * Asynchronously decoupled. Streams into view independently.
 */
export async function StaffStatusCard({
  schoolId,
  activeTier,
  primaryColor,
}: {
  schoolId: string;
  activeTier?: string;
  primaryColor?: string;
}) {
  const activeStaff = await getActiveStaffCount(schoolId, activeTier);
  const accentColor = primaryColor || "#0284c7";

  return (
    <div 
      className="col-span-1 active:scale-[0.98] transition-transform p-6 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-h-[165px] sm:min-h-[175px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 border-t-[3.5px] text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
      style={{ borderTopColor: accentColor }}
    >
      <div className="flex items-center justify-between gap-2 relative z-10">
        <h3 className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
          Teachers & Staff
        </h3>
        <div 
          className="p-2 sm:p-2.5 rounded-xl shadow-2xs shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/5" 
          style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
        >
          <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
      </div>

      <div className="my-2 relative z-10">
        <p className="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-slate-900 dark:text-white leading-none truncate">
          {activeStaff.toLocaleString()}
        </p>
      </div>

      <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 relative z-10 flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate">
          Academic & Support Staff
        </span>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
      </div>
    </div>
  );
}

/**
 * 3. Modular Data Card: Applicant Pipeline
 * Asynchronously decoupled. Fetches directly from central admissions cache.
 */
export async function ApplicantPipelineCard({
  schoolId,
  subdomain,
  activeTier,
  activeTierId,
  primaryColor,
}: {
  schoolId: string;
  subdomain: string;
  activeTier?: string;
  activeTierId?: string;
  primaryColor?: string;
}) {
  const pendingApplications = await getPendingApplicationsCount(schoolId, activeTier, activeTierId);
  const accentColor = primaryColor || "#4f46e5";

  return (
    <Link href={`/${subdomain}/students`} className="block col-span-1 active:scale-[0.98] transition-transform">
      <div 
        className="p-6 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-h-[165px] sm:min-h-[175px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 border-t-[3.5px] text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
        style={{ borderTopColor: accentColor }}
      >
        <div className="flex items-center justify-between gap-2 relative z-10">
          <h3 className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
            Pending Admissions
          </h3>
          <div 
            className="p-2 sm:p-2.5 rounded-xl shadow-2xs shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/5" 
            style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
          >
            <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
        </div>

        <div className="my-2 relative z-10">
          <p className="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-slate-900 dark:text-white leading-none truncate">
            {pendingApplications.toLocaleString()}
          </p>
        </div>

        <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 relative z-10 flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate">
            Awaiting Review & Placement
          </span>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        </div>
      </div>
    </Link>
  );
}

/**
 * 4. Modular Data Card: Financial Summary
 * Asynchronously decoupled. Protected aggregation for authorized financial managers.
 */
export async function FinancialSummaryCard({
  schoolId,
  subdomain,
  activeTier,
  primaryColor,
}: {
  schoolId: string;
  subdomain?: string;
  activeTier?: string;
  primaryColor?: string;
}) {
  const termlyRevenue = await getTermlyRevenue(schoolId, activeTier);
  const accentColor = primaryColor || "#059669";
  const targetFinanceUrl = subdomain ? `/${subdomain}/finance/fees` : "/dashboard/finance";

  return (
    <Link href={targetFinanceUrl} className="block col-span-1 active:scale-[0.98] transition-transform">
      <div 
        className="p-6 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-h-[165px] sm:min-h-[175px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 border-t-[3.5px] text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
        style={{ borderTopColor: accentColor }}
      >
        <div className="flex items-center justify-between gap-2 relative z-10">
          <h3 className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
            Term Revenue
          </h3>
          <div 
            className="p-2 sm:p-2.5 rounded-xl shadow-2xs shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/5" 
            style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
          >
            <CreditCard className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
        </div>

        <div className="my-2 relative z-10">
          <p className="text-2xl sm:text-3xl lg:text-[34px] font-black tracking-tight text-slate-900 dark:text-white leading-none truncate font-mono">
            ₦{termlyRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 relative z-10 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">
            Direct to School Bank (100%)
          </span>
          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
        </div>
      </div>
    </Link>
  );
}

/**
 * 5. Modular Data Card: Events Module
 * Asynchronously decoupled. Fetches scheduled timetable items.
 */
export async function EventsStatusCard({
  schoolId,
  activeTier,
  primaryColor,
}: {
  schoolId: string;
  activeTier?: string;
  primaryColor?: string;
}) {
  const eventsCount = await getEventsCount(schoolId, activeTier);
  const accentColor = primaryColor || "#7c3aed";
  const tierConfig = getTierConfig(activeTier);

  return (
    <div 
      className="col-span-1 active:scale-[0.98] transition-transform p-6 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-h-[165px] sm:min-h-[175px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 border-t-[3.5px] text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
      style={{ borderTopColor: accentColor }}
    >
      <div className="flex items-center justify-between gap-2 relative z-10">
        <h3 className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
          Events This Week
        </h3>
        <div 
          className="p-2 sm:p-2.5 rounded-xl shadow-2xs shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/5" 
          style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
        >
          <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
      </div>

      <div className="my-2 relative z-10">
        <p className="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-slate-900 dark:text-white leading-none truncate">
          {eventsCount}
        </p>
      </div>

      <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 relative z-10 flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate">
          Scheduled on {tierConfig.terms.periodName} Timetable
        </span>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
      </div>
    </div>
  );
}

/**
 * 6. Modular Data Card: Pending Verifications
 * Displays pending manual bank transfer proofs awaiting bursar audit.
 */
export async function PendingVerificationsCard({
  schoolId,
  subdomain,
  primaryColor,
}: {
  schoolId: string;
  subdomain: string;
  primaryColor?: string;
}) {
  const pendingCount = await getPendingVerificationsCount(schoolId);
  const accentColor = primaryColor || "#d97706";

  return (
    <Link href={`/${subdomain}/finance/verifications`} className="block col-span-1 active:scale-[0.98] transition-transform">
      <div 
        className="p-6 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-h-[165px] sm:min-h-[175px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 border-t-[3.5px] text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
        style={{ borderTopColor: accentColor }}
      >
        <div className="flex items-center justify-between gap-2 relative z-10">
          <h3 className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
            <span>Pending Verifications</span>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
            )}
          </h3>
          <div 
            className="p-2 sm:p-2.5 rounded-xl shadow-2xs shrink-0 relative ring-1 ring-inset ring-black/5 dark:ring-white/5" 
            style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
          >
            <Clock className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            {pendingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900" />
            )}
          </div>
        </div>

        <div className="my-2 relative z-10">
          <p className="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-slate-900 dark:text-white leading-none truncate">
            {pendingCount.toLocaleString()}
          </p>
        </div>

        <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 relative z-10 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 truncate">
            Bank Proofs Awaiting Audit
          </span>
          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />
        </div>
      </div>
    </Link>
  );
}

/**
 * 7. Modular Data Card: Collection Bank Summary Card
 * Replaces the obsolete wallet balance widget with direct bank details.
 */
export async function CollectionBankCard({
  schoolId,
  subdomain,
}: {
  schoolId: string;
  subdomain: string;
}) {
  const bank = await getSchoolCollectionBank(schoolId);
  const isConfigured = Boolean(bank?.settlementAccountNumber && bank?.settlementBankName);

  return (
    <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full max-w-full overflow-hidden">
      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-50">
              Your Collection Bank
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Direct Mode (0% fee)
            </span>
          </div>
          {isConfigured ? (
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 break-all sm:break-normal">
              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                {bank?.settlementBankName}
              </span>{" "}
              —{" "}
              <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                {bank?.settlementAccountNumber}
              </span>{" "}
              ({bank?.settlementAccountName})
            </p>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
              Not configured yet. Setup your school bank account so parents can transfer tuition directly.
            </p>
          )}
        </div>
      </div>

      <Link
        href={`/${subdomain}/settings/bank`}
        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-bold text-slate-800 dark:text-zinc-200 transition shrink-0"
      >
        {isConfigured ? "Edit Bank Settings" : "Setup Bank Account"}
      </Link>
    </div>
  );
}
