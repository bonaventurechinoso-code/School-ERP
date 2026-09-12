import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { 
  ShieldAlert, 
  BookOpen, 
  Calendar, 
  GraduationCap, 
  Clock, 
  Award, 
  CheckCircle2, 
  User, 
  ArrowRight, 
  LogOut, 
  Building2, 
  ArrowLeft 
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function TenantStudentPortalPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams: Promise<{ denied?: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const isAccessDenied = searchParams.denied === "true" || searchParams.denied === "1";

  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolDomain },
    include: {
      academicTiers: true,
    },
  });

  if (!school) {
    return notFound();
  }

  const primaryColor = (school as any).branding?.primaryColor || "#4f46e5";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
      {/* Top Navigation */}
      <header className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg tracking-tight text-slate-900 dark:text-white leading-tight">Student Portal</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                {school.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Academic Workspace & Learning Records</p>
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
                  Access Restricted • Security Intercept
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-200 dark:bg-red-900 font-extrabold text-red-800 dark:text-red-200">
                  HTTP 403 BLOCKED
                </span>
              </div>
              <p className="text-xs sm:text-sm text-red-800/90 dark:text-red-300/90 mt-1 font-medium leading-relaxed">
                Administrative dashboards and settings are strictly reserved for school administrators and supervisors. Your request was securely routed here to your dedicated student workspace for <strong>{school.name}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Student Welcome Banner */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-bold mb-3 border border-indigo-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Active Student Enrollment • {school.name}</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-2">
                Welcome to your Student Workspace
              </h2>
              <p className="text-sm text-indigo-200 max-w-xl">
                Access your personalized class timetable, upcoming term assessments, published report cards, and attendance records.
              </p>

              {/* Academic Tiers Available */}
              {school.academicTiers.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-2">
                  <span className="text-xs text-indigo-300/70 font-semibold uppercase tracking-wider">Available Tiers:</span>
                  {school.academicTiers.map((tier) => (
                    <span 
                      key={tier.id}
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-indigo-100 border border-white/15 backdrop-blur-xs"
                    >
                      {tier.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shrink-0">
              <div className="w-12 h-12 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold text-lg">
                <User className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-indigo-200 uppercase font-bold tracking-wider">Student ID</p>
                <p className="text-sm font-black text-white">STU-2026-PRIMARY</p>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Enrolled Courses</span>
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">8</p>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">Active This Term</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Attendance Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">96.4%</p>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mt-1 block">Present 52/54 Days</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Current Term GPA</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">3.88</p>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-1 block">First Class Standing</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Upcoming Exams</span>
              <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">2</p>
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-1 block">Scheduled Next Week</span>
          </div>
        </div>

        {/* Academic Quick Links */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs">
          <h3 className="text-base font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Student Learning Modules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition group cursor-pointer">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                Weekly Timetable
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
                Review period schedules, room numbers, and subject assignments.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                <span>View Schedule</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition group cursor-pointer">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                Published Report Cards
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
                Download verified termly report cards and teacher remarks.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                <span>Download Cards</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition group cursor-pointer">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                Transcripts & Scores
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
                Cumulative academic performance records across completed tiers.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                <span>View Transcripts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
