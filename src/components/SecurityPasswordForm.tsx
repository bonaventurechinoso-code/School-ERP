"use client";

import React, { useState } from "react";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Shield, ArrowRight, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

interface SecurityPasswordFormProps {
  schoolDomain?: string;
  isForcedReset?: boolean;
  onSuccess?: () => void;
  brandColor?: string;
  userRole?: string;
  endpoint?: string;
  logoutOnSuccess?: boolean;
}

export default function SecurityPasswordForm({
  schoolDomain,
  isForcedReset = false,
  onSuccess,
  brandColor = "#4f46e5",
  userRole,
  endpoint = "/api/change-password",
  logoutOnSuccess = false,
}: SecurityPasswordFormProps) {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Real-time validation criteria
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isDifferentFromCurrent = !currentPassword || newPassword !== currentPassword;
  const isFormValid = hasMinLength && hasUppercase && hasNumber && hasSpecial && passwordsMatch && isDifferentFromCurrent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!currentPassword) {
      setErrorMsg("Please enter your current password.");
      return;
    }

    if (!hasMinLength) {
      setErrorMsg("New password must be at least 8 characters long.");
      return;
    }

    if (!hasUppercase) {
      setErrorMsg("New password must contain at least 1 uppercase letter.");
      return;
    }

    if (!hasNumber) {
      setErrorMsg("New password must contain at least 1 numeric digit.");
      return;
    }

    if (!hasSpecial) {
      setErrorMsg("New password must contain at least 1 special character (e.g. !@#$%^&*).");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("New password and confirmation password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMsg("New password cannot be the same as your current password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const targetEndpoint = endpoint || "/api/change-password";
      const res = await fetch(targetEndpoint, {
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

      setSuccessMsg(
        logoutOnSuccess
          ? "Password updated successfully! Logging out to ensure your account is protected..."
          : "Your password has been securely updated!"
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (onSuccess) {
        onSuccess();
      }

      if (logoutOnSuccess) {
        setTimeout(async () => {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
          const schoolSlug = schoolDomain || "";
          const callbackUrl = schoolSlug ? `/login?school=${encodeURIComponent(schoolSlug)}` : "/login";
          await signOut({ callbackUrl });
        }, 1500);
        return;
      }

      // If forced reset, automatically redirect after a brief notice
      if (isForcedReset && schoolDomain) {
        setTimeout(() => {
          const canonical = (data.role || userRole || "").toUpperCase();
          if (canonical === "STUDENT") {
            router.push(`/${schoolDomain}/portal/student`);
          } else if (canonical === "STAFF" || canonical === "TEACHER" || canonical.includes("TEACHER")) {
            router.push(`/${schoolDomain}/portal/staff`);
          } else if (canonical === "BURSAR" || canonical.includes("BURSAR")) {
            router.push(`/bursar`);
          } else {
            router.push(`/${schoolDomain}/dashboard`);
          }
          router.refresh();
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-zinc-800">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
          style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
        >
          <KeyRound className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Security & Password Settings
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            {isForcedReset
              ? "Your account is currently using an initial temporary password. You must save a new confidential password before accessing the platform."
              : "Update your institutional password regularly to protect sensitive student and administrative records."}
          </p>
        </div>
      </div>

      {isForcedReset && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3 text-amber-800 dark:text-amber-300 text-xs sm:text-sm leading-relaxed">
          <Shield className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Forced Security Reset Active</span>
            Default or auto-generated onboarding passwords cannot be retained for active workspace access. Please set your permanent confidential password below.
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-3 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-3 text-emerald-700 dark:text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Current Password Field */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-2">
            Current Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showCurrent ? "text" : "password"}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current or temporary password"
              className="w-full pl-10 pr-11 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-xs"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
              aria-label={showCurrent ? "Hide current password" : "Show current password"}
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New Password Field */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-2">
            New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showNew ? "text" : "password"}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters (letters & numbers)"
              className="w-full pl-10 pr-11 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-xs"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
              aria-label={showNew ? "Hide new password" : "Show new password"}
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm New Password Field */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-2">
            Confirm New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showConfirm ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your new password"
              className="w-full pl-10 pr-11 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-xs"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
              aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Validation Checklist */}
        <div className="p-3.5 bg-slate-50 dark:bg-zinc-950/60 rounded-xl border border-slate-100 dark:border-zinc-800/80 space-y-2 text-xs">
          <span className="font-semibold text-slate-600 dark:text-zinc-400 block mb-1">
            Enterprise Password Rules:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className={`flex items-center gap-2 ${hasMinLength ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"}`}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? "stroke-[2.5]" : "opacity-40"}`} />
              <span>At least 8 characters</span>
            </div>
            <div className={`flex items-center gap-2 ${hasUppercase ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"}`}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${hasUppercase ? "stroke-[2.5]" : "opacity-40"}`} />
              <span>1 uppercase letter (A-Z)</span>
            </div>
            <div className={`flex items-center gap-2 ${hasNumber ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"}`}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${hasNumber ? "stroke-[2.5]" : "opacity-40"}`} />
              <span>1 numeric digit (0-9)</span>
            </div>
            <div className={`flex items-center gap-2 ${hasSpecial ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"}`}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${hasSpecial ? "stroke-[2.5]" : "opacity-40"}`} />
              <span>1 special character (!@#$)</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordsMatch ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"}`}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${passwordsMatch ? "stroke-[2.5]" : "opacity-40"}`} />
              <span>Passwords match</span>
            </div>
            <div className={`flex items-center gap-2 ${isDifferentFromCurrent ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"}`}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${isDifferentFromCurrent ? "stroke-[2.5]" : "opacity-40"}`} />
              <span>Different from current</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !isFormValid}
          className="w-full sm:w-auto px-6 py-2.5 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: brandColor }}
        >
          {isSubmitting ? "Encrypting & Saving..." : "Update Password"}
          {!isSubmitting && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
