"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Search,
} from "lucide-react";
import { AUDIT_LOGS, AuditLogEntry } from "../mock-data";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(AUDIT_LOGS);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredLogs = logs.filter((log) => {
    const matchCategory = categoryFilter === "All" || log.category === categoryFilter;
    const matchSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handleExportLogs = () => {
    triggerToast("Audit trail exported to CSV file successfully.");
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] bg-slate-950 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in fade-in slide-in-from-top-3 max-w-[95vw]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Platform Audit Trail & Security Events
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Immutable Log
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cryptographic trail of super administrator operations, bank approvals, tenant provisioning, and security policy triggers.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportLogs}
          className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors shadow-sm inline-flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export Logs</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by action, target, actor, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
          >
            <option value="All">All Categories</option>
            <option value="Financial">Financial / Bank Transfer</option>
            <option value="Tenant">Tenant Operations</option>
            <option value="Security">Security & Passwords</option>
            <option value="System">System & Infrastructure</option>
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => {
            const isCritical = log.severity === "critical";
            const isWarning = log.severity === "warning";
            const isSuccess = log.severity === "success";

            return (
              <div key={log.id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        log.category === "Financial"
                          ? "bg-emerald-50 text-emerald-700"
                          : log.category === "Security"
                          ? "bg-purple-50 text-purple-700"
                          : log.category === "Tenant"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {log.category}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{log.action}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{log.timestamp}</span>
                    <span>•</span>
                    <span>IP: {log.ipAddress}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {log.details}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Initiated by: <strong className="text-slate-700">{log.actor}</strong></span>
                  </div>
                  <span className="text-slate-400">Target: <strong className="text-slate-700">{log.target}</strong></span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            No audit records match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
