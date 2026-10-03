"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, KeyRound, Building2, Loader2 } from "lucide-react";
import { customFetch } from "@/lib/api-client";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check search params first
    const querySchool =
      searchParams.get("school") ||
      searchParams.get("schoolDomain") ||
      searchParams.get("tenant") ||
      searchParams.get("mockTenant");

    if (querySchool) {
      setSchoolCode(querySchool.toLowerCase().trim());
      return;
    }

    // Check persistent PWA storage
    try {
      const stored =
        window.localStorage.getItem("schoolerp_tenant") ||
        window.localStorage.getItem("schoolDomain") ||
        window.localStorage.getItem("schoolerp_school_domain");
      if (stored) {
        setSchoolCode(stored.toLowerCase().trim());
      }
    } catch {}
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedSchool = schoolCode.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMsg("Please provide your registered institutional email address.");
      return;
    }

    if (!trimmedSchool) {
      setErrorMsg("Please enter your institution's School Code (e.g., greenwood).");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await customFetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          schoolDomain: trimmedSchool,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any = {};
      if (contentType.includes("application/json")) {
        data = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate password recovery.");
      }

      setSubmittedEmail(trimmedEmail);
      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected network error occurred while connecting to the server.");
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
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm bg-blue-500/20 text-blue-400">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Forgot Password</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">
            Account recovery for Students, Staff, and Parents
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-900 rounded-xl text-red-400 text-sm text-center font-medium flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isSubmitted ? (
          <div className="space-y-6 text-center animate-in fade-in duration-300">
            <div className="p-6 bg-slate-950 border border-emerald-900/60 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-950/80 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-800">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-white">Recovery Link Dispatched</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                If an account associated with <span className="text-white font-medium">{submittedEmail}</span> is registered with {schoolCode}, a password reset link has been dispatched.
              </p>
              <p className="text-[11px] text-slate-500">
                The recovery link is strictly valid for 15 minutes. Please check your inbox and spam folder.
              </p>
            </div>

            <Link
              href={schoolCode ? `/${schoolCode}/login` : "/login"}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Login</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-xs text-slate-400 leading-relaxed">
              Enter your registered institutional email address and school code to receive a secure, time-limited recovery link.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                School Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Building2 className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toLowerCase())}
                  placeholder="e.g. greenwood"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-inner text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Institutional Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@school.edu or parent@email.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-inner text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 text-white bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying & Sending...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Login</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function UniversalForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-500" />
          <span className="text-xs">Loading recovery console...</span>
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
