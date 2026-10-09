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
  Loader2,
  AlertCircle,
  X,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { persistStoredSession, AUTH_UPDATE_EVENT, getStoredSession } from "@/lib/session-context";
import { customFetch, beginTokenWait, setAuthToken } from "@/lib/api-client";
interface TenantBrandingConfig {
  id?: string;
  name: string;
  subdomain?: string;
  slug?: string | null;
  logo?: string | null;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "";
  const urlError = searchParams.get("error");
  const urlMessage = searchParams.get("message");

  // Form input states
  const [schoolCode, setSchoolCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Multi-tenant branding states
  const [resolvedSubdomain, setResolvedSubdomain] = useState<string | null>(null);
  const [tenantBranding, setTenantBranding] = useState<TenantBrandingConfig | null>(null);

  // Floating Toast Notification state (completely decoupled from form container layout)
  const [toastNotification, setToastNotification] = useState<{
    id: number;
    type: "error" | "info" | "success";
    message: string;
  } | null>(null);

  // Trigger floating toast with 4-second auto-dismiss
  const showToast = (message: string, type: "error" | "info" | "success" = "error") => {
    const id = Date.now();
    setToastNotification({ id, type, message });
  };

  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification((current) => (current?.id === toastNotification.id ? null : current));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  // 1. Sanitize the URL Address Bar and Handle Clean System States / HTTP Status Codes
  useEffect(() => {
    if (typeof window === "undefined") return;

    // A. Check transient HTTP status / system state passed via cookie
    let systemStatus = "";
    const cookieJar = document.cookie.split(";").map((c) => c.trim());
    const guardStatusCookie = cookieJar.find((c) => c.startsWith("auth_guard_status="));
    if (guardStatusCookie) {
      systemStatus = decodeURIComponent(guardStatusCookie.split("=")[1]);
      // Immediately expire cookie so notification is one-shot
      document.cookie = "auth_guard_status=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    }

    // B. Sanitize the active address bar: Clear out any plaintext error or leaked query strings
    const currentParams = new URLSearchParams(window.location.search);
    const leakedError = currentParams.get("error");
    const isSuperAdminAccessBlocked =
      systemStatus === "403_SUPER_ADMIN_FORBIDDEN" ||
      systemStatus === "403" ||
      (leakedError && leakedError.toLowerCase().includes("super admin"));

    if (window.location.search) {
      // Clear out the address path parameters immediately, keeping URL cleanly at: /login
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // C. Premium Client-Side Error Handling
    if (isSuperAdminAccessBlocked) {
      showToast(
        "Access Denied: You do not have permission to view the Super Admin control plane. Redirecting to your workspace...",
        "error"
      );

      // D. Automatic Redirection Safety:
      // If an active user session token is detected, immediately trigger a controlled push redirect
      const activeSession = getStoredSession();
      if (activeSession) {
        const rawRole = (activeSession.role || activeSession.userRole || "").toUpperCase();
        const staffRole = (activeSession.staffRole || "").toUpperCase();
        const tenantDomain = activeSession.schoolDomain || "";

        let safeRoute = "/dashboard/admin";
        if (rawRole === "SUPER_ADMIN") {
          safeRoute = "/dashboard/super-admin";
        } else if (
          rawRole === "SCHOOL_ADMIN" ||
          rawRole === "TENANT_ADMIN" ||
          rawRole === "ADMIN" ||
          rawRole === "PRINCIPAL" ||
          rawRole === "VICE_PRINCIPAL" ||
          rawRole === "HEADMASTER"
        ) {
          safeRoute = tenantDomain ? `/${tenantDomain}/dashboard` : "/dashboard/admin";
        } else if (
          rawRole === "TEACHER" ||
          rawRole === "STAFF" ||
          rawRole === "BURSAR" ||
          rawRole === "ACCOUNTANT" ||
          staffRole.includes("TEACHER") ||
          staffRole.includes("STAFF")
        ) {
          safeRoute = "/dashboard/teacher";
        } else if (rawRole === "STUDENT") {
          safeRoute = tenantDomain ? `/${tenantDomain}/portal/student` : "/dashboard/student";
        } else if (rawRole === "PARENT") {
          safeRoute = "/dashboard/parent";
        }

        const timer = setTimeout(() => {
          router.push(safeRoute);
        }, 1500);
        return () => clearTimeout(timer);
      }
    } else if (urlError === "CredentialsSignin") {
      showToast("Invalid credentials. Please verify your email and password.", "error");
    } else if (urlMessage) {
      showToast(urlMessage, "info");
    } else if (urlError && !urlError.toLowerCase().includes("super admin")) {
      showToast("Authentication could not be completed. Please verify your credentials.", "error");
    }
  }, [router, urlError, urlMessage]);

  // Client-Side Multi-Tenancy Subdomain Evaluation
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Query parameters (?school=..., ?subdomain=..., ?tenant=..., ?mockTenant=...)
    const params = new URLSearchParams(window.location.search);
    const querySchool =
      params.get("school") ||
      params.get("schoolDomain") ||
      params.get("tenant") ||
      params.get("mockTenant");

    if (querySchool && querySchool.trim()) {
      const clean = querySchool.trim().toLowerCase();
      if (!["demo", "localhost", "root", "default", "admin"].includes(clean)) {
        setResolvedSubdomain(clean);
        try {
          window.localStorage.setItem("schoolerp_tenant", clean);
        } catch {}
        return;
      }
    }

    // 2. Parse Hostname
    const hostname = window.location.hostname.toLowerCase().replace(/^www\./, "");
    const configuredRoot = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "bonaveeict.com.ng").toLowerCase().replace(/^www\./, "").trim();
    const renderHostingDomain = "school-erp-1-mfc3.onrender.com";

    // Localhost subdomain: e.g. greenwood.localhost
    if (hostname.endsWith(".localhost")) {
      const localParts = hostname.split(".");
      if (localParts.length >= 2 && localParts[0] !== "localhost" && localParts[0] !== "demo") {
        const sub = localParts[0];
        setResolvedSubdomain(sub);
        try {
          window.localStorage.setItem("schoolerp_tenant", sub);
        } catch {}
        return;
      }
    }

    // Production domain subdomain: e.g. greenwood.bonaveeict.com.ng
    if (configuredRoot && hostname.endsWith(`.${configuredRoot}`)) {
      const sub = hostname.slice(0, -(configuredRoot.length + 1));
      if (sub && !["www", "app", "mail", "api", "admin", "demo"].includes(sub)) {
        setResolvedSubdomain(sub);
        try {
          window.localStorage.setItem("schoolerp_tenant", sub);
        } catch {}
        return;
      }
    }

    // Render subdomain: e.g. greenwood.school-erp-1-mfc3.onrender.com
    if (hostname.endsWith(`.${renderHostingDomain}`)) {
      const sub = hostname.slice(0, -(renderHostingDomain.length + 1));
      if (sub && !["www", "app", "mail", "api", "admin", "demo"].includes(sub)) {
        setResolvedSubdomain(sub);
        try {
          window.localStorage.setItem("schoolerp_tenant", sub);
        } catch {}
        return;
      }
    }

    // 3. Path-based subdomain routing: e.g. /greenwood/login
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    if (
      pathParts.length > 0 &&
      !["login", "admin", "dashboard", "api", "_next", "portal", "demo"].includes(pathParts[0].toLowerCase())
    ) {
      setResolvedSubdomain(pathParts[0].toLowerCase());
      try {
        window.localStorage.setItem("schoolerp_tenant", pathParts[0].toLowerCase());
      } catch {}
      return;
    }

    // 4. Stored tenant fallback (strictly exclude demo / placeholder)
    try {
      const storedTenant =
        window.localStorage.getItem("schoolerp_tenant") ||
        window.localStorage.getItem("schoolDomain");
      if (
        storedTenant &&
        !["undefined", "null", "root", "default", "platform", "localhost", "demo", "admin"].includes(storedTenant.toLowerCase())
      ) {
        setResolvedSubdomain(storedTenant.toLowerCase());
      } else if (storedTenant && ["demo", "localhost", "root", "default", "null", "undefined", "admin"].includes(storedTenant.toLowerCase())) {
        window.localStorage.removeItem("schoolerp_tenant");
        window.localStorage.removeItem("schoolDomain");
      }
    } catch {}
  }, []);

