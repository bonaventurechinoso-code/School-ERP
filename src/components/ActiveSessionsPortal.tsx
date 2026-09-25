"use client";

import React, { useState, useEffect } from "react";
import { Laptop, Smartphone, Globe, Shield, Trash2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface DeviceSession {
  id: string;
  type: string;
  ipAddress: string;
  userAgent: string;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export default function ActiveSessionsPortal({ brandColor = "#4f46e5" }: { brandColor?: string }) {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchSessions = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/me/sessions");
      if (!res.ok) {
        throw new Error("Failed to load active device sessions.");
      }
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not retrieve sessions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/me/sessions?id=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke session.");
      }
      setSuccessMsg("Session revoked successfully.");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      setErrorMsg(err.message || "Could not revoke session.");
    } finally {
      setRevokingId(null);
    }
  };

  const getDeviceIcon = (ua: string) => {
    const lower = ua.toLowerCase();
    if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
      return <Smartphone className="w-5 h-5" />;
    }
    return <Laptop className="w-5 h-5" />;
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-zinc-800 mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
            style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
          >
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Active Device Sessions
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Manage and selectively revoke active browser sessions across authorized devices.
            </p>
          </div>
        </div>

        <button
          onClick={fetchSessions}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          title="Refresh active sessions"
          aria-label="Refresh active sessions"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2.5 text-red-700 dark:text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading && sessions.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          Loading authorized sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          No other active device sessions detected.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                sess.isCurrent
                  ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50"
                  : "bg-slate-50/60 dark:bg-zinc-950/60 border-slate-200/80 dark:border-zinc-800"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-slate-600 dark:text-zinc-300 mt-0.5">
                  {getDeviceIcon(sess.userAgent)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-slate-900 dark:text-zinc-100 font-mono">
                      {sess.ipAddress}
                    </span>
                    {sess.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                        Current Session
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-1 max-w-md">
                    {sess.userAgent}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                    Last active: {new Date(sess.lastActiveAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {!sess.isCurrent && (
                <button
                  onClick={() => handleRevoke(sess.id)}
                  disabled={revokingId === sess.id}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900/50 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{revokingId === sess.id ? "Revoking..." : "Revoke"}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
