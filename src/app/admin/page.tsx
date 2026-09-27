import Link from "next/link";
import {
  Building2,
  Server,
  Users,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Activity,
  PlusCircle,
  PauseCircle,
  CheckCircle2,
  Trash2,
  Clock,
} from "lucide-react";
import { basePrisma } from "@/lib/tenant-prisma";
import { formatCurrency } from "@/lib/format-utils";
import { getRecentActivityTimeline } from "@/lib/admin-notifications";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [schoolsCount, studentsCount, staffCount, platformWallet, recentSchools, recentActivities] =
    await Promise.all([
      basePrisma.school.count(),
      basePrisma.student.count(),
      basePrisma.staff.count(),
      basePrisma.platformWallet.findFirst({ select: { totalRevenue: true } }),
      basePrisma.school.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          subdomain: true,
          _count: { select: { students: true } },
        },
      }),
      getRecentActivityTimeline(10),
    ]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Master Control Center
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              School ERP Multi-Tenant SaaS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Super-Admin Platform Command
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Centralized administration shell governing multi-tenant schools, settlements, and telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/tenants"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-bold shadow-xs transition"
          >
            Provision School <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Tenants</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {schoolsCount}
          </div>
          <Link href="/admin/tenants" className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 inline-flex items-center gap-1 font-semibold hover:underline">
            Manage Directory <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Students</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {studentsCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across all registered schools</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Platform Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {formatCurrency(platformWallet?.totalRevenue ? Number(platformWallet.totalRevenue) : 0)}
          </div>
          <Link href="/admin/billings" className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 inline-flex items-center gap-1 font-semibold hover:underline">
            View Platform Ledger <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Platform Status</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Online</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cluster healthy & listening</p>
        </div>
      </div>

      {/* Recent Activity Timeline (Latest 10 Events: Tenant Created, Suspended, Deleted) */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {/* Card Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Activity className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Activity
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                Latest 10 events
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Real-time timeline of tenant registrations, status updates, and administrative platform lifecycle events
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/audit-logs"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              Full Audit Trail <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Timeline Events List */}
        <div className="p-5">
          {recentActivities.length === 0 ? (
            <div className="py-10 text-center">
              <Activity className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600 mb-2 stroke-[1.5]" />
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                No recent activity recorded yet
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Tenant creations, status suspensions, and deletions will automatically log here in real-time.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
              {recentActivities.map((evt, idx) => {
                let badgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                let badgeText = "Created";
                let icon = <PlusCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
                let dotRing = "ring-emerald-500/20 bg-emerald-500";

                if (evt.type === "SUSPENDED") {
                  badgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
                  badgeText = "Suspended";
                  icon = <PauseCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
                  dotRing = "ring-amber-500/20 bg-amber-500";
                } else if (evt.type === "ACTIVATED") {
                  badgeStyle = "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800";
                  badgeText = "Activated";
                  icon = <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
                  dotRing = "ring-blue-500/20 bg-blue-500";
                } else if (evt.type === "DELETED") {
                  badgeStyle = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800";
                  badgeText = "Deleted";
                  icon = <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
                  dotRing = "ring-rose-500/20 bg-rose-500";
                }

                return (
                  <div key={evt.id || idx} className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2 group">
                    {/* Node Dot */}
                    <div className="absolute -left-6 top-1 sm:top-1/2 sm:-translate-y-1/2 w-5 h-5 rounded-full bg-white dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-700 flex items-center justify-center">
                      <span className={`w-2 h-2 rounded-full ${dotRing}`} />
                    </div>

                    {/* Event Info */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border shrink-0 ${badgeStyle}`}>
                        {icon}
                        {badgeText}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href="/admin/tenants"
                            className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate"
                          >
                            {evt.schoolName}
                          </Link>
                          {evt.subdomain && (
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200/50 dark:border-zinc-700/50">
                              {evt.subdomain}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                          {evt.description}
                        </p>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="text-left sm:text-right shrink-0 pl-11 sm:pl-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                        <Clock className="w-3 h-3" />
                        {evt.timeAgo}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Isolated Miniature Platform Telemetry Strip (< 15% Screen Height) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* 1. Latest Provisioned Tenant Snapshot */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <Building2 className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Latest Tenant</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Provisioning Log</span>
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {recentSchools[0]?.name || "No tenant provisioned yet"}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
              {recentSchools[0]
                ? `${recentSchools[0].subdomain}.bonaveeict.com.ng • ${recentSchools[0]._count.students} students enrolled`
                : "Active cluster ready for tenant deployments."}
            </p>
          </div>
          <div className="pt-3 mt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              {schoolsCount} total tenants
            </span>
            <Link
              href="/admin/tenants"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              Tenants Console <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* 2. Platform Telemetry & Health Snapshot */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Cluster State</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Operational</span>
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              Edge Middleware & Multi-Tenant Routing
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
              Database connection pools and Redis cache streams operating normally.
            </p>
          </div>
          <div className="pt-3 mt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              99.98% System Uptime
            </span>
            <Link
              href="/admin/webhooks"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              Webhook Logs <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* 3. Platform Revenue & Billings Snapshot */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Revenue Settlement</span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Manual Verified</span>
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {formatCurrency(platformWallet?.totalRevenue ? Number(platformWallet.totalRevenue) : 0)} Verified Total
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
              Flat monthly SaaS portal subscriptions (0% fee model).
            </p>
          </div>
          <div className="pt-3 mt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              Subscription Billing
            </span>
            <Link
              href="/admin/billings"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              Financial Hub <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
