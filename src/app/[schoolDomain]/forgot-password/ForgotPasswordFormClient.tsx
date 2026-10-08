"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, KeyRound, Building2 } from "lucide-react";
import { customFetch } from "@/lib/api-client";

interface ForgotPasswordFormClientProps {
  schoolName: string;
  schoolDomain: string;
  brandColor?: string;
  schoolLogo?: string;
}

export default function ForgotPasswordFormClient({
  schoolName,
  schoolDomain,
  brandColor = "#3b82f6",
  schoolLogo,
}: ForgotPasswordFormClientProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setErrorMsg("Please provide your registered institutional email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await customFetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          schoolDomain,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any = {};
      if (contentType.includes("application/json")) {
        data = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch recovery link.");
      }

      setSubmittedEmail(trimmed);
      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-indigo-100">
      {/* Background Architectural Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-slate-300/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center p-1.5 overflow-hidden">
            <Image
              src="/img/business-logo.png"
              alt="SchoolERP Logo"
              width={32}
              height={32}
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              SchoolERP
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/60 border border-slate-300/40">
              ENTERPRISE CLOUD
            </span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xl p-6 sm:p-8 md:p-10 animate-in fade-in zoom-in-95 duration-300">
          {/* Header Info */}
          <div className="text-center mb-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center mb-4 text-slate-800 shadow-xs">
              <KeyRound className="w-7 h-7 text-indigo-900" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Forgot Password
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600">
                {schoolName} <span className="font-mono text-slate-400">({schoolDomain})</span>
              </p>
            </div>
          </div>

          {/* User Error Toast / Banner */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200/90 rounded-2xl text-rose-800 text-xs font-medium flex items-start gap-3 animate-in fade-in duration-200 shadow-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-bold block text-rose-900">Recovery Error</span>
                {errorMsg}
              </div>
            </div>
          )}

          {isSubmitted ? (
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <div className="p-6 bg-slate-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-300">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Recovery Instructions Sent</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  If an account associated with <strong className="text-slate-900 font-semibold">{submittedEmail}</strong> is enrolled at <strong className="text-slate-900">{schoolName}</strong>, a secure password recovery link has been dispatched.
                </p>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium">
                  The recovery link is valid for a maximum of 1 hour. Please check your inbox and spam folder.
                </div>
              </div>

              <Link
                href={`/${schoolDomain}/login`}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-[#0B132B] hover:bg-[#152244] transition-all shadow-md"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to School Login</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-xs text-slate-600 leading-relaxed">
                Enter your registered institutional email address. We will verify your tenant credentials and transmit a secure, single-use recovery link.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Institutional Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. staff@institution.edu or student@institution.edu"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/30 focus:border-indigo-600 transition-all text-sm shadow-2xs font-medium"
                  />
                </div>
              </div>

              {/* Clean Dark Navy Primary Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 text-white rounded-xl font-bold text-sm bg-[#0B132B] hover:bg-[#152244] active:scale-[0.99] transition-all shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Tenant & Dispatching...</span>
                  </>
                ) : (
                  <>
                    <span>Send Recovery Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2 border-t border-slate-100">
                <Link
                  href={`/${schoolDomain}/login`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to School Login</span>
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Footer Subtext */}
        <p className="text-center text-[11px] text-slate-500 mt-6 font-medium">
          Protected by SchoolERP Zero-Trust Tenant Isolation Architecture
        </p>
      </div>
    </div>
  );
}
