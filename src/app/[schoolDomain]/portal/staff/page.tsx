import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import { ShieldAlert, Briefcase, LogOut, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import StaffPortalClient from "./StaffPortalClient";
import { fetchStaffPortalInitialData } from "./actions";

export default async function TenantStaffPortalPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams: Promise<{ denied?: string; tab?: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const isAccessDenied = searchParams.denied === "true" || searchParams.denied === "1";
  const validTabs = ["overview", "rosters", "attendance", "gradebook", "schedule", "payslips"] as const;
  const requestedTab = validTabs.includes(searchParams.tab as any)
    ? (searchParams.tab as "overview" | "rosters" | "attendance" | "gradebook" | "schedule" | "payslips")
    : "overview";

  const [school, session] = await Promise.all([
    basePrisma.school.findUnique({
      where: { subdomain: schoolDomain },
      include: {
        academicTiers: {
          orderBy: { level: "asc" },
        },
      },
    }),
    getSession(),
  ]);

  if (!school) {
    return notFound();
  }

  const initialData = await fetchStaffPortalInitialData(school.id, session?.email);

  const staffName = initialData.staffProfile
    ? `${initialData.staffProfile.firstName} ${initialData.staffProfile.lastName}`
    : session?.email
    ? session.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Faculty Educator";
  const staffRole = initialData.staffProfile?.role || session?.staffRole || "Class Teacher";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
      {/* Top Navigation */}
      <header className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 sticky top-0 z-30 px-3.5 sm:px-8 py-3 flex items-center justify-between shadow-xs gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20 shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-black text-base sm:text-lg tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                Staff Portal
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 truncate max-w-[120px] sm:max-w-none">
                {school.name}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium truncate">
              Educator & Staff Classroom Workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <ThemeToggle />
          <Link
            href={`/${school.subdomain}`}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>School Home</span>
          </Link>
          <Link
            href={`/${school.subdomain}/login`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-white transition shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Switch User</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-8 space-y-6">
        {/* Access Denied Interception Notice */}
        {isAccessDenied && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-950/40 dark:to-amber-950/20 border border-red-200/90 dark:border-red-900/60 shadow-sm flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-red-900 dark:text-red-200 uppercase tracking-wider">
                  Administrative Area Restricted
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-200 dark:bg-red-900 font-extrabold text-red-800 dark:text-red-200">
                  STAFF PERMISSION LOCK
                </span>
              </div>
              <p className="text-xs sm:text-sm text-red-800/90 dark:text-red-300/90 mt-1 font-medium leading-relaxed">
                Super administrative consoles and billing/wallet configurations are strictly isolated to School and Platform Administrators. You have been redirected to your staff educator portal for <strong>{school.name}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Interactive Staff Portal Client Module */}
        <StaffPortalClient
          schoolId={school.id}
          schoolName={school.name}
          schoolDomain={school.subdomain}
          staffName={staffName}
          staffRole={staffRole}
          staffProfile={initialData.staffProfile}
          initialPayroll={initialData.payrollRecords}
          initialTimetable={initialData.timetable}
          initialTiers={initialData.tiers}
          initialClassrooms={initialData.classrooms}
          initialCourses={initialData.courses}
          initialStudents={initialData.students}
          defaultTab={requestedTab}
        />
      </main>
    </div>
  );
}
