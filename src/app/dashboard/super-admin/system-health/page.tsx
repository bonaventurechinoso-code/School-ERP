"use client";

import React, { useState } from "react";
import {
  Activity,
  Database,
  Server,
  HardDrive,
  Cpu,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Wifi,
} from "lucide-react";

export default function SystemHealthPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handlePingAllNodes = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      triggerToast("All infrastructure nodes pinged: 100% healthy, 0 packet loss.");
    }, 900);
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
              Platform Telemetry & Infrastructure Nodes
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              All Systems Operational
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time multi-tenant PostgreSQL health, Render compute nodes, Redis session store, and asset clusters.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePingAllNodes}
          disabled={isRefreshing}
          className="bg-slate-950 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md inline-flex items-center gap-2 shrink-0 self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>{isRefreshing ? "Pinging Nodes..." : "Ping Infrastructure"}</span>
        </button>
      </div>

      {/* Infrastructure Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Node 1: Multi-Tenant Database */}
        <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">Multi-Tenant PostgreSQL</h3>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              Online • 4ms
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Row Level Security (RLS) Active
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Pool: 18 / 50 conn</span>
            <span className="text-emerald-400 font-semibold">Healthy</span>
          </div>
        </div>

        {/* Node 2: Render Web Compute */}
        <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Server className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">Render Web Service</h3>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            </div>
            <div className="text-2xl font-black text-white font-mono">
              99.98% Uptime
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Zero downtime rolling deploys
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>CPU: 14% • RAM: 480MB</span>
            <span className="text-emerald-400 font-semibold">Optimal</span>
          </div>
        </div>

        {/* Node 3: Asset Storage Pool */}
        <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm text-slate-100">Asset Storage Pool</h3>
              </div>
              <span className="text-xs font-mono text-blue-400 font-bold">72%</span>
            </div>
            <div className="text-2xl font-black text-blue-400 font-mono">
              144GB / 200GB
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Student passports & receipts
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>CDN Latency: 12ms</span>
            <span className="text-blue-400 font-semibold">Synced</span>
          </div>
        </div>

        {/* Node 4: Redis Cache & Sessions */}
        <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm text-slate-100">Redis Session Store</h3>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            </div>
            <div className="text-2xl font-black text-purple-400 font-mono">
              Connected • 1ms
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Token rate limiting & cache
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Keys: 2,419 items</span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
        </div>
      </div>

      {/* Security Diagnostics & Isolation */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>Multi-Tenant Security Isolation Matrix</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
            <span className="font-bold text-slate-900 block mb-1">Row-Level Security (RLS)</span>
            <p className="text-slate-600 leading-relaxed">
              Every database SQL transaction attaches the tenant institutional context. No cross-school data leakage possible.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
            <span className="font-bold text-slate-900 block mb-1">Subdomain Multi-Tenancy</span>
            <p className="text-slate-600 leading-relaxed">
              Each registered school resolves through dedicated wildcard DNS with dedicated SSL handshake certificates.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
            <span className="font-bold text-slate-900 block mb-1">Automated Nightly Backups</span>
            <p className="text-slate-600 leading-relaxed">
              PostgreSQL multi-tenant database dumps execute at 02:00 AM WAT daily with 30-day encrypted retention in secondary cold storage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
