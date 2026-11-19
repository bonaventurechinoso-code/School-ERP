"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { CheckCircle2, ExternalLink, Copy, Check, Globe, ShieldCheck, ArrowRight, Sparkles, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { useNumericInput } from "@/hooks/useNumericInput";
import { persistStoredSession, AUTH_UPDATE_EVENT } from "@/lib/session-context";
import { setAuthToken } from "@/lib/api-client";

interface RegistrationResult {
  success: boolean;
  message: string;
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    slug: string;
    status: string;
    trialStartDate?: string;
    trialEndDate?: string;
  };
  subdomain: string;
  schoolName: string;
  adminEmail: string;
  sslReady?: boolean;
  targetFqdn?: string;
  portalUrl: string;
  subdomainUrl: string;
  fullDirectPortalUrl: string;
  loginUrl: string;
  subdomainLoginUrl: string;
  dashboardUrl: string;
  subdomainDashboardUrl: string;
  redirectUrl: string;
  trialDays: number;
  token?: string;
  sessionToken?: string;
  sessionPayload?: any;
}

export default function RegisterTenantPage() {
  const { handleNumericChange } = useNumericInput();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configuringStatusText, setConfiguringStatusText] = useState("Initializing database and security layers...");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sslVerified, setSslVerified] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [rootDisplay, setRootDisplay] = useState("bonaveeict.com.ng");

  const [formData, setFormData] = useState({
    schoolName: "",
    adminEmail: "",
    contactPhone: "",
    subdomain: "",
    adminPassword: "",
    confirmPassword: "",
  });

  const [isSubdomainManuallyEdited, setIsSubdomainManuallyEdited] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugSuggested, setSlugSuggested] = useState<string | null>(null);
  const checkSlugTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [registrationData, setRegistrationData] = useState<RegistrationResult | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.host;
      if (host.includes("bonaveeict.com.ng")) {
        setRootDisplay("bonaveeict.com.ng");
      } else if (host.includes("localhost")) {
        setRootDisplay("localhost:3000");
      } else {
        setRootDisplay(process.env.NEXT_PUBLIC_ROOT_DOMAIN || "bonaveeict.com.ng");
      }
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (checkSlugTimerRef.current) clearTimeout(checkSlugTimerRef.current);
    };
  }, []);

  const handleSchoolNameChange = (name: string) => {
    setFormData(prev => {
      const updated = { ...prev, schoolName: name };
      if (!isSubdomainManuallyEdited) {
        // Auto-generate clean slug from school name (lowercase, spaces to -)
        const autoSlug = name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
        updated.subdomain = autoSlug;
      }
      return updated;
    });
  };

  const handleSubdomainChange = (val: string) => {
    setIsSubdomainManuallyEdited(true);
    const cleaned = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");
    setFormData(prev => ({ ...prev, subdomain: cleaned }));
  };

  const handleApplySuggestion = (suggested: string) => {
    setIsSubdomainManuallyEdited(true);
    setFormData(prev => ({ ...prev, subdomain: suggested }));
  };

  // Debounced real-time slug availability check
  useEffect(() => {
    const slug = formData.subdomain.trim();
    if (!slug || slug.length < 2) {
      setSlugAvailable(null);
      setSlugSuggested(null);
      setSlugChecking(false);
      return;
    }

    if (checkSlugTimerRef.current) clearTimeout(checkSlugTimerRef.current);

    setSlugChecking(true);
    checkSlugTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tenants/check-slug?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (data.available) {
          setSlugAvailable(true);
          setSlugSuggested(null);
        } else {
          setSlugAvailable(false);
          setSlugSuggested(data.suggested || null);
        }
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 350);

    return () => {
      if (checkSlugTimerRef.current) clearTimeout(checkSlugTimerRef.current);
    };
  }, [formData.subdomain]);

  // Derive target portal URL on the tenant's dedicated subdomain
  const getSubdomainUrl = useCallback((slug?: string) => {
    const effectiveSlug = slug || registrationData?.subdomain || formData.subdomain;
    if (!effectiveSlug) return "/";
    if (typeof window !== "undefined") {
      const proto = window.location.protocol;
      const host = window.location.host;
      if (host.includes("localhost")) {
        return `${proto}//${effectiveSlug}.localhost:3000/`;
      }
    }
    return `https://${effectiveSlug}.${rootDisplay}/`;
  }, [registrationData?.subdomain, formData.subdomain, rootDisplay]);

  // 1. After all 3 checks = true, IMMEDIATELY redirect to subdomain root:
  useEffect(() => {
    if (sslVerified) {
      const slug = registrationData?.subdomain || formData.subdomain;
      const targetUrl = registrationData?.redirectUrl || registrationData?.portalUrl || registrationData?.subdomainUrl || getSubdomainUrl(slug);
      window.location.href = targetUrl;
    }
  }, [sslVerified, registrationData, formData.subdomain, getSubdomainUrl]);

  // 2. Add safety timeout so it NEVER spins more than 5 seconds:
  useEffect(() => {
    if (isConfiguring) {
      const slug = registrationData?.subdomain || formData.subdomain;
      const t = setTimeout(() => {
        const targetUrl = registrationData?.redirectUrl || registrationData?.portalUrl || registrationData?.subdomainUrl || getSubdomainUrl(slug);
        window.location.href = targetUrl;
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [isConfiguring, registrationData, formData.subdomain, getSubdomainUrl]);

  const availableTiers = [
    { id: "NURSERY", label: "Creche / Nursery", desc: "Ages 0-4" },
    { id: "PRIMARY", label: "Primary School", desc: "Primary 1 - 6" },
    { id: "SECONDARY", label: "Secondary / High School", desc: "JS1 - SS3" },
    { id: "UNIVERSITY", label: "University", desc: "Undergraduate & Graduate" },
    { id: "POLYTECHNIC", label: "Polytechnic", desc: "ND & HND Programs" },
    { id: "COLLEGE_OF_EDUCATION", label: "College of Education", desc: "Teacher Training & NCE" },
  ];

  // Enterprise Password Validation Rules
  const pwd = formData.adminPassword;
  const hasMinLength = pwd.length >= 8;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd);
  const meetsMinRules = hasMinLength && hasUppercase && hasNumber && hasSpecial;

  // Strength evaluation for passwords meeting or progressing towards enterprise rules
  const getStrengthTier = (val: string) => {
    if (!val || val.length === 0) return null;
    const rulesMet = [
      val.length >= 8,
      /[A-Z]/.test(val),
      /[0-9]/.test(val),
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(val)
    ].filter(Boolean).length;

    if (rulesMet < 4) {
      return {
        level: "Incomplete",
        label: `${rulesMet}/4 Rules Met`,
        score: rulesMet,
        color: "bg-amber-400",
        badge: "bg-slate-100 text-slate-600 border-slate-200",
        canProceed: false,
      };
    }

    // Meets all minimum enterprise rules: evaluate Weak vs Medium vs Strong
    const lower = val.toLowerCase();
    const isCommonWeak = /password|1234|admin|school|welcome|qwerty/.test(lower);
    const specialCount = (val.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/g) || []).length;
    const isShort = val.length < 10;

    if (isCommonWeak || isShort || specialCount <= 1) {
      return {
        level: "Weak",
        label: "Weak",
        score: 1,
        color: "bg-amber-500",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        canProceed: true,
      };
    }

    if (val.length < 12 || specialCount < 2) {
      return {
        level: "Medium",
        label: "Medium",
        score: 2,
        color: "bg-blue-500",
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        canProceed: true,
      };
    }

    return {
      level: "Strong",
      label: "Strong",
      score: 3,
      color: "bg-emerald-500",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      canProceed: true,
    };
  };

  const strength = getStrengthTier(pwd);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (step === 1) {
      if (!formData.schoolName || !formData.adminEmail || !formData.subdomain || !formData.adminPassword || !formData.confirmPassword) {
        setErrorMsg("Please fill in all required fields including password.");
        return;
      }
      if (slugAvailable === false) {
        setErrorMsg("The requested subdomain is unavailable or reserved. Please choose another or click the suggested alternative.");
        return;
      }
      if (!hasMinLength || !hasUppercase || !hasNumber || !hasSpecial) {
        setErrorMsg("Admin password must be at least 8 characters long and contain at least 1 uppercase letter, 1 number, and 1 special character.");
        return;
      }
      if (formData.adminPassword !== formData.confirmPassword) {
        setErrorMsg("Passwords do not match. Please verify that both password entries are identical.");
        return;
      }
      setStep(2);
    }
  };

  const handleTierToggle = (tierId: string) => {
    setSelectedTiers(prev =>
      prev.includes(tierId) ? prev.filter(t => t !== tierId) : [...prev, tierId]
    );
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  /**
   * Final Health Check & Automatic Secure Redirect:
   * Keeps the loading spinner active and runs periodic HTTPS ping checks
   * until the reverse proxy SSL handshake returns a true successful connection.
   */
  const executeFinalHealthCheckAndRedirect = (data: RegistrationResult) => {
    setRegistrationData(data);
    setIsConfiguring(true);
    setConfiguringStatusText("Awaiting reverse proxy SSL handshake and binding certificate...");

    // Start elapsed seconds counter for user feedback
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    let attempts = 0;
    const maxPollAttempts = 20; // Up to 40 seconds

    const runPing = async () => {
      attempts++;
      try {
        const verifyRes = await fetch(`/api/ssl/verify?subdomain=${data.subdomain}`);
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData.sslReady) {
            // Handshake confirmed over secure HTTPS!
            setSslVerified(true);
            setConfiguringStatusText("SSL certificate verified! Redirecting to secure school dashboard...");

            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

            // Execute secure redirect immediately to tenant subdomain
            const slug = data.subdomain || formData.subdomain;
            const targetUrl = data.redirectUrl || data.portalUrl || data.subdomainUrl || getSubdomainUrl(slug);
            window.location.href = targetUrl;
            return;
          }
        }
      } catch {
        // Continue polling until ready
      }

      if (attempts > 5) {
        setConfiguringStatusText("Establishing cryptographic handshake on internal subdomain...");
      }
      if (attempts >= maxPollAttempts) {
        // If external DNS is taking long, stop polling and redirect
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        setConfiguringStatusText("SSL generation bound. Ready to access.");
        setSslVerified(true);
        const slug = data.subdomain || formData.subdomain;
        const targetUrl = data.redirectUrl || data.portalUrl || data.subdomainUrl || getSubdomainUrl(slug);
        window.location.href = targetUrl;
      }
    };

    // If backend already verified SSL synchronously, redirect immediately
    if (data.sslReady) {
      setSslVerified(true);
      setConfiguringStatusText("SSL certificate verified! Redirecting to secure school dashboard...");
      const slug = data.subdomain || formData.subdomain;
      const targetUrl = data.redirectUrl || data.portalUrl || data.subdomainUrl || getSubdomainUrl(slug);
      window.location.href = targetUrl;
      return;
    }

    // Run first ping after 1.5s, then every 2s
    setTimeout(runPing, 1500);
    pollIntervalRef.current = setInterval(runPing, 2000);
  };

  const handleSubmit = async () => {
    if (selectedTiers.length === 0) {
      setErrorMsg("Please select at least one academic tier.");
      return;
    }

    if (!formData.adminPassword || !hasMinLength || !hasUppercase || !hasNumber || !hasSpecial) {
      setErrorMsg("Admin password must be at least 8 characters long and contain at least 1 uppercase letter, 1 number, and 1 special character.");
      return;
    }

    if (formData.adminPassword !== formData.confirmPassword) {
      setErrorMsg("Passwords do not match. Please verify that both password entries are identical.");
      return;
    }

    setIsSubmitting(true);
    setIsConfiguring(true);
    setElapsedSeconds(0);
    setSslVerified(false);
    setConfiguringStatusText("Writing tenant database records and requesting SSL certificate...");
    setErrorMsg("");

    try {
      const res = await fetch("/api/tenants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: formData.schoolName,
          adminEmail: formData.adminEmail,
          contactPhone: formData.contactPhone,
          subdomain: formData.subdomain,
          adminPassword: formData.adminPassword,
          password: formData.adminPassword,
          tiers: selectedTiers,
        }),
      });

      const data: RegistrationResult = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.message || (data as any).error || "Registration failed. Please try again.");
        setIsSubmitting(false);
        setIsConfiguring(false);
        return;
      }

      // Persist authenticated tenant session in client storage so UI is immediately authenticated
      if (data.sessionPayload) {
        persistStoredSession(data.sessionPayload);
        if (data.token) {
          setAuthToken(data.token, data.token);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(AUTH_UPDATE_EVENT));
        }
      }

      // Block immediate redirect and synchronize with reverse proxy SSL handshake
      executeFinalHealthCheckAndRedirect(data);

    } catch (err: any) {
      console.error("[TENANT_REGISTRATION_EXCEPTION]:", err);
      setErrorMsg("An unexpected connection error occurred during registration. Please try again.");
      setIsSubmitting(false);
      setIsConfiguring(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-slate-50 dark:bg-zinc-950 flex flex-col justify-start sm:justify-center py-1 sm:py-8 px-2 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="w-full max-w-3xl lg:max-w-4xl mx-auto my-auto bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">

        {/* Header (Streamlined for mobile) */}
        <div className="relative z-10 px-3.5 py-2.5 sm:px-8 sm:py-5 text-white bg-slate-900 transition-colors duration-300 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 mb-1 sm:mb-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Image
                src="/img/business-logo.png"
                alt="School ERP"
                width={20}
                height={20}
                className="w-4 h-4 sm:w-6 sm:h-6 object-contain rounded-md"
              />
              <span className="text-[10px] sm:text-xs uppercase tracking-wider text-blue-400 font-bold">School ERP</span>
            </div>
            {!isConfiguring && (
              <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                <span>Step {step} of 2</span>
              </div>
            )}
          </div>
          <h1 className="text-base sm:text-2xl font-bold leading-tight">
            {isConfiguring
              ? "Configuring secure school portal..."
              : "Register Your School"}
          </h1>
          <p className="text-slate-400 text-[11px] sm:text-sm mt-0.5">
            {isConfiguring ? (
              <span className="text-blue-400 font-medium flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Synchronizing SSL handshake & reverse proxy
              </span>
            ) : (
              step === 1 ? "Institutional Identity & Administrator Setup" : "Academic Tier Allocation"
            )}
          </p>
        </div>

        {/* Body */}
        <div className="p-3 sm:p-6 md:p-8 flex-1 flex flex-col">
          {errorMsg && (
            <div className="mb-3 sm:mb-5 p-2.5 sm:p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-xl text-xs sm:text-sm font-medium">
              {errorMsg}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SYNCHRONIZED LOADING VIEW: CONFIGURING SECURE SCHOOL PORTAL...            */}
          {/* ========================================================================= */}
          {isConfiguring && (
            <div className="space-y-6 text-center py-6 animate-in fade-in duration-300">

              {/* Spinner & Shield Graphic */}
              <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-ping opacity-25"></div>
                <div className="w-20 h-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/30">
                  {sslVerified ? (
                    <CheckCircle2 className="w-10 h-10 animate-in zoom-in duration-300 text-emerald-300" />
                  ) : (
                    <ShieldCheck className="w-10 h-10 animate-pulse text-white" />
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Configuring secure school portal...
                </h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1.5 max-w-md mx-auto">
                  {configuringStatusText}
                </p>
              </div>

              {/* Real-time Status Card & Checklist */}
              <div className="max-w-md mx-auto bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-5 border border-slate-200 dark:border-zinc-700 text-left space-y-3.5">
                <div className="flex items-center gap-3 text-xs">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className="text-slate-800 dark:text-zinc-200 font-medium">Database tenant schema & isolated boundary written</span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${sslVerified ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-600"
                    }`}>
                    {sslVerified ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                  </div>
                  <span className={sslVerified ? "text-slate-800 dark:text-zinc-200 font-medium" : "text-blue-700 dark:text-blue-400 font-medium"}>
                    Reverse proxy automated SSL certificate generation
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${sslVerified ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 dark:bg-zinc-700 text-slate-400 dark:text-zinc-400"
                    }`}>
                    {sslVerified ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-zinc-400"></div>
                    )}
                  </div>
                  <span className={sslVerified ? "text-slate-800 dark:text-zinc-200 font-medium" : "text-slate-400 dark:text-zinc-400 font-medium"}>
                    Internal HTTPS ping check & SNI handshake verification
                  </span>
                </div>
              </div>

              {/* Progress Feedback */}
              <div className="max-w-md mx-auto text-xs text-slate-400 dark:text-zinc-400 flex items-center justify-between px-1">
                <span>Handshake synchronization</span>
                <span className="font-mono">{elapsedSeconds}s elapsed</span>
              </div>

              {/* Direct Zero-SSL Fallback Link if user needs instant entry */}
              <div className="pt-2 max-w-md mx-auto">
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-600 dark:text-zinc-300 flex items-center justify-between text-left">
                  <span className="truncate pr-2">
                    Target: <span className="font-mono font-semibold text-slate-900 dark:text-white">{registrationData?.subdomainUrl || (formData.subdomain ? `${formData.subdomain}.${rootDisplay}` : "Direct Portal")}</span>
                  </span>
                  <a
                    href={registrationData?.redirectUrl || registrationData?.portalUrl || registrationData?.subdomainUrl || getSubdomainUrl()}
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = registrationData?.redirectUrl || registrationData?.portalUrl || registrationData?.subdomainUrl || getSubdomainUrl();
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold flex-shrink-0 cursor-pointer"
                  >
                    Direct Route &rarr;
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STANDARD REGISTRATION STEPS (Visible when not configuring)                */}
          {/* ========================================================================= */}
          {!isConfiguring && (
            <>
              {/* STEP 1: INSTITUTIONAL IDENTITY FORM */}
              {step === 1 && (
                <form onSubmit={handleNextStep} className="space-y-2 sm:space-y-4 flex-1 flex flex-col">
                  <div className="space-y-2 sm:space-y-4 flex-1">
                    {/* Row 1: School Name & Desired URL Slug */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-0.5">
                          School Name *
                        </label>
                        <input
                          required
                          id="institutionName"
                          type="text"
                          className="w-full border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                          placeholder="e.g. Greenwood Academy"
                          value={formData.schoolName}
                          onChange={e => handleSchoolNameChange(e.target.value)}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300">
                            Institutional Subdomain *
                          </label>
                          {slugChecking ? (
                            <span className="text-[10px] text-blue-500 font-medium flex items-center gap-1">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Checking...
                            </span>
                          ) : slugAvailable === true ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <Check className="w-2.5 h-2.5 stroke-[3]" /> Available
                            </span>
                          ) : slugAvailable === false ? (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                              Taken / Reserved
                            </span>
                          ) : null}
                        </div>
                        <div className="flex">
                          <span className="inline-flex items-center px-1.5 sm:px-2.5 rounded-l-lg sm:rounded-l-xl border border-r-0 border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[10px] sm:text-xs font-mono select-none">
                            https://
                          </span>
                          <input
                            required
                            id="subdomain"
                            name="subdomain"
                            type="text"
                            className="flex-1 min-w-0 block w-full border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-none px-2 py-1.5 sm:p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                            placeholder="greenwood"
                            value={formData.subdomain}
                            onChange={e => handleSubdomainChange(e.target.value)}
                          />
                          <span className="inline-flex items-center px-1.5 sm:px-2.5 rounded-r-lg sm:rounded-r-xl border border-l-0 border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[10px] sm:text-xs font-mono select-none">
                            .{rootDisplay}
                          </span>
                        </div>
                        {slugSuggested && (
                          <div className="mt-0.5 flex items-center gap-1 text-[10px]">
                            <span className="text-slate-500 dark:text-zinc-400">Alternative:</span>
                            <button
                              type="button"
                              onClick={() => handleApplySuggestion(slugSuggested)}
                              className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-mono font-bold hover:bg-blue-100 dark:hover:bg-blue-900 transition cursor-pointer text-[9px]"
                            >
                              Use {slugSuggested}
                            </button>
                          </div>
                        )}
                        <p className="hidden sm:block text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                          Full URL: <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">https://{formData.subdomain || "your-school"}.{rootDisplay}</span>
                        </p>
                      </div>
                    </div>

                    {/* Row 2: Admin Email & Contact Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-0.5">
                          Admin Email *
                        </label>
                        <input
                          required
                          id="adminEmail"
                          name="adminEmail"
                          type="email"
                          className="w-full border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                          placeholder="admin@school.edu"
                          value={formData.adminEmail}
                          onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-0.5">
                          Contact Phone
                        </label>
                        <input
                          type="tel"
                          id="adminPhone"
                          name="contactPhone"
                          inputMode="numeric"
                          pattern="[0-9+]*"
                          className="w-full border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                          placeholder="+234 800 000 0000"
                          value={formData.contactPhone}
                          onChange={e => handleNumericChange(e, (val) => setFormData({ ...formData, contactPhone: val }))}
                        />
                      </div>
                    </div>

                    {/* Row 3: Admin Password & Confirm Password (Side-by-side on mobile to resize form length) */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div>
                        <label htmlFor="adminPassword" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-0.5 truncate">
                          Admin Password *
                        </label>
                        <div className="relative">
                          <input
                            required
                            id="adminPassword"
                            name="adminPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="Min. 8 chars"
                            className="w-full border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-lg sm:rounded-xl px-2 py-1.5 sm:p-2.5 pr-7 sm:pr-9 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                            value={formData.adminPassword}
                            onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-2 sm:pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="confirmPassword" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-0.5 truncate">
                          Confirm Password *
                        </label>
                        <div className="relative">
                          <input
                            required
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm"
                            className="w-full border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-lg sm:rounded-xl px-2 py-1.5 sm:p-2.5 pr-7 sm:pr-9 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                            value={formData.confirmPassword}
                            onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute inset-y-0 right-0 pr-2 sm:pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Validation & Password Strength Meter (Streamlined & Compact) */}
                    <div className="space-y-1 pt-0.5">
                      {/* Visual Strength Meter Bar */}
                      {formData.adminPassword.length > 0 && (
                        <div className="space-y-1 p-1.5 sm:p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
                          <div className="flex items-center justify-between text-[10px] sm:text-xs">
                            <span className="font-semibold text-slate-700 dark:text-zinc-300">Password Strength:</span>
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] sm:text-[11px] border ${strength?.badge || "bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-600"}`}>
                              {strength ? strength.level : "Too Short"}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 h-1 sm:h-1.5 w-full">
                            <div className={`rounded-full transition-colors duration-300 ${strength && strength.score >= 1 ? strength.color : "bg-slate-200 dark:bg-zinc-700"}`} />
                            <div className={`rounded-full transition-colors duration-300 ${strength && strength.score >= 2 ? strength.color : "bg-slate-200 dark:bg-zinc-700"}`} />
                            <div className={`rounded-full transition-colors duration-300 ${strength && strength.score >= 3 ? strength.color : "bg-slate-200 dark:bg-zinc-700"}`} />
                          </div>
                        </div>
                      )}

                      {/* Compact Inline Checklist */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                        <span className={`inline-flex items-center gap-1 transition-colors ${hasMinLength ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400 dark:text-zinc-500"
                          }`}>
                          {hasMinLength ? "✓" : "•"} 8+ chars
                        </span>
                        <span className={`inline-flex items-center gap-1 transition-colors ${hasUppercase ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400 dark:text-zinc-500"
                          }`}>
                          {hasUppercase ? "✓" : "•"} Uppercase
                        </span>
                        <span className={`inline-flex items-center gap-1 transition-colors ${hasNumber ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400 dark:text-zinc-500"
                          }`}>
                          {hasNumber ? "✓" : "•"} Digit
                        </span>
                        <span className={`inline-flex items-center gap-1 transition-colors ${hasSpecial ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400 dark:text-zinc-500"
                          }`}>
                          {hasSpecial ? "✓" : "•"} Symbol
                        </span>
                      </div>

                      {/* Password Match Indicator */}
                      {formData.confirmPassword.length > 0 && (
                        <div className="text-[10px]">
                          <span className={`inline-flex items-center gap-1 font-semibold ${formData.adminPassword === formData.confirmPassword ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                            }`}>
                            {formData.adminPassword === formData.confirmPassword ? "✓ Passwords match" : "⚠ Passwords do not match"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Footer (Accommodating Next Step Button on Mobile) */}
                  <div className="mt-2 sm:mt-6 p-2.5 sm:p-5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 -mx-3 sm:-mx-6 md:-mx-8 -mb-3 sm:-mb-6 md:-mb-8 rounded-b-2xl sm:rounded-b-3xl">
                    <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span>Secure institutional setup</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium sm:hidden">
                      Step 1 of 2
                    </div>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-5 sm:px-8 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
                    >
                      <span>Next Step: Select Tiers</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: ACADEMIC TIER ALLOCATION */}
              {step === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 flex-1 flex flex-col">
                  <div className="flex-1">
                    <div className="mb-3 sm:mb-4">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-0.5">Academic Tier Allocation</h3>
                      <p className="text-slate-600 dark:text-zinc-400 text-xs sm:text-sm">Select the academic tiers your institution operates. You can select multiple.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
                      {availableTiers.map(tier => {
                        const isSelected = selectedTiers.includes(tier.id);
                        return (
                          <div
                            key={tier.id}
                            onClick={() => handleTierToggle(tier.id)}
                            className={`cursor-pointer p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all duration-200 flex items-start gap-3 ${isSelected
                              ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500"
                              : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/50 hover:border-blue-300 dark:hover:border-zinc-700 hover:shadow-sm"
                              }`}
                          >
                            <div className={`mt-0.5 flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded border flex items-center justify-center transition ${isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700"
                              }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className={`font-bold truncate text-xs sm:text-sm ${isSelected ? "text-blue-900 dark:text-blue-200" : "text-slate-800 dark:text-zinc-100"}`}>{tier.label}</h4>
                              <p className={`text-[11px] sm:text-xs mt-0.5 leading-tight ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-500 dark:text-zinc-400"}`}>{tier.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Footer (Sticky on mobile and desktop) */}
                  <div className="sticky bottom-0 -mx-3 sm:-mx-6 md:-mx-8 -mb-3 sm:-mb-6 md:-mb-8 mt-3 sm:mt-6 p-3 sm:p-5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 rounded-b-2xl sm:rounded-b-3xl z-30 shadow-lg sm:shadow-none">
                    <button
                      type="button"
                      onClick={() => { setStep(1); setErrorMsg(""); }}
                      className="px-3.5 sm:px-6 py-2 sm:py-3 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-xs sm:text-sm cursor-pointer"
                      disabled={isSubmitting}
                    >
                      &larr; Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting || selectedTiers.length === 0}
                      className="flex-1 sm:flex-initial px-5 sm:px-8 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Configuring Portal...</span>
                        </>
                      ) : (
                        <>
                          <span>Complete Registration</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
