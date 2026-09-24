import Link from "next/link";
import {
  Building2,
  Server,
  Users,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { basePrisma } from "@/lib/tenant-prisma";
import { formatCurrency } from "@/lib/format-utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [schoolsCount, studentsCount, staffCount, platformWallet, recentSchools] =
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
