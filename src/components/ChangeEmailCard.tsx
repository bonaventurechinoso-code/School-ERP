"use client";

import React, { useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  X,
  KeyRound,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface ChangeEmailCardProps {
  initialEmail: string;
  brandColor?: string;
  schoolDomain?: string;
  isSuperAdmin?: boolean;
}

export default function ChangeEmailCard({
  initialEmail,
  brandColor = "#4f46e5",
  schoolDomain,
  isSuperAdmin = false,
}: ChangeEmailCardProps) {
  const router = useRouter();

  const [currentEmail, setCurrentEmail] = useState(initialEmail || "");
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"REQUEST" | "CONFIRM" | "SUCCESS">("REQUEST");

  // Step 1 fields
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 fields
  const [otp, setOtp] = useState("");

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const resetForm = () => {
    setIsOpen(false);
    setStep("REQUEST");
    setNewEmail("");
    setCurrentPassword("");
    setOtp("");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const trimmedNew = newEmail.trim().toLowerCase();
    if (!trimmedNew) {
      setErrorMsg("Please enter a new email address.");
      return;
    }
    if (trimmedNew === currentEmail.trim().toLowerCase()) {
      setErrorMsg("The new email address cannot be the same as your current email.");
      return;
    }
    if (!currentPassword) {
      setErrorMsg("Please enter your current password to authorize this change.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/change-email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail: trimmedNew,
          currentPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate email change.");
      }

      setSuccessMsg(data.message || `Verification code sent to ${trimmedNew}`);
      setStep("CONFIRM");
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const trimmedOtp = otp.trim();
    if (trimmedOtp.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/change-email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: trimmedOtp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      setStep("SUCCESS");
      const updatedEmail = data.newEmail || newEmail.trim().toLowerCase();
      setCurrentEmail(updatedEmail);
      setSuccessMsg("Email successfully changed! All sessions have been logged out. Redirecting to login...");

      // Automatically redirect to login page after 2.5 seconds
      setTimeout(() => {
        const loginUrl = schoolDomain && schoolDomain !== "admin" ? `/${schoolDomain}/login` : "/login";
        window.location.href = loginUrl;
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-6">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Mail className="w-4 h-4" />
            <span>Profile & Account Credentials</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            Registered Email Address
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Your official login identifier and institutional notification destination.
          </p>
        </div>

        {!isOpen && (
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 transition cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Change Email</span>
          </button>
        )}
      </div>

      {/* Current Email Display (Read-Only) */}
      {!isOpen && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Current Email (Read-Only)
            </span>
            <div className="font-mono text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{currentEmail || "Loading..."}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                <ShieldCheck className="w-3 h-3" /> Verified Primary
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Protected by dual verification</span>
          </div>
        </div>
      )}

      {/* Expanded Change Email Form */}
      {isOpen && (
        <div className="p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-slate-50/60 dark:bg-zinc-800/30 space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" />
              <span>
                {step === "REQUEST" && "Step 1 of 2: Request Email Change"}
                {step === "CONFIRM" && "Step 2 of 2: Enter Verification Code"}
                {step === "SUCCESS" && "Change Completed"}
              </span>
            </span>
            {step !== "SUCCESS" && (
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Enter New Email + Current Password */}
          {step === "REQUEST" && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Current Email (Read-Only) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
                    Current Email (Active)
                  </label>
                  <input
                    type="email"
                    value={currentEmail}
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 cursor-not-allowed"
                  />
                </div>

                {/* New Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5">
                    New Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter new email address"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5">
                  Authorize with Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative max-w-md">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current account password"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Required to verify your identity. A 6-digit confirmation code will be sent to the new email address.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Enter 6-digit OTP */}
          {step === "CONFIRM" && (
            <form onSubmit={handleConfirmOtp} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 text-xs text-indigo-900 dark:text-indigo-300">
                A 6-digit verification code has been dispatched to <strong>{newEmail}</strong>. Please enter the code below to finalize your new email. (Expires in 15 minutes)
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200 mb-1.5">
                  6-Digit Verification Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-48 px-4 py-2.5 rounded-xl text-center text-xl font-mono font-bold tracking-[8px] border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Caution: 3 failed attempts will temporarily lock email change for 30 minutes.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep("REQUEST");
                    setOtp("");
                    setErrorMsg("");
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  ← Back / Resend Code
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Confirm & Change Email</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: Success */}
          {step === "SUCCESS" && (
            <div className="text-center py-4 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Email Address Successfully Updated!
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                You will be redirected to the login page shortly to sign in with your new email.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
