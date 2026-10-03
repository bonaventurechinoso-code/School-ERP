"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Building2, KeyRound } from "lucide-react";

import { customFetch } from "@/lib/api-client";

interface ForgotPasswordFormClientProps {
  schoolName: string;
  schoolDomain: string;
  brandColor?: string;
}

export default function ForgotPasswordFormClient({
  schoolName,
  schoolDomain,
  brandColor = "#3b82f6",
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
      setErrorMsg("Please provide your institutional email address.");
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
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Forgot Password</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">
            Account recovery for {schoolName}
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
              <h2 className="text-base font-bold text-white">Recovery Email Dispatched</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                If an account associated with <span className="text-white font-medium">{submittedEmail}</span> is registered with {schoolName}, you will receive a password reset link within a few moments.
              </p>
              <p className="text-[11px] text-slate-500">
                The recovery link is strictly valid for 15 minutes. Be sure to check your spam/junk folder.
              </p>
            </div>

            <Link
              href={`/${schoolDomain}/login`}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white transition-all shadow-md"
              style={{ backgroundColor: brandColor }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to School Login</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <p className="text-xs text-slate-400 leading-relaxed">
              Enter your registered institutional email address. We will verify your account and transmit a secure, time-limited password recovery link.
            </p>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@school.edu or student@school.edu"
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-inner text-sm"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl disabled:opacity-70"
              style={{ backgroundColor: brandColor }}
            >
              {isSubmitting ? "Verifying & Sending..." : "Send Reset Link"}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>

            <div className="text-center pt-2">
              <Link
                href={`/${schoolDomain}/login`}
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
