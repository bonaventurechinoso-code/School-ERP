"use client";

import React, { useState, useEffect } from "react";
import ChangeEmailCard from "@/components/ChangeEmailCard";
import ActiveSessionsPortal from "@/components/ActiveSessionsPortal";
import {
  User,
  ShieldCheck,
  Lock,
  KeyRound,
  Mail,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Server,
  Layers,
  Clock,
  UserCheck,
} from "lucide-react";

export default function SuperAdminProfilePage() {
  const [activeTab, setActiveTab] = useState<"details" | "security" | "email">("details");

  // Profile Details State
  const [displayName, setDisplayName] = useState("Super Administrator");
  const [adminEmail, setAdminEmail] = useState("bonaventure.chinoso@gmail.com");
  const [createdAt, setCreatedAt] = useState<string>("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState("");
  const [detailsError, setDetailsError] = useState("");

  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Listen to URL hash for deep linking (e.g., #security or #email)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes("security") || hash.includes("sessions")) {
        setActiveTab("security");
      } else if (hash.includes("email")) {
        setActiveTab("email");
      } else {
        setActiveTab("details");
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Fetch Authoritative Super Admin Profile from Root Gateway
  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/admin/profile");
      if (res.ok) {
        const data = await res.json();
        if (data?.profile) {
          if (data.profile.email) setAdminEmail(data.profile.email);
          if (data.profile.displayName) setDisplayName(data.profile.displayName);
          if (data.profile.createdAt) setCreatedAt(new Date(data.profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
          setTwoFactorEnabled(Boolean(data.profile.twoFactorEnabled));
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Update Display Name
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsError("");
    setDetailsSuccess("");

    const trimmed = displayName.trim();
    if (!trimmed) {
      setDetailsError("Display name cannot be empty.");
      return;
    }

    setIsSavingDetails(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile details.");
      }
      setDetailsSuccess("Super-Admin profile details updated successfully!");
      if (data.displayName) setDisplayName(data.displayName);
    } catch (err: any) {
      setDetailsError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSavingDetails(false);
    }
  };

  // Update Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword) {
      setPasswordError("Both current password and new password are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password cannot be the same as your current password.");
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          oldPassword: currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password.");
      }
      setPasswordSuccess("Super-Admin password updated successfully! Other sessions synchronized.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "SA";

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
              Root Console Authority
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Personal Credentials & Protection
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Super-Admin Account Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Manage your personal administrative identity, cryptographic credentials, active device sessions, and root recovery email.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setActiveTab("details");
            window.location.hash = "details";
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "details"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile Details</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("security");
            window.location.hash = "security";
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "security"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Security Center & Sessions</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("email");
            window.location.hash = "email";
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "email"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Update Root Email</span>
        </button>
      </div>

      {/* TAB 1: PROFILE DETAILS */}
      {activeTab === "details" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Identity Telemetry Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Root Authority
              </div>
              <div className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">
                SUPER_ADMIN
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Zero-tenant boundary • Full platform bypass
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Primary Identifier
              </div>
              <div className="font-mono text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {adminEmail}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Authoritative platform login destination
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Initialized On
              </div>
              <div className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">
                {createdAt || "Active SaaS Core"}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                NIST SP 800-63B standard compliant
              </p>
            </div>
          </div>

          {/* Profile Form Card */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Super-Admin Identity Details
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Update your formal administrative name as rendered on audit trails and platform logs.
                </p>
              </div>
            </div>

            {/* Notification messages */}
            {detailsError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{detailsError}</span>
              </div>
            )}
            {detailsSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{detailsSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveDetails} className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-700/80">
                {/* Monogram Avatar Preview */}
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-indigo-900 text-white font-black text-xl flex items-center justify-center shadow-md select-none shrink-0">
                  <span>{initials}</span>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Primary System Avatar
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Dynamically rendered across the platform dashboard top-bar and command breadcrumbs.
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                    <Sparkles className="w-3 h-3" /> Root Platform Tier
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5">
                    Admin Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Super Administrator"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                    Rendered in system audit events and administrative sign-offs.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
                    Root Email Identifier (Read-Only)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={adminEmail}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                    To modify this root address, use the <strong>Update Root Email</strong> tab.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingDetails}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer"
                >
                  {isSavingDetails ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Details...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Profile Details</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY CENTER & SESSIONS */}
      {activeTab === "security" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Password Update Card */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Super-Admin Password Upgrade
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Update your master credentials using 12 computation rounds of BCrypt encryption with automatic session revocation.
                </p>
              </div>
            </div>

            {passwordError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter existing password"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white pr-10 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5">
                    New Master Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white pr-10 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white pr-10 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer"
                >
                  {isSubmittingPassword ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Credentials...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Commit Password Change</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Active Sessions Portal (Device Management) */}
          <div id="sessions">
            <ActiveSessionsPortal brandColor="#4f46e5" />
          </div>
        </div>
      )}

      {/* TAB 3: UPDATE ROOT EMAIL */}
      {activeTab === "email" && (
        <div className="space-y-6 animate-in fade-in duration-150" id="email">
          <ChangeEmailCard initialEmail={adminEmail} isSuperAdmin={true} />
        </div>
      )}
    </div>
  );
}
