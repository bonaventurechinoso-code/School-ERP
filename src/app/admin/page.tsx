import Link from "next/link";
import {
  Building2,
  CreditCard,
  Radio,
  History,
  Settings,
  LifeBuoy,
  Server,
  Users,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { basePrisma } from "@/lib/tenant-prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [schoolsCount, studentsCount, staffCount, platformWallet] =
    await Promise.all([
      basePrisma.school.count(),
      basePrisma.student.count(),
      basePrisma.staff.count(),
      basePrisma.platformWallet.findFirst(),
    ]);

  const recentSchools = await basePrisma.school.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      academicTiers: true,
      _count: { select: { students: true } },
    },
  });

  const modules = [
    {
      title: "Tenants Management",
      description: "Provision new school workspaces, assign academic tiers, and manage domain statuses.",
      href: "/admin/tenants",
      icon: Building2,
      color: "from-blue-600 to-indigo-600",
      badge: `${schoolsCount} Registered`,
    },
    {
      title: "Billings & Paystack",
      description: "Track platform revenue totals, base collection cycles, and Paystack split balances.",
      href: "/admin/billings",
      icon: CreditCard,
      color: "from-emerald-600 to-teal-600",
      badge: "Revenue Hub",
    },
    {
      title: "Webhook Streams",
      description: "Listen to and monitor live Paystack transaction delivery logs and event status feeds.",
      href: "/admin/webhooks",
      icon: Radio,
      color: "from-rose-600 to-pink-600",
      badge: "Live Stream",
    },
    {
      title: "Audit & Telemetry",
      description: "Stream platform state changes, impersonation traces, and administrative telemetry.",
      href: "/admin/audit-logs",
      icon: History,
      color: "from-purple-600 to-indigo-600",
      badge: "Immutable Trail",
    },
    {
      title: "Platform Settings",
      description: "Modify global parameters, commission split percentages, and gateway flags.",
      href: "/admin/settings",
      icon: Settings,
      color: "from-slate-700 to-slate-900",
      badge: "Config Plane",
    },
    {
      title: "Support & Health",
      description: "Manage school help tickets, broadcast maintenance alerts, and view system uptime.",
      href: "/admin/support",
      icon: LifeBuoy,
      color: "from-amber-600 to-orange-600",
      badge: "Cluster Health",
    },
  ];

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
            ₦{Number(platformWallet?.totalRevenue || 0).toLocaleString()}
          </div>
          <Link href="/admin/billings" className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 inline-flex items-center gap-1 font-semibold hover:underline">
            View Paystack Ledger <ArrowRight className="w-3 h-3" />
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

      {/* Module Launcher Grid */}
      <div className="space-y-4">
        <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          Administration Modules
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-200 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                      {m.badge}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-base mt-4 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {m.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
                    {m.description}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-4 group-hover:translate-x-0.5 transition-transform">
                  Launch Console <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Institutional Registrations */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Recently Provisioned Workspaces
          </h3>
          <Link href="/admin/tenants" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            View All Tenants
          </Link>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
          {recentSchools.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No schools registered yet.</p>
          ) : (
            recentSchools.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">{s.name}</span>
                  <span className="font-mono text-slate-400 ml-2">({s.subdomain}.schoolerp.com)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{s._count.students} students</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                    {s.isActive ? 'ACTIVE' : 'SUSPENDED'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
