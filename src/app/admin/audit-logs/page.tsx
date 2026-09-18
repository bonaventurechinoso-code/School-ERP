import { prisma } from "@/lib/prisma";
import {
  History,
  ShieldCheck,
  Search,
  Filter,
  UserCheck,
  Ban,
  PlusCircle,
  Clock,
  Terminal,
  AlertCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string }>;
}) {
  const resolvedParams = await searchParams;
  const q = (resolvedParams.q || "").trim();
  const actionFilter = (resolvedParams.action || "").trim();

  const where: any = {};
  if (actionFilter) {
    where.action = actionFilter;
  }
  if (q) {
    where.OR = [
      { actorId: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
      { ipAddress: { contains: q, mode: "insensitive" } },
    ];
  }

  const [auditLogs, totalCount, impersonateCount, suspendCount] =
    await Promise.all([
      prisma.auditLog.findMany({
        where,
        take: 50,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { action: "impersonate_tenant" } }),
      prisma.auditLog.count({ where: { action: "suspend_tenant" } }),
    ]);

  const getActionBadge = (action: string) => {
    if (action.includes("impersonate")) {
      return {
        style: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
        label: "Impersonation",
      };
    }
    if (action.includes("suspend")) {
      return {
        style: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
        label: "Suspension",
      };
    }
    if (action.includes("create")) {
      return {
        style: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
        label: "Creation",
      };
    }
    if (action.includes("reactivate")) {
      return {
        style: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        label: "Reactivation",
      };
    }
    return {
      style: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-700",
      label: action,
    };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Module 4
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Compliance & Security Traces
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Super Admin Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Immutable chronological logging of all tenant provisioning, administrative impersonations, and state mutations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
            {totalCount} Total Entries
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Actions</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <History className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Impersonation Logs</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{impersonateCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suspension Traces</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{suspendCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Ban className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Audit Timeline Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Chronological Security Telemetry
            </h3>
          </div>
          <span className="text-xs text-slate-400">Immutable ledger rows</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-zinc-950/50 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Metadata Payload</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-zinc-500 italic">
                    <History className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-zinc-700" />
                    No audit records match the current query.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition">
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${badge.style}`}>
                          {badge.label}
                        </span>
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5">{log.action}</p>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-zinc-200">
                        {log.actorId}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-zinc-400">
                        {log.ipAddress || "127.0.0.1"}
                      </td>
                      <td className="py-3.5 px-4">
                        <pre className="font-mono text-[10px] p-1.5 rounded-md bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 max-w-sm truncate text-slate-700 dark:text-zinc-300">
                          {JSON.stringify(log.metadata)}
                        </pre>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
