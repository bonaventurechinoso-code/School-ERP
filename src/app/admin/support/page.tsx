import { prisma } from "@/lib/prisma";
import {
  LifeBuoy,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Server,
  Database,
  Radio,
  Mail,
  Send,
  Building2,
  Clock,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const tenants = await prisma.tenant.findMany({
    where: {
      status: "ACTIVE",
      NOT: {
        OR: [
          { subdomain: { equals: "riverside", mode: "insensitive" } },
          { schoolName: { contains: "riverside", mode: "insensitive" } },
        ],
      },
    },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      schoolName: true,
      subdomain: true,
      status: true,
      adminEmail: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Module 6
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Operations & Incident Desk
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Support Desk & Infrastructure Health
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Log tenant support inquiries, broadcast maintenance bulletins, and monitor platform uptime
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            All Core Systems Normal
          </span>
        </div>
      </div>

      {/* Cluster Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PostgreSQL */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
              <Database className="w-4 h-4 text-indigo-500" />
              PostgreSQL Cluster
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-base font-black text-slate-900 dark:text-white">
            Operational
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            Latency ~1.8ms • Connection Pool Healthy
          </div>
        </div>

        {/* Redis Cache */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
              <Server className="w-4 h-4 text-blue-500" />
              Redis Tier Cache
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-base font-black text-slate-900 dark:text-white">
            Operational
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            Tenant metadata cache warm
          </div>
        </div>

        {/* Manual Direct Settlements */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
              <Radio className="w-4 h-4 text-emerald-500" />
              Manual Direct Settlements
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-base font-black text-slate-900 dark:text-white">
            Operational
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            0% fee direct bank transfer ledger active
          </div>
        </div>

        {/* Dispatch Mail */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
              <Mail className="w-4 h-4 text-purple-500" />
              Email Dispatch
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-base font-black text-slate-900 dark:text-white">
            Operational
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            Notifications queue clear
          </div>
        </div>
      </div>

      {/* Broadcast Bulletin + Ticket Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Broadcast Form */}
        <div className="lg:col-span-4 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
            <Send className="w-4 h-4 text-indigo-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Broadcast System Alert
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Broadcast a scheduled maintenance or upgrade banner to all tenant portals.
          </p>

          <form className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Notice Title
              </label>
              <input
                type="text"
                placeholder="e.g. Scheduled Network Upgrade"
                className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Impact Level
              </label>
              <select className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="INFO">Informational Only</option>
                <option value="WARN">Maintenance Window (Low Impact)</option>
                <option value="CRITICAL">Temporary Service Downtime</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Announcement Body
              </label>
              <textarea
                rows={3}
                placeholder="Details of the scheduled event..."
                className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-bold transition shadow-xs"
            >
              Publish Broadcast
            </button>
          </form>
        </div>

        {/* Tenant Infrastructure Status Log */}
        <div className="lg:col-span-8 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Active Tenant Infrastructure Health Log
              </h3>
            </div>
            <span className="text-xs text-slate-400">Live heartbeat</span>
          </div>

          <div className="space-y-2.5">
            {tenants.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-zinc-500 italic text-xs">
                No active tenants registered.
              </div>
            ) : (
              tenants.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl border border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-950/40 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {t.schoolName}
                    </span>
                    <p className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                      {t.subdomain}.bonaveeict.com.ng • {t.adminEmail}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Workspace Normal
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