  // Sync database tenant branding when subdomain resolves
  useEffect(() => {
    let isMounted = true;
    if (!resolvedSubdomain || ["demo", "localhost", "root", "default", "admin"].includes(resolvedSubdomain.toLowerCase())) {
      setTenantBranding(null);
      return;
    }

    fetch(`/api/schools/${encodeURIComponent(resolvedSubdomain)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.school) {
          setTenantBranding({
            id: data.school.id,
            name: data.school.name,
            subdomain: data.school.subdomain,
            logo: data.school.logo,
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [resolvedSubdomain]);

  // Synchronize schoolCode with resolved subdomain if not manually set
  useEffect(() => {
    if (resolvedSubdomain && !["admin", "demo", "localhost", "root", "default"].includes(resolvedSubdomain.toLowerCase()) && !schoolCode) {
      setSchoolCode(resolvedSubdomain);
    }
  }, [resolvedSubdomain, schoolCode]);

  // Unified Form Submission & Dynamic SaaS Resolution Flow
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();
    const effectiveSchoolCode = (schoolCode.trim() || resolvedSubdomain || "").trim().toLowerCase();
    const targetDomain = effectiveSchoolCode;

    const loginPayload: Record<string, any> = {
      email: normalizedEmail,
      password,
      schoolCode: effectiveSchoolCode || undefined,
      schoolDomain: effectiveSchoolCode || undefined,
    };

    try {
      beginTokenWait();

      // 1. Send credentials to live multi-tenant authentication endpoint
      let apiLoginData: any = null;
      try {
        const loginRes = await customFetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loginPayload),
        });
        if (loginRes.ok) {
          apiLoginData = await loginRes.json();
        }
      } catch (directErr) {
        console.warn("[Login] Direct endpoint attempt fell back to NextAuth provider:", directErr);
      }

      // 2. NextAuth signIn wrapper synchronization
      const res = await signIn("credentials", {
        ...loginPayload,
        redirect: false,
      });

      if (res?.error && !apiLoginData?.success) {
        setAuthToken(null);
        showToast("Invalid credentials. Please verify your email and password.", "error");
        setIsSubmitting(false);
        return;
      }

      // 3. Extract verified JWT session payload
      let sessionPayload: any = null;
      if (apiLoginData && apiLoginData.success) {
        const effectiveToken = apiLoginData.token || apiLoginData.accessToken || apiLoginData.sessionToken;
        sessionPayload = {
          userId: apiLoginData.userId,
          email: normalizedEmail,
          tenantId: apiLoginData.schoolId || apiLoginData.tenantId,
          schoolDomain: apiLoginData.schoolDomain || targetDomain,
          tenantName: apiLoginData.tenantName || tenantBranding?.name || "Institution",
          role: apiLoginData.role,
          userRole: apiLoginData.userRole || apiLoginData.role,
          staffRole: apiLoginData.staffRole || apiLoginData.role,
          assignedTier: apiLoginData.assignedTier || null,
          activeTiers: apiLoginData.activeTiers || [],
          permissions: apiLoginData.permissions || [],
          sessionToken: apiLoginData.sessionToken || effectiveToken,
          token: effectiveToken,
          mustChangePassword: Boolean(apiLoginData.mustChangePassword),
        };
      }

      // Fallback: Query session verification endpoint
      if (!sessionPayload) {
        try {
          const v1SessionRes = await customFetch("/api/v1/auth/session");
          if (v1SessionRes.ok) {
            const v1Data = await v1SessionRes.json();
            if (v1Data.authenticated && v1Data.session) {
              sessionPayload = v1Data.session;
            }
          }
        } catch {}
      }

      if (!sessionPayload) {
        try {
          const sessionRes = await customFetch("/api/auth/session");
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData?.user) {
              const u = sessionData.user;
              sessionPayload = {
                userId: u.id || u.userId,
                email: u.email,
                tenantId: u.tenantId,
                schoolDomain: u.schoolDomain,
                tenantName: u.tenantName,
                role: u.role,
                userRole: u.userRole || u.role,
                staffRole: u.staffRole,
                assignedTier: u.assignedTier || null,
                activeTiers: u.activeTiers || [],
                permissions: u.permissions || [],
                sessionToken: u.sessionToken,
                token: u.sessionToken,
              };
            }
          }
        } catch {}
      }

      // Hydrate client storage & trigger session update
      if (sessionPayload) {
        const tokenToSet = sessionPayload.token || sessionPayload.sessionToken;
        if (tokenToSet) {
          setAuthToken(tokenToSet, sessionPayload.sessionToken);
        }
        persistStoredSession(sessionPayload);

        if (typeof window !== "undefined") {
          const finalDomain = sessionPayload.schoolDomain || targetDomain;
          if (finalDomain) {
            window.localStorage.setItem("schoolerp_tenant", finalDomain);
            window.localStorage.setItem("schoolDomain", finalDomain);
          }
          if (sessionPayload.tenantId) {
            window.localStorage.setItem("tenantId", sessionPayload.tenantId);
          }
          if (sessionPayload.assignedTier) {
            window.localStorage.setItem("schoolerp_assigned_tier", sessionPayload.assignedTier);
          }
          if (sessionPayload.userRole) {
            window.localStorage.setItem("schoolerp_user_role", sessionPayload.userRole);
          }
        }
        window.dispatchEvent(new Event(AUTH_UPDATE_EVENT));
      }

      router.refresh();

      // Explicit role & global SaaS context resolution
      const rawRole = (sessionPayload?.role || sessionPayload?.userRole || "").toUpperCase();
      const staffRole = (sessionPayload?.staffRole || "").toUpperCase();
      const isDev = process.env.NODE_ENV !== "production";
      const isSuperAdminUser =
        rawRole === "SUPER_ADMIN" ||
        Boolean(sessionPayload?.isSuperAdmin) ||
        normalizedEmail === "bonaventure.chinoso@gmail.com" ||
        normalizedEmail === "admin@bonaveeict.com.ng" ||
        (isDev && normalizedEmail === "superadmin@platform.com");

      // Super Admin Golden Key: Always forward directly to /dashboard/super-admin
      if (isSuperAdminUser) {
        router.push("/dashboard/super-admin");
        return;
      }

      // Check forced initial password reset for standard accounts
      if (sessionPayload?.mustChangePassword) {
        router.push("/change-password");
        return;
      }

      // Respect explicit callback URL if specified and not a login loop
      if (callbackUrl && !callbackUrl.includes("/login")) {
        router.push(callbackUrl);
        return;
      }

      // Programmatic routing based on global SaaS context:
      // - Global SaaS Layer Super Admins -> /dashboard/super-admin
      // - Tenant Admins -> /dashboard/admin
      // - School Staff/Teachers -> /dashboard/teacher
      // - Students -> /dashboard/student
      // - Parents -> /dashboard/parent
      if (isSuperAdminUser || (!sessionPayload?.schoolDomain && !targetDomain && !rawRole)) {
        router.push("/dashboard/super-admin");
      } else if (
        rawRole === "SCHOOL_ADMIN" ||
        rawRole === "TENANT_ADMIN" ||
        rawRole === "ADMIN" ||
        rawRole === "PRINCIPAL" ||
        rawRole === "VICE_PRINCIPAL" ||
        rawRole === "HEADMASTER"
      ) {
        router.push("/dashboard/admin");
      } else if (
        rawRole === "TEACHER" ||
        rawRole === "STAFF" ||
        rawRole === "BURSAR" ||
        rawRole === "ACCOUNTANT" ||
        staffRole.includes("TEACHER") ||
        staffRole.includes("STAFF")
      ) {
        router.push("/dashboard/teacher");
      } else if (rawRole === "STUDENT") {
        router.push("/dashboard/student");
      } else if (rawRole === "PARENT") {
        router.push("/dashboard/parent");
      } else {
        router.push("/dashboard/admin");
      }
    } catch (err: any) {
      showToast(err.message || "An unexpected error occurred during authentication.", "error");
      setIsSubmitting(false);
    }
  };

  const rawTenantName = tenantBranding?.name || (resolvedSubdomain ? resolvedSubdomain.charAt(0).toUpperCase() + resolvedSubdomain.slice(1) : "");
  const visualTenantName =
    !rawTenantName ||
    rawTenantName.toLowerCase() === "admin" ||
    rawTenantName.toLowerCase() === "demo" ||
    rawTenantName.toLowerCase() === "localhost" ||
    rawTenantName.toLowerCase() === "root" ||
    rawTenantName.toLowerCase() === "default"
      ? ""
      : rawTenantName;

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-600 selection:text-white">
      {/* ========================================================================= */}
      {/* FLOATING ERROR / STATUS TOAST NOTIFICATION                                */}
      {/* Decoupled from form markup so container flow never shifts                 */}
      {/* ========================================================================= */}
      {toastNotification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-6 right-6 z-50 max-w-sm sm:max-w-md w-full animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div
            className={`p-4 rounded-2xl shadow-xl border backdrop-blur-xl flex items-start gap-3 transition-all duration-200 ${
              toastNotification.type === "error"
                ? "bg-white/95 border-red-200 text-red-700 shadow-red-900/5"
                : toastNotification.type === "success"
                ? "bg-white/95 border-emerald-200 text-emerald-700 shadow-emerald-900/5"
                : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-900/5"
            }`}
          >
            {toastNotification.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            ) : toastNotification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <Building2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
              {toastNotification.message}
            </div>
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors duration-150 p-1 rounded-lg focus:outline-none"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. LEFT PANEL (Light Architectural Theme - md:flex md:w-[60%])             */}
      {/* High-end architectural tone, light geometric matrix, zero hardcoded stats  */}
      {/* ========================================================================= */}
      <div className="hidden md:flex md:w-[60%] min-h-screen relative overflow-hidden flex-col justify-between p-10 lg:p-14 xl:p-16 bg-[#F1F5F9] border-r border-slate-200/80 text-slate-900 select-none">
        
        {/* Minimalist Architectural Structural Grid Blueprint Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000003_1px,transparent_1px),linear-gradient(to_bottom,#00000003_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        {/* Ambient subtle luminous glow accents for depth */}
        <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 bg-slate-400/10 rounded-full blur-3xl" />

        {/* Top-Left Master Brand Placement: Clean Architectural Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 w-fit">
            {/* Small square box/badge containing corporate logo with matching curved border radius */}
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
              <span className="font-extrabold text-lg md:text-xl tracking-tight text-slate-900">
                SchoolERP
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/60 border border-slate-300/40">
                ENTERPRISE CLOUD
              </span>
            </div>
          </div>
        </div>

        {/* Clean, minimalist architectural workspace - Zero hardcoded stats or grid blocks */}
        <div className="relative z-10" />
      </div>

      {/* ========================================================================= */}
      {/* 2. RIGHT PANEL (Pristine Solid White Card - w-full md:w-[40%])            */}
      {/* Pristine white surface, border-slate-100, shadow-2xl, rounded-2xl         */}
      {/* ========================================================================= */}
      <div className="w-full md:w-[40%] min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 relative">
        <div className="w-full max-w-[420px] mx-auto bg-white border border-slate-100 shadow-2xl rounded-2xl p-6 sm:p-8 space-y-6">
          
          {/* Header & Dynamic Branding Extraction */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {/* Platform Core Logo - Clean High-Definition Display with Smooth Border Radius */}
              <div className="h-11 w-11 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-center p-1 overflow-hidden">
                <Image
                  src="/img/business-logo.png"
                  alt="SchoolERP Logo"
                  width={44}
                  height={44}
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>

              {/* Tenant Specific School Logo Injection (ONLY rendered if visualTenantName is verified, dynamic, and non-empty) */}
              {visualTenantName && visualTenantName.toLowerCase() !== "admin" ? (
                tenantBranding?.logo ? (
                  <>
                    <div className="h-6 w-px bg-slate-200" />
                    <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1.5 overflow-hidden shadow-xs">
                      <Image
                        src={tenantBranding.logo}
                        alt={`${visualTenantName} Logo`}
                        width={30}
                        height={30}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-6 w-px bg-slate-200" />
                    <div className="h-10 px-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700">
                      <Building2 className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                      <span className="truncate max-w-[140px]">{visualTenantName}</span>
                    </div>
                  </>
                )
              ) : null}
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Sign in to access your workspace
              </h1>
            </div>
          </div>

          {/* Core Tabless Unified Form */}
          <form onSubmit={handleSignIn} className="space-y-5" noValidate>
            
            {/* 1. Modern Floating Label School Code Input */}
            <div className="relative group">
              <input
                id="floating-school-code"
                type="text"
                name="schoolCode"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                placeholder=" "
                autoComplete="organization"
                disabled={isSubmitting}
                className="peer block w-full rounded-xl border border-slate-200 bg-white px-4 pt-5 pb-2 text-sm text-slate-900 placeholder-transparent focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all duration-200 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
              />
              <label
                htmlFor="floating-school-code"
                className="pointer-events-none absolute left-4 top-2 text-[11px] font-semibold text-slate-500 transition-all duration-200 ease-in-out peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-indigo-600"
              >
                School Code
              </label>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-200">
                <Building2 className="w-4 h-4" />
              </div>
            </div>

            {/* 2. Modern Floating Label Email Input (Pure White Backdrop, Crisp Slate Border) */}
            <div className="relative group">
              <input
                id="floating-email"
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                autoComplete="email"
                disabled={isSubmitting}
                className="peer block w-full rounded-xl border border-slate-200 bg-white px-4 pt-5 pb-2 text-sm text-slate-900 placeholder-transparent focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all duration-200 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
              />
              <label
                htmlFor="floating-email"
                className="pointer-events-none absolute left-4 top-2 text-[11px] font-semibold text-slate-500 transition-all duration-200 ease-in-out peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-indigo-600"
              >
                Email Address
              </label>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-200">
                <Mail className="w-4 h-4" />
              </div>
            </div>

            {/* 2. Modern Floating Label Password Input */}
            <div className="relative group">
              <input
                id="floating-password"
                type={showPassword ? "text" : "password"}
                name="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                autoComplete="current-password"
                disabled={isSubmitting}
                className="peer block w-full rounded-xl border border-slate-200 bg-white pl-4 pr-11 pt-5 pb-2 text-sm text-slate-900 placeholder-transparent focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all duration-200 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
              />
              <label
                htmlFor="floating-password"
                className="pointer-events-none absolute left-4 top-2 text-[11px] font-semibold text-slate-500 transition-all duration-200 ease-in-out peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-indigo-600"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 hover:text-slate-900 transition-colors duration-150">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isSubmitting}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white transition duration-150 cursor-pointer"
                />
                <span className="font-medium">Remember me</span>
              </label>
              <Link
                href={
                  resolvedSubdomain
                    ? `/${resolvedSubdomain}/forgot-password`
                    : "/forgot-password"
                }
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors duration-150"
              >
                Forgot password?
              </Link>
            </div>

            {/* Sign In Action Button with Spinner */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#0B132B] hover:bg-[#1C2541] active:bg-slate-900 text-white font-semibold transition-all duration-200 shadow-xl rounded-xl w-full py-3 mt-2 inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-slate-900/10 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Bottom Security Note */}
          <div className="pt-4 border-t border-slate-200/80 text-center">
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Protected by 256-bit institutional encryption layer</span>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          <span className="text-xs font-medium tracking-wide text-slate-500">
            Initializing secure gateway...
          </span>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
