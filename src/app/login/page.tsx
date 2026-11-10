"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams, useParams, usePathname } from "next/navigation";
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
  Sparkles,
} from "lucide-react";
import { persistStoredSession, AUTH_UPDATE_EVENT, getStoredSession } from "@/lib/session-context";
import { customFetch, beginTokenWait, setAuthToken } from "@/lib/api-client";

function clearStoredSession() {
  persistStoredSession(null);
  setAuthToken(null);
  if (typeof window !== "undefined") {
    try { localStorage.removeItem("schoolerp_tenant"); } catch { }
    try { localStorage.removeItem("schoolDomain"); } catch { }
    try { localStorage.removeItem("tenantId"); } catch { }
    try { localStorage.removeItem("schoolerp_assigned_tier"); } catch { }
    try { localStorage.removeItem("schoolerp_user_role"); } catch { }
  }
}

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
  const params = useParams();
  const pathname = usePathname() || "";
  const routeSchool = (params?.schoolDomain as string) || "";
  const callbackUrl = searchParams.get("callbackUrl") || "";
  const urlError = searchParams.get("error");
  const urlMessage = searchParams.get("message");

  // Detect super-admin context
  const isSuperAdmin =
    pathname.startsWith("/super-admin") ||
    searchParams.get("type") === "super-admin" ||
    callbackUrl.startsWith("/super-admin") ||
    callbackUrl.startsWith("/admin");

  // Form input states
  const [schoolCode, setSchoolCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schoolCodeError, setSchoolCodeError] = useState<string | null>(null);

  // Multi-tenant branding states
  const [resolvedSubdomain, setResolvedSubdomain] = useState<string | null>(null);
  const [tenantBranding, setTenantBranding] = useState<TenantBrandingConfig | null>(null);

  // Sync schoolCode whenever resolvedSubdomain updates
  useEffect(() => {
    if (resolvedSubdomain) {
      setSchoolCode(resolvedSubdomain);
    }
  }, [resolvedSubdomain]);

  // Auto-fill username/email from query params if supplied (e.g. from notification link)
  useEffect(() => {
    const queryEmail = searchParams.get("email") || searchParams.get("username") || searchParams.get("login");
    if (queryEmail) {
      setEmail((prev) => (prev ? prev : queryEmail.trim()));
    }
  }, [searchParams]);

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
    if (currentParams.get("logout") === "1" || currentParams.get("loggedOut") === "true") {
      clearStoredSession();
      setAuthToken(null);
      fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
      fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    }
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

      // D. Do NOT auto-redirect based on unverified localStorage session alone.
      // Session verification & isolation is handled safely by verifyAndIsolate().
      clearStoredSession();
      setAuthToken(null);
    } else if (urlError === "CredentialsSignin") {
      showToast("Invalid credentials. Please verify your email and password.", "error");
    } else if (urlError === "tenant_not_found") {
      const badSchool = searchParams.get("school") || "that school code";
      showToast(`No school found for "${badSchool}". Please check your School Code and try again.`, "error");
    } else if (urlError === "suspended") {
      const suspendedSchool = searchParams.get("code") || searchParams.get("school") || "This institution";
      showToast(`Institution ${suspendedSchool} is suspended: Subscription overdue or inactive. Please contact administration or visit billing.`, "error");
    } else if (urlMessage) {
      showToast(urlMessage, "info");
    } else if (urlError && !urlError.toLowerCase().includes("super admin")) {
      showToast("Authentication could not be completed. Please verify your credentials.", "error");
    }
  }, [router, urlError, urlMessage, searchParams]);

  // Client-Side Multi-Tenancy Subdomain Evaluation
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 0. Explicit route parameter from /[schoolDomain]/login
    if (routeSchool && !["login", "admin", "dashboard", "api", "_next", "portal"].includes(routeSchool.toLowerCase())) {
      const slug = routeSchool.toLowerCase().trim();
      setResolvedSubdomain(slug);
      setSchoolCode(slug);
      try {
        window.localStorage.setItem("schoolerp_tenant", slug);
      } catch { }
      return;
    }

    // 1. Query parameters (?school=..., ?subdomain=..., ?tenant=..., ?mockTenant=...)
    const params = new URLSearchParams(window.location.search);
    const querySchool =
      params.get("school") ||
      params.get("schoolDomain") ||
      params.get("tenant") ||
      params.get("mockTenant");

    if (querySchool && querySchool.trim()) {
      const clean = querySchool.trim().toLowerCase();
      if (!["localhost", "root", "default", "admin"].includes(clean)) {
        setResolvedSubdomain(clean);
        setSchoolCode(clean);
        try {
          window.localStorage.setItem("schoolerp_tenant", clean);
        } catch { }
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
      if (localParts.length >= 2 && localParts[0] !== "localhost") {
        const sub = localParts[0];
        setResolvedSubdomain(sub);
        setSchoolCode(sub);
        try {
          window.localStorage.setItem("schoolerp_tenant", sub);
        } catch { }
        return;
      }
    }

    // Production domain subdomain: e.g. greenwood.bonaveeict.com.ng
    if (configuredRoot && hostname.endsWith(`.${configuredRoot}`)) {
      const sub = hostname.slice(0, -(configuredRoot.length + 1));
      if (sub && !["www", "app", "mail", "api", "admin"].includes(sub)) {
        setResolvedSubdomain(sub);
        setSchoolCode(sub);
        try {
          window.localStorage.setItem("schoolerp_tenant", sub);
        } catch { }
        return;
      }
    }

    // Render subdomain: e.g. greenwood.school-erp-1-mfc3.onrender.com
    if (hostname.endsWith(`.${renderHostingDomain}`)) {
      const sub = hostname.slice(0, -(renderHostingDomain.length + 1));
      if (sub && !["www", "app", "mail", "api", "admin"].includes(sub)) {
        setResolvedSubdomain(sub);
        setSchoolCode(sub);
        try {
          window.localStorage.setItem("schoolerp_tenant", sub);
        } catch { }
        return;
      }
    }

    // 3. Path-based subdomain routing: e.g. /greenwood/login or /demo/login
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    if (
      pathParts.length > 0 &&
      !["login", "admin", "dashboard", "api", "_next", "portal"].includes(pathParts[0].toLowerCase())
    ) {
      const slug = pathParts[0].toLowerCase();
      setResolvedSubdomain(slug);
      setSchoolCode(slug);
      try {
        window.localStorage.setItem("schoolerp_tenant", slug);
      } catch { }
      return;
    }
  }, [routeSchool]);

  // FIX 4: Session Isolation — verify existing token on page load,
  // clear stale/mismatched sessions, never auto-redirect from localStorage alone.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const verifyAndIsolate = async () => {
      // Clear any stored session that belongs to a DIFFERENT school than the
      // school code currently on screen (prevents cross-tenant leakage).
      const stored = getStoredSession();
      const storedDomain = (stored?.schoolDomain || "").trim().toLowerCase();
      const pageDomain = (resolvedSubdomain || "").trim().toLowerCase();

      if (stored) {
        const storedRole = (stored.role || stored.userRole || "").toUpperCase();
        const storedIsSuperAdmin = storedRole === "SUPER_ADMIN" || storedDomain === "admin";
        // A Super Admin session must never carry over onto a school login page,
        // a session from one school must never carry over onto another school,
        // and a tenant session must never carry over onto the root platform login.
        const isMismatch =
          (Boolean(pageDomain) && (storedIsSuperAdmin || storedDomain !== pageDomain)) ||
          (!pageDomain && Boolean(storedDomain) && storedDomain !== "admin");

        if (isMismatch) {
          clearStoredSession();
          setAuthToken(null);
          try { localStorage.removeItem("schoolerp_tenant"); } catch { }
          try { localStorage.removeItem("schoolDomain"); } catch { }
          try { localStorage.removeItem("tenantId"); } catch { }
          return;
        }
      }

      // Verify token with the server (request-scoped, not from localStorage alone)
      try {
        const sessionRes = await fetch("/api/v1/auth/session", {
          credentials: "include",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!sessionRes.ok) {
          clearStoredSession();
          setAuthToken(null);
          return;
        }
        const sessionData = await sessionRes.json();
        if (!sessionData?.authenticated || !sessionData?.session) {
          clearStoredSession();
          setAuthToken(null);
          return;
        }

        const srv = sessionData.session;
        const srvDomain = (srv.schoolDomain || "").trim().toLowerCase();
        const srvRole = (srv.role || srv.userRole || "").toUpperCase();
        const isSuperAdminSrv = srvRole === "SUPER_ADMIN" || Boolean(srv.isSuperAdmin);

        // Server-side tenant boundary check:
        // Stale tenant session on root login, or mismatched tenant on school login -> wipe immediately
        const srvMismatch =
          (pageDomain && (srvDomain !== pageDomain || isSuperAdminSrv)) ||
          (!pageDomain && srvDomain && !isSuperAdminSrv);

        if (srvMismatch) {
          clearStoredSession();
          setAuthToken(null);
          try { localStorage.removeItem("schoolerp_tenant"); } catch { }
          try { localStorage.removeItem("schoolDomain"); } catch { }
          try { localStorage.removeItem("tenantId"); } catch { }
          return;
        }
      } catch {
        // Server check failed — show login form normally
      }
    };

    verifyAndIsolate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSubdomain]);

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
      .catch(() => { });

    return () => {
      isMounted = false;
    };
  }, [resolvedSubdomain]);

  // Demo Tenant Evaluation & Verified Seed Credentials
  const DEMO_EMAIL = "headmaster@demo.edu.ng";
  const DEMO_PASSWORD = "Password123";
  const DEMO_SCHOOL_CODE = "demo";

  const isDemoTenant =
    (resolvedSubdomain || "").trim().toLowerCase() === "demo" ||
    (schoolCode || "").trim().toLowerCase() === "demo" ||
    (routeSchool || "").trim().toLowerCase() === "demo";

  // Unified Form Submission & Dynamic SaaS Resolution Flow
  const performLogin = async (customEmail?: string, customPassword?: string, customSchoolCode?: string) => {
    setSchoolCodeError(null);
    setIsSubmitting(true);

    const emailToUse = customEmail !== undefined ? customEmail : email;
    const passwordToUse = customPassword !== undefined ? customPassword : password;
    const schoolCodeToUse = isSuperAdmin ? "" : (customSchoolCode !== undefined ? customSchoolCode : schoolCode);

    const normalizedEmail = emailToUse.trim().toLowerCase();
    const effectiveSchoolCode = isSuperAdmin
      ? ""
      : (schoolCodeToUse.trim() || resolvedSubdomain || "").trim().toLowerCase();
    const targetDomain = effectiveSchoolCode;

    // Check if authenticating without a school code as super admin
    const isKnownSuperAdmin =
      isSuperAdmin ||
      normalizedEmail === "bonaventure.chinoso@gmail.com" ||
      normalizedEmail === "admin@bonaveeict.com.ng" ||
      normalizedEmail === "superadmin@platform.com";

    // Immediate client-side validation guard: School code is mandatory for institutional workspace access
    if (!isSuperAdmin && !effectiveSchoolCode && !isKnownSuperAdmin) {
      const errorMsg = "School Code is required to access your workspace.";
      setSchoolCodeError(errorMsg);
      showToast(errorMsg, "error");
      setIsSubmitting(false);
      setAuthToken(null);
      return;
    }

    const loginPayload: Record<string, any> = {
      email: normalizedEmail,
      password: passwordToUse,
      schoolCode: isSuperAdmin ? undefined : (effectiveSchoolCode || undefined),
      schoolDomain: isSuperAdmin ? undefined : (effectiveSchoolCode || undefined),
      isAdminLogin: isSuperAdmin,
      isPlatformAdmin: isSuperAdmin,
    };

    // Session isolation: drop any stored session that belongs to a different
    // tenant (or the platform) than the school code being submitted.
    const existingSession = getStoredSession();
    if (existingSession) {
      const existingDomain = (existingSession.schoolDomain || "").trim().toLowerCase();
      const existingTarget = existingDomain === "admin" ? "" : existingDomain;
      if (existingTarget !== effectiveSchoolCode) {
        clearStoredSession();
        setAuthToken(null);
      }
    }

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

        const resData = await loginRes.json().catch(() => null);

        if (!loginRes.ok) {
          setIsSubmitting(false);
          setAuthToken(null);
          const errorMsg =
            resData?.error ||
            (!effectiveSchoolCode && !isSuperAdmin
              ? "School Code is required to access your workspace."
              : "Invalid credentials. Please verify your email and password.");

          if (!isSuperAdmin && (!effectiveSchoolCode || resData?.error?.toLowerCase().includes("school code"))) {
            setSchoolCodeError(errorMsg);
          }
          showToast(errorMsg, "error");
          return;
        }

        apiLoginData = resData;
      } catch (directErr) {
        console.warn("[Login] Direct endpoint attempt fell back to NextAuth provider:", directErr);
      }

      // 2. NextAuth signIn wrapper synchronization
      let res: any = null;
      try {
        res = await signIn("credentials", {
          ...loginPayload,
          redirect: false,
        });
      } catch (signInErr: any) {
        setIsSubmitting(false);
        setAuthToken(null);
        const errMsg = !effectiveSchoolCode && !isSuperAdmin
          ? "School Code is required to access your workspace."
          : (signInErr?.message || "Invalid credentials. Please verify your email and password.");
        if (!effectiveSchoolCode && !isSuperAdmin) {
          setSchoolCodeError(errMsg);
        }
        showToast(errMsg, "error");
        return;
      }

      if (res?.error && !apiLoginData?.success) {
        setAuthToken(null);
        setIsSubmitting(false);
        const rawErr = typeof res.error === "string" ? res.error : "";
        const isSchoolCodeErr =
          !isSuperAdmin &&
          (!effectiveSchoolCode ||
          rawErr.toLowerCase().includes("school code") ||
          rawErr.toLowerCase().includes("tenant"));

        const displayErr = isSchoolCodeErr
          ? "School Code is required to access your workspace."
          : "Invalid credentials. Please verify your email and password.";

        if (isSchoolCodeErr) {
          setSchoolCodeError(displayErr);
        }
        showToast(displayErr, "error");
        return;
      }

      // 3. Extract verified JWT session payload
      let sessionPayload: any = null;
      const isTargetDemo = (effectiveSchoolCode || resolvedSubdomain || "").trim().toLowerCase() === "demo";
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
          mustChangePassword: !isTargetDemo && Boolean(apiLoginData.mustChangePassword),
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
        } catch { }
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
        } catch { }
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
      // Super Admin is determined solely by the server-verified role, and only
      // for platform logins (no school code). Never inferred from the typed email.
      const isSuperAdminUser =
        isSuperAdmin ||
        (!effectiveSchoolCode &&
        (rawRole === "SUPER_ADMIN" || Boolean(sessionPayload?.isSuperAdmin)));

      // Super Admin Golden Key: Always forward directly to /super-admin
      if (isSuperAdmin || isSuperAdminUser || rawRole === "SUPER_ADMIN") {
        router.push("/super-admin");
        return;
      }

      // Check forced initial password reset for standard accounts (bypassed conditionally for demo tenant)
      const isLoginDemoTenant = (effectiveSchoolCode || resolvedSubdomain || sessionPayload?.schoolDomain || "").trim().toLowerCase() === "demo";
      if (!isLoginDemoTenant && sessionPayload?.mustChangePassword) {
        router.push("/change-password");
        return;
      }

      // Respect explicit callback URL if specified and not a login loop
      if (callbackUrl && !callbackUrl.includes("/login")) {
        const isRestrictedRole = (rawRole || staffRole || "").toUpperCase() === "STUDENT" || (rawRole || staffRole || "").toUpperCase() === "PARENT";
        const isAdminPath = /\/(dashboard|finance|students|staff|settings|academics|bursary|admin)(\/|$)/i.test(callbackUrl);
        if (!(isRestrictedRole && isAdminPath)) {
          router.push(callbackUrl);
          return;
        }
      }

      // RBAC role redirect mapping:
      // super_admin -> /super-admin
      // school_admin -> /[tenant]/dashboard
      // principal -> /[tenant]/portal/principal
      // bursar -> /[tenant]/portal/bursar
      // teacher/staff -> /[tenant]/portal/staff
      // student -> /[tenant]/portal/student
      // parent -> /[tenant]/portal/parent
      const targetCode = (effectiveSchoolCode || resolvedSubdomain || sessionPayload?.schoolDomain || "").trim().toLowerCase().replace(/^\//, "");
      if (!isSuperAdmin && !targetCode) {
        const missingSchoolMsg = "School Code is required to access your workspace.";
        setSchoolCodeError(missingSchoolMsg);
        showToast(missingSchoolMsg, "error");
        setIsSubmitting(false);
        setAuthToken(null);
        return;
      }

      const effectiveRole = (rawRole || staffRole || "").toUpperCase();
      if (effectiveRole === "BURSAR") {
        router.push(`/${targetCode}/portal/bursar`);
      } else if (
        effectiveRole === "PRINCIPAL" ||
        effectiveRole === "HEADMASTER" ||
        effectiveRole === "VICE_PRINCIPAL"
      ) {
        router.push(`/${targetCode}/portal/principal`);
      } else if (
        effectiveRole === "SCHOOL_ADMIN" ||
        effectiveRole === "TENANT_ADMIN" ||
        effectiveRole === "ADMIN" ||
        effectiveRole.includes("ADMIN")
      ) {
        router.push(`/${targetCode}/dashboard`);
      } else if (
        effectiveRole === "TEACHER" ||
        effectiveRole === "STAFF" ||
        staffRole.includes("TEACHER") ||
        staffRole.includes("STAFF")
      ) {
        router.push(`/${targetCode}/portal/staff`);
      } else if (effectiveRole === "STUDENT") {
        router.push(`/${targetCode}/portal/student`);
      } else if (effectiveRole === "PARENT") {
        router.push(`/${targetCode}/portal/parent`);
      } else {
        router.push(`/${targetCode}/portal`);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setAuthToken(null);
      const errMsg = err?.message || "An unexpected error occurred during authentication.";
      if (!isSuperAdmin && !effectiveSchoolCode) {
        setSchoolCodeError("School Code is required to access your workspace.");
      }
      showToast(errMsg, "error");
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await performLogin();
  };

  const handleDemoLogin = async () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    if (!resolvedSubdomain) {
      setSchoolCode(DEMO_SCHOOL_CODE);
    }
    await performLogin(DEMO_EMAIL, DEMO_PASSWORD, DEMO_SCHOOL_CODE);
  };

  const rawTenantName = tenantBranding?.name || (resolvedSubdomain ? resolvedSubdomain.charAt(0).toUpperCase() + resolvedSubdomain.slice(1) : "");
  const visualTenantName =
    !rawTenantName ||
      rawTenantName.toLowerCase() === "admin" ||
      rawTenantName.toLowerCase() === "localhost" ||
      rawTenantName.toLowerCase() === "root" ||
      rawTenantName.toLowerCase() === "default"
      ? (resolvedSubdomain?.toLowerCase() === "demo" ? "Demo School" : "")
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
            className={`p-4 rounded-2xl shadow-xl border backdrop-blur-xl flex items-start gap-3 transition-all duration-200 ${toastNotification.type === "error"
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
          <div className="space-y-1.5">
            {isSuperAdmin ? (
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Super Admin Login
              </h1>
            ) : tenantBranding?.name ? (
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {tenantBranding.name}
              </h1>
            ) : (
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Sign in to access your workspace
              </h1>
            )}
            {isSuperAdmin ? (
              <p className="text-xs text-slate-500">
                Enter your platform master credentials to continue
              </p>
            ) : visualTenantName && visualTenantName.toLowerCase() !== "admin" ? (
              <p className="text-xs font-medium text-slate-500">
                {visualTenantName}
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Enter your credentials to continue to your workspace
              </p>
            )}
          </div>

          {/* Core Tabless Unified Form */}
          <form onSubmit={handleSignIn} className="space-y-5" noValidate autoComplete="off">
            
            {/* 1. School Code Input (Hidden in super-admin context) */}
            {!isSuperAdmin && (
              <div className="space-y-1.5">
                <label
                  htmlFor="school-code"
                  className="block text-xs font-semibold text-slate-700"
                >
                  School Code <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="school-code"
                    type="text"
                    name="schoolCode"
                    value={schoolCode}
                    onChange={(e) => {
                      if (!resolvedSubdomain) {
                        setSchoolCode(e.target.value);
                        if (schoolCodeError) {
                          setSchoolCodeError(null);
                        }
                      }
                    }}
                    readOnly={Boolean(resolvedSubdomain)}
                    placeholder="e.g. greenspring"
                    autoComplete="off"
                    disabled={isSubmitting}
                    className={`block w-full rounded-xl border px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all duration-200 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed shadow-xs pr-10 ${
                      schoolCodeError
                        ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100 bg-white text-slate-900"
                        : resolvedSubdomain
                          ? "border-slate-200 bg-slate-100/90 text-slate-700 font-medium cursor-not-allowed select-none focus:border-indigo-600 focus:ring-indigo-100"
                          : "border-slate-200 bg-white text-slate-900 focus:border-indigo-600 focus:ring-indigo-100"
                    }`}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    {resolvedSubdomain ? (
                      <Lock className="w-4 h-4 text-slate-500" />
                    ) : (
                      <Building2 className={`w-4 h-4 ${schoolCodeError ? "text-rose-500" : ""}`} />
                    )}
                  </div>
                </div>
                {schoolCodeError && (
                  <p className="text-xs text-rose-600 font-medium flex items-center gap-1.5 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>{schoolCodeError}</span>
                  </p>
                )}
              </div>
            )}

            {/* 2. Modern Floating Label Email Input (Pure White Backdrop, Crisp Slate Border) */}
            <div className="relative group">
              <input
                id="floating-email"
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
                autoComplete="username"
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

            {/* Demo Credentials Box - Visible ONLY on Demo Tenant */}
            {isDemoTenant && (
              <div className="rounded-xl border border-sky-200/80 bg-gradient-to-br from-slate-50 via-sky-50/40 to-slate-50 p-3.5 sm:p-4 text-xs space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-sky-100">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    <span>Demo Credentials - For Evaluation Only</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                    Active Demo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Email
                    </span>
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-900 select-all">
                      <span className="truncate">{DEMO_EMAIL}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Password
                    </span>
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-900 select-all">
                      <span>{DEMO_PASSWORD}</span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <span>Role: School Administrator (Headmaster) &bull; Opens Demo Dashboard</span>
                </p>
              </div>
            )}

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

            {/* One-Click Demo Login Button - Visible ONLY on Demo Tenant */}
            {isDemoTenant && (
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 text-sky-900 font-semibold text-sm transition-all duration-200 inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-sky-100 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                    <span>Entering Demo Environment...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    <span>Login as Demo User</span>
                  </>
                )}
              </button>
            )}
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
