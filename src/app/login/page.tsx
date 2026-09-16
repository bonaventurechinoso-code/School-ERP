"use client";

import React, { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Building2,
  GraduationCap,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Loader2,
  Layers,
} from "lucide-react";
import { persistStoredSession, AUTH_UPDATE_EVENT } from "@/lib/session-context";
import { customFetch, beginTokenWait, setAuthToken } from "@/lib/api-client";

/**
 * SMART AUTO-ROUTING ASSURANCE:
 * Once authenticated via NextAuth (either via CredentialsProvider or GoogleProvider),
 * this client-side handler queries the active session to resolve the user's authentic
 * institutional tier and Nigerian school role (e.g., Bursar, Principal, Class Teacher, Professor, Student).
 * The user is immediately dispatched to their respective operational tier desk:
 * - Daycare & Nursery Desk
 * - Primary School Desk
 * - Secondary School Desk
 * - Higher Institution / University Desk
 * - Global SaaS Super-Admin Desk
 * 
 * This completely eliminates manual role-selection friction, ensuring a seamless, single-click entry.
 */
function UniversalLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "";
  const urlError = searchParams.get("error");
  const urlMessage = searchParams.get("message");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolDomain, setSchoolDomain] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(
    urlError === "CredentialsSignin"
      ? "Invalid email or password. Please verify your institutional credentials."
      : urlMessage || (urlError ? `Authentication error: ${urlError}` : "")
  );

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      beginTokenWait();
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        schoolDomain: schoolDomain.trim() || undefined,
        redirect: false,
      });

      if (res?.error) {
        setAuthToken(null);
        setErrorMsg("Invalid credentials. Please verify your email and password.");
        setIsSubmitting(false);
      } else if (res?.ok) {
        // SMART AUTO-ROUTING & INSTANT REACTIVE HYDRATION:
        // Query active session to resolve authenticated tenant, role, and operational tier desk
        let sessionPayload: any = null;
        try {
          const v1SessionRes = await customFetch("/api/v1/auth/session");
          if (v1SessionRes.ok) {
            const v1Data = await v1SessionRes.json();
            if (v1Data.authenticated && v1Data.session) {
              sessionPayload = v1Data.session;
            }
          }
        } catch {}

        if (!sessionPayload) {
          const sessionRes = await customFetch("/api/auth/session");
          const sessionData = await sessionRes.json();
          const user = sessionData?.user;
          if (user) {
            sessionPayload = {
              userId: user.id || user.userId,
              email: user.email,
              tenantId: user.tenantId,
              schoolDomain: user.schoolDomain,
              tenantName: user.tenantName,
              role: user.role,
              staffRole: user.staffRole,
              activeTiers: user.activeTiers || [],
              permissions: user.permissions || [],
              sessionToken: user.sessionToken,
            };
          }
        }

        if (sessionPayload) {
          if (sessionPayload.sessionToken) {
            setAuthToken(sessionPayload.token || sessionPayload.sessionToken, sessionPayload.sessionToken);
          }
          persistStoredSession(sessionPayload);
          window.dispatchEvent(new Event(AUTH_UPDATE_EVENT));
        }

        // Invalidate Next.js router cache to ensure server components reflect the newly set session cookie
        router.refresh();

        const user = sessionPayload;
        if (user?.role === "SUPER_ADMIN") {
          router.push("/admin");
        } else if (user?.role === "STUDENT") {
          router.push(`/${user.schoolDomain || schoolDomain || "portal"}/portal/student`);
        } else if (user?.schoolDomain) {
          router.push(`/${user.schoolDomain}/dashboard`);
        } else if (schoolDomain.trim()) {
          router.push(`/${schoolDomain.trim().toLowerCase()}/dashboard`);
        } else if (callbackUrl && !callbackUrl.includes("/login")) {
          router.push(callbackUrl);
        } else {
          router.push("/admin");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsGoogleSubmitting(true);
    setErrorMsg("");
    // Single-click Google OAuth:
    // Server-side signIn callback automatically queries the user's Gmail in our tenant
    // registry, extracts their Nigerian school role, and routes to their respective desk.
    signIn("google", {
      callbackUrl: callbackUrl && !callbackUrl.includes("/login") ? callbackUrl : "/admin",
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex selection:bg-blue-600 selection:text-white">
      {/* ========================================================================= */}
      {/* LEFT PANEL: Modern SaaS Showcase & Institutional Assurance (Desktop)      */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-950 flex-col justify-between p-12 xl:p-16 border-r border-slate-800/80 overflow-hidden">
        {/* Subtle Decorative Ambient Glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center p-1.5 shadow-lg shadow-blue-500/10">
              <Image
                src="/img/business-logo.png"
                alt="School ERP Platform Logo"
                width={36}
                height={36}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-white block">School ERP</span>
              <span className="text-xs font-semibold text-blue-400 tracking-wider uppercase">Unified Multi-Tier Cloud</span>
            </div>
          </div>
        </div>

        {/* Center Presentation: Multi-Tier Operational Desks */}
        <div className="relative z-10 my-auto py-8 space-y-8 max-w-lg">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Institutional Single Sign-On</span>
            </div>
            <h2 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
              One unified portal for every Nigerian academic tier.
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Log in with your Gmail or staff credentials. Our smart routing engine automatically validates your profile and directs you straight to your dedicated tier desk.
            </p>
          </div>

          {/* Supported Operational Desks Badges */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm flex items-start gap-3 transition-all hover:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0 mt-0.5">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Daycare & Nursery</h3>
                <p className="text-[11px] text-slate-400">Developmental skills & care</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm flex items-start gap-3 transition-all hover:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Primary School</h3>
                <p className="text-[11px] text-slate-400">Continuous assessments & grading</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm flex items-start gap-3 transition-all hover:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Secondary School</h3>
                <p className="text-[11px] text-slate-400">WAEC / NECO / JSS & SSS roster</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm flex items-start gap-3 transition-all hover:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Higher Institution</h3>
                <p className="text-[11px] text-slate-400">Semesters, courses & transcripts</p>
              </div>
            </div>
          </div>

          {/* Security Guarantee List */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Strict 30-minute idle database sessions for enhanced fraud prevention</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Role-based access control protecting student records and institutional finances</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-500 flex items-center justify-between border-t border-slate-800/60 pt-4">
          <span>Enterprise Cloud Architecture</span>
          <span>Version 2.4.0 (Secure)</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT PANEL: Clean, High-Quality Login Form Component                     */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-12 xl:p-16">
        <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-300">
          
          {/* Mobile Brand Header */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center p-1 shadow-md">
              <Image
                src="/img/business-logo.png"
                alt="School ERP Logo"
                width={32}
                height={32}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <span className="text-base font-extrabold tracking-tight text-white">School ERP Platform</span>
          </div>

          {/* Form Header */}
          <div className="text-center lg:text-left space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Secure Authentication Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back! Access your institutional dashboard
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Sign in with your registered Gmail account or institutional staff credentials to continue.
            </p>
          </div>

          {/* Alert / Error Banner */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-950/50 border border-rose-900/80 rounded-xl text-rose-300 text-xs text-center font-medium leading-relaxed animate-in fade-in">
              {errorMsg}
            </div>
          )}

          {/* Single-Click Google Authentication */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleSubmitting || isSubmitting}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 cursor-pointer group"
              aria-label="Sign in with Google"
            >
              {isGoogleSubmitting ? (
                <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
              ) : (
                <svg className="w-5 h-5 mr-2 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>{isGoogleSubmitting ? "Connecting to Google..." : "Sign in with Google"}</span>
            </button>
          </div>

          {/* Visual Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-950 px-3 text-slate-500 font-semibold tracking-wider">
                — Or continue with —
              </span>
            </div>
          </div>

          {/* High-Quality Credentials Form */}
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address (Gmail)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. yourname@gmail.com or staff@school.edu.ng"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* School Domain (Optional for Admins/Multi-Tenant) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-subdomain" className="block text-xs font-semibold text-slate-300">
                  School Subdomain
                </label>
                <span className="text-[11px] text-slate-500">Optional for Central Admins</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Building2 className="h-4 w-4" />
                </div>
                <input
                  id="login-subdomain"
                  type="text"
                  autoComplete="organization"
                  value={schoolDomain}
                  onChange={(e) => setSchoolDomain(e.target.value)}
                  placeholder="e.g. greenwood (leave empty if global admin)"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <span className="text-[11px] text-slate-400 hover:text-slate-300 transition-colors">
                  Case sensitive
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between w-full text-xs text-slate-300 mt-2 mb-4">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-200 transition-colors">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-950 transition"
                />
                <span>Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-slate-400 hover:text-blue-400 font-medium transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Prominent Blue Login Button */}
            <button
              type="submit"
              disabled={isSubmitting || isGoogleSubmitting}
              className="w-full mt-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/35 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-60 cursor-pointer"
            >

              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Registration & Student Portal Links */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-400">Need a new school instance?</span>
            <Link
              href="/register"
              className="font-bold text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Security Footnote */}
          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Protected by Server-Controlled PostgreSQL Sessions &amp; OAuth 2.0</span>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function UniversalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">
            Initializing Secure Institutional Portal...
          </span>
        </div>
      }
    >
      <UniversalLoginPageContent />
    </Suspense>
  );
}
