import React from "react";
import Link from "next/link";
import { Users, BookOpen, FileText, Wallet, Calendar } from "lucide-react";
import {
  getEnrolledStudentsCount,
  getActiveStaffCount,
  getPendingApplicationsCount,
  getTermlyRevenue,
  getEventsCount,
} from "./actions";

/**
 * Standard Dashboard Skeleton Placeholder:
 * Matches exact geometry and typography of modular cards to eliminate CLS (Cumulative Layout Shift).
 */
export function DashboardSkeleton() {
  return (
    <div className="col-span-1 p-5 sm:p-6 rounded-2xl shadow-sm h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 border-t-4 border-t-slate-200 dark:border-t-zinc-700 animate-pulse relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded-md w-36"></div>
        <div className="w-9 h-9 bg-slate-200 dark:bg-zinc-700 rounded-xl"></div>
      </div>
      <div className="h-10 sm:h-12 bg-slate-200 dark:bg-zinc-700 rounded-lg w-24 mb-3"></div>
      <div className="h-3 bg-slate-100 dark:bg-zinc-800 rounded-md w-40"></div>
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

  return (
    <Link href={`/${subdomain}/students`} className="block col-span-1 active:scale-[0.98] transition-transform">
      <div 
        className="p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md transition-all h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 border-t-4 text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
        style={{ borderTopColor: accentColor }}
      >
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
          <BookOpen className="w-32 h-32" />
        </div>
        <div className="flex items-center justify-between mb-4 relative z-10 gap-2">
          <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate pr-1">
            Pupils / Students Enrolled
          </h3>
          <div 
            className="p-2 sm:p-2.5 rounded-xl shadow-xs shrink-0" 
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        <p className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white relative z-10 leading-none truncate">
          {enrolledStudents.toLocaleString()}
        </p>
        <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 mt-3 block relative z-10">
          Active Enrolled Roster
        </span>
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
  const accentColor = primaryColor || "#4f46e5";

  return (
    <div 
      className="col-span-1 active:scale-[0.98] transition-transform p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 border-t-4 text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
      style={{ borderTopColor: accentColor }}
    >
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
        <Users className="w-32 h-32" />
      </div>
      <div className="flex items-center justify-between mb-4 relative z-10 gap-2">
        <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate pr-1">
          Teachers & Staff
        </h3>
        <div 
          className="p-2 sm:p-2.5 rounded-xl shadow-xs shrink-0" 
          style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
        >
          <Users className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      <p className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white relative z-10 leading-none truncate">
        {activeStaff.toLocaleString()}
      </p>
      <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 mt-3 block relative z-10">
        Active Academic & Support Staff
      </span>
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
    <Link href={`/${subdomain}/admissions`} className="block col-span-1 active:scale-[0.98] transition-transform">
      <div 
        className="p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md transition-all h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 border-t-4 text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
        style={{ borderTopColor: accentColor }}
      >
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
          <FileText className="w-32 h-32" />
        </div>
        <div className="flex items-center justify-between mb-4 relative z-10 gap-2">
          <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate pr-1">
            Pending Admissions
          </h3>
          <div 
            className="p-2 sm:p-2.5 rounded-xl shadow-xs shrink-0" 
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        <p className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white relative z-10 leading-none truncate">
          {pendingApplications.toLocaleString()}
        </p>
        <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 mt-3 block relative z-10">
          Awaiting Review & Placement
        </span>
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
  activeTier,
  primaryColor,
}: {
  schoolId: string;
  activeTier?: string;
  primaryColor?: string;
}) {
  const termlyRevenue = await getTermlyRevenue(schoolId, activeTier);
  const accentColor = primaryColor || "#4f46e5";

  return (
    <div 
      className="col-span-1 active:scale-[0.98] transition-transform p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 border-t-4 text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
      style={{ borderTopColor: accentColor }}
    >
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
        <Wallet className="w-32 h-32" />
      </div>
      <div className="flex items-center justify-between mb-4 relative z-10 gap-2">
        <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate pr-1">
          Termly Revenue
        </h3>
        <div 
          className="p-2 sm:p-2.5 rounded-xl shadow-xs shrink-0" 
          style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
        >
          <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white relative z-10 leading-none truncate">
        ₦{termlyRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-3 block relative z-10">
        Verified Fee Payments
      </span>
    </div>
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
  const accentColor = primaryColor || "#4f46e5";

  return (
    <div 
      className="col-span-1 active:scale-[0.98] transition-transform p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 border-t-4 text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
      style={{ borderTopColor: accentColor }}
    >
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
        <Calendar className="w-32 h-32" />
      </div>
      <div className="flex items-center justify-between mb-4 relative z-10 gap-2">
        <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate pr-1">
          Events This Week
        </h3>
        <div 
          className="p-2 sm:p-2.5 rounded-xl shadow-xs shrink-0" 
          style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
        >
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      <p className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white relative z-10 leading-none truncate">
        {eventsCount}
      </p>
      <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 mt-3 block relative z-10">
        Scheduled on Timetable
      </span>
    </div>
  );
}
