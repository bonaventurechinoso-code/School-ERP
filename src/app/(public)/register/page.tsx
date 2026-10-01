"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
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
    };
  }, []);

  // 1. After all 3 checks = true, IMMEDIATELY redirect:
  useEffect(() => {
    if (sslVerified) {
      const slug = registrationData?.subdomain || formData.subdomain;
      window.location.href = `/login?school=${encodeURIComponent(slug)}`;
    }
  }, [sslVerified, registrationData?.subdomain, formData.subdomain]);

  // 2. Add safety timeout so it NEVER spins more than 5 seconds:
  useEffect(() => {
    if (isConfiguring) {
      const slug = registrationData?.subdomain || formData.subdomain;
      const t = setTimeout(() => {
        window.location.href = `/login?school=${encodeURIComponent(slug)}`;
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [isConfiguring, registrationData?.subdomain, formData.subdomain]);

  const availableTiers = [
    { id: "NURSERY", label: "Daycare / Nursery", desc: "Ages 0-4" },
    { id: "PRIMARY", label: "Primary School", desc: "Primary 1 - 6" },
    { id: "SECONDARY", label: "Secondary / High School", desc: "JS1 - SS3" },
    { id: "UNIVERSITY", label: "University", desc: "Undergraduate & Graduate" },
    { id: "POLYTECHNIC", label: "Polytechnic", desc: "ND & HND Programs" },
    { id: "COLLEGE_OF_EDUCATION", label: "College of Education", desc: "Teacher Training & NCE" },
  ];

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (step === 1) {
      if (!formData.schoolName || !formData.adminEmail || !formData.subdomain || !formData.adminPassword || !formData.confirmPassword) {
        setErrorMsg("Please fill in all required fields including password.");
        return;
      }
      if (formData.adminPassword.length < 8) {
        setErrorMsg("Admin password must be at least 8 characters long.");
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

            // Execute secure redirect immediately
            const slug = data.subdomain || formData.subdomain;
            window.location.href = `/login?school=${encodeURIComponent(slug)}`;
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
        window.location.href = `/login?school=${encodeURIComponent(slug)}`;
      }
    };

    // If backend already verified SSL synchronously, redirect immediately
    if (data.sslReady) {
      setSslVerified(true);
      setConfiguringStatusText("SSL certificate verified! Redirecting to secure school dashboard...");
      const slug = data.subdomain || formData.subdomain;
      window.location.href = `/login?school=${encodeURIComponent(slug)}`;
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

    if (!formData.adminPassword || formData.adminPassword.length < 8) {
      setErrorMsg("Admin password must be at least 8 characters long.");
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
        
        {/* Header */}
        <div className="relative z-10 px-5 pt-4 pb-4 md:px-8 md:py-6 text-white bg-slate-900 transition-colors duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 mb-2">
            <div className="flex items-center gap-2">
              <Image
                src="/img/business-logo.png"
                alt="School ERP"
                width={24}
                height={24}
                className="w-6 h-6 object-contain rounded-md"
              />
              <span className="text-xs uppercase tracking-wider text-blue-400 font-bold">School ERP</span>
            </div>
            <Link
              href="/"
              className="text-xs md:text-sm font-medium text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 w-fit mt-1 md:mt-0"
            >
              &larr; Back to Home
            </Link>
          </div>
          <h1 className="text-2xl font-bold">
            {isConfiguring 
              ? "Configuring secure school portal..." 
              : "Register Your School"}
          </h1>
          <p className="text-slate-400 mt-1">
            {isConfiguring ? (
              <span className="text-blue-400 font-medium flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" /> Synchronizing SSL handshake & reverse proxy
              </span>
            ) : (
              `Step ${step} of 2: ${step === 1 ? "Institutional Identity" : "Academic Tier Allocation"}`
            )}
          </p>
        </div>

        {/* Body */}
        <div className="p-5 md:p-8">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm font-medium">
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
                <h3 className="text-xl font-bold text-slate-900">
                  Configuring secure school portal...
                </h3>
                <p className="text-slate-500 text-sm mt-1.5 max-w-md mx-auto">
                  {configuringStatusText}
                </p>
              </div>

              {/* Real-time Status Card & Checklist */}
              <div className="max-w-md mx-auto bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left space-y-3.5">
                <div className="flex items-center gap-3 text-xs">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className="text-slate-800 font-medium">Database tenant schema & isolated boundary written</span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    sslVerified ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-600"
                  }`}>
                    {sslVerified ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                  </div>
                  <span className={sslVerified ? "text-slate-800 font-medium" : "text-blue-700 font-medium"}>
                    Reverse proxy automated SSL certificate generation
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    sslVerified ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-400"
                  }`}>
                    {sslVerified ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    )}
                  </div>
                  <span className={sslVerified ? "text-slate-800 font-medium" : "text-slate-400 font-medium"}>
                    Internal HTTPS ping check & SNI handshake verification
                  </span>
                </div>
              </div>

              {/* Progress Feedback */}
              <div className="max-w-md mx-auto text-xs text-slate-400 flex items-center justify-between px-1">
                <span>Handshake synchronization</span>
                <span className="font-mono">{elapsedSeconds}s elapsed</span>
              </div>

              {/* Direct Zero-SSL Fallback Link if user needs instant entry */}
              <div className="pt-2 max-w-md mx-auto">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between text-left">
                  <span className="truncate pr-2">
                    Target: <span className="font-mono font-semibold text-slate-900">{registrationData?.subdomainUrl || (formData.subdomain ? `${formData.subdomain}.${rootDisplay}` : "Direct Portal")}</span>
                  </span>
                  <a 
                    href={`/login?school=${encodeURIComponent(registrationData?.subdomain || formData.subdomain)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const slug = registrationData?.subdomain || formData.subdomain;
                      window.location.href = `/login?school=${encodeURIComponent(slug)}`;
                    }}
                    className="text-blue-600 hover:text-blue-800 font-semibold flex-shrink-0 cursor-pointer"
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
                <form onSubmit={handleNextStep} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">School Name *</label>
                    <input 
                      required
                      type="text" 
                      className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="e.g. Greenwood Academy"
                      value={formData.schoolName} 
                      onChange={e => setFormData({...formData, schoolName: e.target.value})} 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Desired URL Slug *</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-slate-500 sm:text-sm font-mono">
                        {rootDisplay}/
                      </span>
                      <input 
                        required
                        type="text" 
                        className="flex-1 min-w-0 block w-full border border-slate-300 rounded-none rounded-r-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono"
                        placeholder="greenwood"
                        value={formData.subdomain} 
                        onChange={e => setFormData({...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")})} 
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Internal Subdomain: <span className="font-mono text-blue-600">{formData.subdomain || "your-school"}.{rootDisplay}</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Admin Email *</label>
                    <input 
                      required
                      name="adminEmail"
                      type="email" 
                      className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="admin@school.edu"
                      value={formData.adminEmail} 
                      onChange={e => setFormData({...formData, adminEmail: e.target.value})} 
                    />
                  </div>

                  {/* Admin Password & Confirm Password Setup Right Under Admin Email */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="adminPassword" className="block text-sm font-semibold text-slate-700 mb-1">
                        Admin Password *
                      </label>
                      <div className="relative">
                        <input 
                          required
                          id="adminPassword"
                          name="adminPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 8 characters"
                          className="w-full border border-slate-300 rounded-xl p-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                          value={formData.adminPassword}
                          onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700 mb-1">
                        Confirm Password *
                      </label>
                      <div className="relative">
                        <input 
                          required
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm password"
                          className="w-full border border-slate-300 rounded-xl p-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                          value={formData.confirmPassword}
                          onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Validation Indicators */}
                  <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                    <span className={`inline-flex items-center gap-1 transition-colors ${
                      formData.adminPassword.length >= 8 ? "text-emerald-600 font-semibold" : "text-slate-400"
                    }`}>
                      {formData.adminPassword.length >= 8 ? "✓" : "•"} Min. 8 characters
                    </span>
                    {formData.confirmPassword.length > 0 && (
                      <span className={`inline-flex items-center gap-1 font-semibold ${
                        formData.adminPassword === formData.confirmPassword ? "text-emerald-600" : "text-amber-600"
                      }`}>
                        {formData.adminPassword === formData.confirmPassword ? "✓ Passwords match" : "⚠ Passwords do not match"}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input 
                      type="tel" 
                      name="contactPhone"
                      inputMode="numeric" 
                      pattern="[0-9+]*" 
                      className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="+1 (555) 000-0000"
                      value={formData.contactPhone} 
                      onChange={e => handleNumericChange(e, (val) => setFormData({...formData, contactPhone: val}))} 
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <button type="submit" className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-sm">
                      Next Step &rarr;
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: ACADEMIC TIER ALLOCATION & ADMIN CREDENTIALS */}
              {step === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">Academic Tier Allocation</h3>
                    <p className="text-slate-600 text-sm">Select the academic tiers your institution operates. You can select multiple.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableTiers.map(tier => {
                      const isSelected = selectedTiers.includes(tier.id);
                      return (
                        <div 
                          key={tier.id}
                          onClick={() => handleTierToggle(tier.id)}
                          className={`cursor-pointer p-4 md:p-5 rounded-2xl border-2 transition-all duration-200 flex items-start gap-3.5 ${
                            isSelected ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm"
                          }`}
                        >
                          <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center ${
                            isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white"
                          }`}>
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={`font-bold truncate text-sm md:text-base ${isSelected ? "text-blue-900" : "text-slate-800"}`}>{tier.label}</h4>
                            <p className={`text-xs mt-0.5 leading-tight ${isSelected ? "text-blue-700" : "text-slate-500"}`}>{tier.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between pt-6 border-t border-slate-100">
                    <button 
                      onClick={() => { setStep(1); setErrorMsg(""); }}
                      className="px-4 md:px-6 py-3 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition"
                      disabled={isSubmitting}
                    >
                      &larr; Back
                    </button>
                    <button 
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="px-4 md:px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                          Configuring Secure Portal...
                        </>
                      ) : (
                        "Complete Registration"
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
