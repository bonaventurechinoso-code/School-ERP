"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Building2,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { persistStoredSession, AUTH_UPDATE_EVENT } from "@/lib/session-context";
import { customFetch, beginTokenWait, setAuthToken } from "@/lib/api-client";

type RoleTab = "admin" | "teacher" | "student" | "parent";

interface RoleTabConfig {
  id: RoleTab;
  label: string;
  placeholder: string;
  fieldLabel: string;
}

const ROLE_CONFIGS: RoleTabConfig[] = [
  {
    id: "admin",
    label: "School Admin",
    placeholder: "admin@school.com",
    fieldLabel: "Email Address",
  },
  {
    id: "teacher",
    label: "Teacher",
    placeholder: "Staff ID or Email",
    fieldLabel: "Staff ID or Email",
  },
  {
    id: "student",
    label: "Student",
    placeholder: "Admission No (e.g. ADA-0143)",
    fieldLabel: "Admission Number",
  },
  {
    id: "parent",
    label: "Parent",
    placeholder: "Parent Phone or Email",
    fieldLabel: "Parent Phone or Email",
  },
];

function formatTenantDisplayName(subdomain: string | null): string {
  if (!subdomain) return "SchoolERP";
  return subdomain
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function EducationalIllustration() {
  return (
    <div className="w-full max-w-[280px] mx-auto opacity-80 select-none">
      <svg
        viewBox="0 0 320 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto text-zinc-300 dark:text-zinc-700 stroke-current"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Subtle decorative ground plane */}
        <line x1="20" y1="175" x2="300" y2="175" strokeDasharray="3 3" />
        
        {/* Central School Building Structure */}
        <rect x="90" y="70" width="140" height="105" rx="4" className="fill-zinc-100/60 dark:fill-zinc-800/40" />
        {/* Roof Gable */}
        <polygon points="160,35 75,70 245,70" className="fill-zinc-200/50 dark:fill-zinc-800/60" />
        {/* Central Bell / Cupola Tower */}
        <rect x="145" y="15" width="30" height="20" rx="2" className="fill-zinc-200/50 dark:fill-zinc-800/60" />
        <polygon points="160,2 140,15 180,15" className="fill-zinc-300/60 dark:fill-zinc-700/60" />
        <circle cx="160" cy="25" r="4" className="fill-zinc-400 dark:fill-zinc-600" />
        
        {/* School Columns & Door */}
        <rect x="146" y="130" width="28" height="45" rx="2" className="fill-zinc-200 dark:fill-zinc-800" />
        <path d="M146 130 Q160 118 174 130" />
        
        {/* Windows */}
        <rect x="108" y="90" width="22" height="26" rx="2" className="fill-zinc-50 dark:fill-zinc-900" />
        <line x1="119" y1="90" x2="119" y2="116" />
        <line x1="108" y1="103" x2="130" y2="103" />

        <rect x="190" y="90" width="22" height="26" rx="2" className="fill-zinc-50 dark:fill-zinc-900" />
        <line x1="201" y1="90" x2="201" y2="116" />
        <line x1="190" y1="103" x2="212" y2="103" />

        <rect x="108" y="135" width="22" height="26" rx="2" className="fill-zinc-50 dark:fill-zinc-900" />
        <rect x="190" y="135" width="22" height="26" rx="2" className="fill-zinc-50 dark:fill-zinc-900" />

        {/* Graduation Cap Motif on Left */}
        <g transform="translate(35, 105)">
          <path d="M5 25 L35 12 L65 25 L35 38 Z" className="fill-zinc-200/80 dark:fill-zinc-800/80" />
          <path d="M20 33 V44 C20 50 50 50 50 44 V33" />
          <path d="M60 27 V45" />
          <circle cx="60" cy="46" r="2" className="fill-zinc-400 dark:fill-zinc-500" />
        </g>

        {/* Open Book Motif on Right */}
        <g transform="translate(225, 115)">
          <path d="M5 40 Q25 35 45 42 Q65 35 85 40 V15 Q65 10 45 17 Q25 10 5 15 Z" className="fill-zinc-200/80 dark:fill-zinc-800/80" />
          <line x1="45" y1="17" x2="45" y2="42" />
          <line x1="15" y1="23" x2="35" y2="25" />
          <line x1="15" y1="30" x2="35" y2="32" />
          <line x1="55" y1="25" x2="75" y2="23" />
          <line x1="55" y1="32" x2="75" y2="30" />
        </g>
      </svg>
    </div>
  );
}

function UniversalLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "";
  const urlError = searchParams.get("error");
  const urlMessage = searchParams.get("message");

  // State Management
  const [activeRoleTab, setActiveRoleTab] = useState<RoleTab>("admin");
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [resolvedTenant, setResolvedTenant] = useState<string | null>(null);
  const [schoolCodeInput, setSchoolCodeInput] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>(
    urlError === "CredentialsSignin"
      ? "Invalid credentials. Please verify your details."
      : urlMessage || (urlError ? `Authentication error: ${urlError}` : "")
  );

  // Client-Side Tenancy Resolution
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Rule 1: Check query parameters first (?school=..., ?schoolDomain=..., ?mockTenant=...)
    const params = new URLSearchParams(window.location.search);
    const querySchool =
      params.get("school") ||
      params.get("schoolDomain") ||
      params.get("tenant") ||
      params.get("mockTenant");

    if (querySchool && querySchool.trim()) {
      const clean = querySchool.trim().toLowerCase();
      setResolvedTenant(clean);
      return;
    }

    // Rule 1: Parse hostname for tenant subdomain
    const hostname = window.location.hostname.toLowerCase();
    const parts = hostname.split(".");

    // Localhost subdomain: e.g. greenwood.localhost
    if (parts.length === 2 && parts[1] === "localhost" && parts[0] !== "localhost") {
      setResolvedTenant(parts[0]);
      return;
    }

    // Production domain subdomain: e.g. greenwood.schoolerp.ng
    if (parts.length > 2) {
      const candidate = parts[0];
      if (candidate !== "www" && candidate !== "app" && candidate !== "mail" && candidate !== "api") {
        setResolvedTenant(candidate);
        return;
      }
    }

    // Rule 2: Root domain with no query parameters
    setResolvedTenant(null);
  }, [searchParams]);

  const currentRole = ROLE_CONFIGS.find((r) => r.id === activeRoleTab) || ROLE_CONFIGS[0];

  const handleCredentialsLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    const targetDomain = (resolvedTenant || schoolCodeInput).trim().toLowerCase();

    try {
      beginTokenWait();
      const res = await signIn("credentials", {
        email: identifier.trim().toLowerCase(),
        password,
        schoolDomain: targetDomain || undefined,
        redirect: false,
      });

      if (res?.error) {
        setAuthToken(null);
        setErrorMsg("Invalid credentials. Please verify your details and password.");
        setIsSubmitting(false);
      } else if (res?.ok) {
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

        router.refresh();

        const user = sessionPayload;
        const canonicalRole = (user?.role || "").toUpperCase();
        const staffRoleStr = (user?.staffRole || "").toUpperCase();
        const isBursarRole =
          canonicalRole === "BURSAR" ||
          canonicalRole === "ACCOUNTANT" ||
          staffRoleStr.includes("BURSAR") ||
          staffRoleStr.includes("ACCOUNTANT") ||
          staffRoleStr.includes("CASHIER") ||
          staffRoleStr.includes("FINANCE");

        if (user?.role === "SUPER_ADMIN") {
          router.push("/admin");
        } else if (user?.role === "STUDENT") {
          router.push(`/${user.schoolDomain || targetDomain || "portal"}/portal/student`);
        } else if (isBursarRole) {
          router.push("/bursar");
        } else if (user?.schoolDomain) {
          router.push(`/${user.schoolDomain}/dashboard`);
        } else if (targetDomain) {
          router.push(`/${targetDomain}/dashboard`);
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

  const platformOrSchoolName = formatTenantDisplayName(resolvedTenant);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col lg:flex-row text-zinc-900 dark:text-zinc-100">
      {/* ========================================================================= */}
      {/* 2. LEFT SIDEBAR (40% Width) - BRANDING & VISUALS                          */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex lg:w-[40%] flex-col justify-between p-10 xl:p-14 bg-zinc-100/70 dark:bg-zinc-900/40 border-r border-zinc-200 dark:border-zinc-800">
        {/* Top: School / Platform Logo container */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center p-2 shadow-sm">
            <Image
              src="/img/business-logo.png"
              alt="SchoolERP Logo"
              width={28}
              height={28}
              className="h-full w-full object-contain"
            />
          </div>
          <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
            {platformOrSchoolName}
          </span>
        </div>

        {/* Middle: Platform/School Name & Subtitle */}
        <div className="space-y-2 py-12">
          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            {platformOrSchoolName}
          </h1>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            School Management System
          </p>
        </div>

        {/* Bottom: Clean, Minimal Educational Illustration */}
        <div className="pt-6">
          <EducationalIllustration />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. RIGHT SIDEBAR (60% Width) - AUTONOMOUS AUTHENTICATION FORM             */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[60%] flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
          
          {/* Mobile Header (Shown on mobile screens when Left Sidebar is hidden) */}
          <div className="lg:hidden flex items-center gap-2.5 pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center p-1.5 shadow-sm">
              <Image
                src="/img/business-logo.png"
                alt="SchoolERP Logo"
                width={20}
                height={20}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 block">
                {platformOrSchoolName}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block -mt-0.5">
                School Management System
              </span>
            </div>
          </div>

          {/* Form Header */}
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Sign In
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {resolvedTenant
                ? `Enter your credentials for ${platformOrSchoolName}`
                : "Select your role and enter your institutional credentials"}
            </p>
          </div>

          {/* Error Alert Banner */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* 3.C Role Selector Tabs (shadcn/ui style Tab bar) */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 select-none">
            {ROLE_CONFIGS.map((tab) => {
              const isActive = activeRoleTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveRoleTab(tab.id);
                    setErrorMsg("");
                  }}
                  className={`py-1.5 px-2 rounded-md transition-all text-center truncate ${
                    isActive
                      ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-sm font-semibold"
                      : "hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* 3.D Core Form Controls */}
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            
            {/* 1. Identifier Input (Email / Staff ID / Admission No / Phone) */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-identifier"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                {currentRole.fieldLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  {activeRoleTab === "student" ? (
                    <GraduationCap className="h-4 w-4" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                </div>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIdentifier(e.target.value)}
                  placeholder={currentRole.placeholder}
                  className="flex h-10 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 transition-colors"
                />
              </div>
            </div>

            {/* 2. Password Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="flex h-10 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-9 pr-10 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 3. Optional School Code Input (Shown only when NOT on a tenant subdomain/query param) */}
            {!resolvedTenant && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-school-code"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    School Code
                  </label>
                  <span className="text-[11px] text-zinc-400">Optional for Central Admins</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    id="login-school-code"
                    type="text"
                    autoComplete="organization"
                    value={schoolCodeInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSchoolCodeInput(e.target.value.toLowerCase())
                    }
                    placeholder="e.g. greenwood"
                    className="flex h-10 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* 4. Form Footer Row: Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-zinc-950 dark:focus:ring-zinc-300 bg-white dark:bg-zinc-950 transition"
                />
                <span>Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* 5. Action Button: shadcn styled Primary Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 px-4 py-2 mt-2 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:text-zinc-900 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 disabled:pointer-events-none disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

export default function UniversalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
          <Loader2 className="w-6 h-6 text-zinc-600 dark:text-zinc-400 animate-spin" />
          <span className="text-xs font-medium tracking-wide text-zinc-500">
            Initializing login...
          </span>
        </div>
      }
    >
      <UniversalLoginPageContent />
    </Suspense>
  );
}
