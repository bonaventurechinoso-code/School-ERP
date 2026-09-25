"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, ShieldCheck, KeyRound, Loader2 } from "lucide-react";

interface ResetPasswordClientProps {
  schoolName: string;
  schoolDomain: string;
  brandColor?: string;
  initialToken?: string;
}

export default function ResetPasswordClient({
  schoolName,
  schoolDomain,
  brandColor = "#3b82f6",
  initialToken = "",
}: ResetPasswordClientProps) {
  const router = useRouter();

  const [token, setToken] = useState(initialToken);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate token on component mount
  useEffect(() => {
    let resolvedToken = token;
    if (!resolvedToken && typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      resolvedToken = urlParams.get("token") || "";
      setToken(resolvedToken);
    }

    if (!resolvedToken) {
      setTokenError("Missing recovery token. Please request a new password reset link.");
      setIsValidatingToken(false);
      return;
    }

    async function checkToken() {
      try {
        const res = await fetch("/api/v1/auth/verify-reset-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resolvedToken, schoolDomain }),
        });
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setTokenError(data.error || "This recovery link is invalid or has expired.");
        } else {
          setRecipientEmail(data.email || "");
        }
      } catch {
        setTokenError("Could not verify recovery token. Please try again.");
      } finally {
        setIsValidatingToken(false);
      }
    }

    checkToken();
  }, [token, schoolDomain]);

  // Validation rules
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = hasMinLength && hasUppercase && hasNumber && hasSpecial && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!hasMinLength) {
      setFormError("New password must be at least 8 characters long.");
      return;
    }

    if (!hasUppercase) {
      setFormError("New password must contain at least 1 uppercase letter.");
      return;
    }

    if (!hasNumber) {
      setFormError("New password must contain at least 1 numeric digit.");
      return;
    }

    if (!hasSpecial) {
      setFormError("New password must contain at least 1 special character (e.g. !@#$%^&*).");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("New password and confirmation password do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }

      setIsSuccess(true);
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-4 selection:bg-blue-900">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Image
              src="/img/business-logo.png"
              alt="School ERP"
              width={28}
              height={28}
              className="w-7 h-7 rounded-lg object-contain"
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              School ERP Platform
            </span>
          </div>
          <div
            className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
            style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
          >
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Set New Password</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">
            Account recovery for {schoolName}
          </p>
        </div>

        {isValidatingToken ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Validating your recovery token...</p>
          </div>
        ) : tokenError ? (
          <div className="space-y-6 text-center animate-in fade-in duration-300">
            <div className="p-6 bg-red-950/40 border border-red-900/60 rounded-2xl space-y-3">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <h2 className="text-base font-bold text-white">Recovery Link Expired or Invalid</h2>
              <p className="text-xs text-red-300/90 leading-relaxed">
                {tokenError}
              </p>
            </div>

            <Link
              href={`/${schoolDomain}/forgot-password`}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white transition-all shadow-md"
              style={{ backgroundColor: brandColor }}
            >
              <KeyRound className="w-4 h-4" />
              <span>Request New Recovery Link</span>
            </Link>

            <div>
              <Link
                href={`/${schoolDomain}/login`}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Login</span>
              </Link>
            </div>
          </div>
        ) : isSuccess ? (
          <div className="space-y-6 text-center animate-in fade-in duration-300">
            <div className="p-6 bg-slate-950 border border-emerald-900/60 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-950/80 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-800">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-white">Password Successfully Reset</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your new confidential password has been encrypted and saved. You can now use your updated credentials to access {schoolName}.
              </p>
            </div>

            <Link
              href={`/${schoolDomain}/login`}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm text-white transition-all shadow-md"
              style={{ backgroundColor: brandColor }}
            >
              <span>Proceed to Login</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {recipientEmail && (
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-400 text-center">
                Updating credentials for: <span className="text-white font-medium">{recipientEmail}</span>
              </div>
            )}

            {formError && (
              <div className="p-3.5 bg-red-950/50 border border-red-900 rounded-xl text-red-400 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showNew ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-inner text-sm"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-inner text-sm"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Validation Checklist */}
            <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5 text-[11px]">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-400" : "text-slate-500"}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? "" : "opacity-40"}`} />
                <span>At least 8 characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasUppercase ? "text-emerald-400" : "text-slate-500"}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${hasUppercase ? "" : "opacity-40"}`} />
                <span>At least 1 uppercase letter</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-400" : "text-slate-500"}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${hasNumber ? "" : "opacity-40"}`} />
                <span>At least 1 numeric digit</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasSpecial ? "text-emerald-400" : "text-slate-500"}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${hasSpecial ? "" : "opacity-40"}`} />
                <span>At least 1 special character (!@#$%^&*)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordsMatch ? "text-emerald-400" : "text-slate-500"}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${passwordsMatch ? "" : "opacity-40"}`} />
                <span>Passwords match</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: brandColor }}
            >
              {isSubmitting ? "Encrypting & Resetting..." : "Save New Password"}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
