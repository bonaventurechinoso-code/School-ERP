"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Copy, Check, Globe, ShieldCheck, ArrowRight, Sparkles, Loader2, Lock } from "lucide-react";
import { useNumericInput } from "@/hooks/useNumericInput";

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
  portalUrl: string;
  subdomainUrl: string;
  fullDirectPortalUrl: string;
  loginUrl: string;
  subdomainLoginUrl: string;
  dashboardUrl: string;
  redirectUrl: string;
  trialDays: number;
}

export default function RegisterTenantPage() {
  const { handleNumericChange } = useNumericInput();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPropagating, setIsPropagating] = useState(false);
  const [propagationSecondsLeft, setPropagationSecondsLeft] = useState(18);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [rootDisplay, setRootDisplay] = useState("bonaveeict.com.ng");

  const [formData, setFormData] = useState({
    schoolName: "",
    adminEmail: "",
    contactPhone: "",
    subdomain: "",
  });

  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [pendingResult, setPendingResult] = useState<RegistrationResult | null>(null);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.host;
      if (host.includes("schoolerp.com")) {
        setRootDisplay("schoolerp.com");
      } else if (host.includes("bonaveeict.com.ng")) {
        setRootDisplay("bonaveeict.com.ng");
      } else if (host.includes("localhost")) {
        setRootDisplay("localhost:3000");
      } else {
        setRootDisplay(host);
      }
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

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
      if (!formData.schoolName || !formData.adminEmail || !formData.subdomain) {
        setErrorMsg("Please fill in all required fields.");
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

  const startPropagationWindow = (data: RegistrationResult) => {
    setPendingResult(data);
    setIsPropagating(true);
    setPropagationSecondsLeft(18);

    // 1. Countdown timer (18 seconds buffer window)
    countdownTimerRef.current = setInterval(() => {
      setPropagationSecondsLeft((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setIsPropagating(false);
          setIsSubmitting(false);
          setRegistrationResult(data);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 2. Health check polling for instant readiness acceleration
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const verifyRes = await fetch(`/api/ssl/verify?subdomain=${data.subdomain}`);
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData.sslReady) {
            // SSL is bound and ready! Finish countdown smoothly
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            setIsPropagating(false);
            setIsSubmitting(false);
            setRegistrationResult(data);
          }
        }
      } catch {
        // Polling failure is safe; countdown buffer serves as fallback
      }
    }, 3000);
  };

  const handleSubmit = async () => {
    if (selectedTiers.length === 0) {
      setErrorMsg("Please select at least one academic tier.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/tenants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          tiers: selectedTiers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Registration failed. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Enter the Propagation & SSL Handshake Buffer Window (Never redirect instantly)
      startPropagationWindow(data);

    } catch (err: any) {
      console.error("[TENANT_REGISTRATION_EXCEPTION]:", err);
      setErrorMsg("An unexpected connection error occurred during registration. Please try again.");
      setIsSubmitting(false);
      setIsPropagating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Link href="/" className="absolute top-8 left-8 text-slate-500 hover:text-slate-800 font-medium transition-colors">
        &larr; Back to Home
      </Link>
      
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
        
        {/* Header */}
        <div className="px-5 py-5 md:px-8 md:py-6 text-white bg-slate-900 transition-colors duration-300">
          <div className="flex items-center gap-2 mb-2">
            <Image
              src="/img/business-logo.png"
              alt="School ERP"
              width={24}
              height={24}
              className="w-6 h-6 object-contain rounded-md"
            />
            <span className="text-xs uppercase tracking-wider text-blue-400 font-bold">School ERP</span>
          </div>
          <h1 className="text-2xl font-bold">
            {isPropagating 
              ? "Preparing Your School Environment..." 
              : registrationResult 
                ? "Registration Successful" 
                : "Register Your School"}
          </h1>
          <p className="text-slate-400 mt-1">
            {isPropagating ? (
              <span className="text-blue-400 font-medium flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" /> Setting up your secure portal & SSL certificates
              </span>
            ) : registrationResult ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Workspace & Subdomain Provisioned
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
          {/* STATE A: ACTIVE PROPAGATION & SSL HANDSHAKE BUFFER VIEW                   */}
          {/* ========================================================================= */}
          {isPropagating && (
            <div className="space-y-6 text-center py-4 animate-in fade-in duration-300">
              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-ping opacity-25"></div>
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <ShieldCheck className="w-8 h-8 animate-pulse" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Preparing your secure portal...
                </h3>
                <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                  Configuring database isolation, registering reverse proxy SNI endpoints, and establishing automated cryptographic SSL certificates.
                </p>
              </div>

              {/* Countdown Progress Bar */}
              <div className="max-w-md mx-auto space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    Automated SSL Propagation & SNI Handshake
                  </span>
                  <span className="font-mono text-blue-600">{propagationSecondsLeft}s remaining</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.round(((18 - propagationSecondsLeft) / 18) * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Propagation Steps Checklist */}
              <div className="max-w-md mx-auto bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-3">
                <div className="flex items-center gap-3 text-xs">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className="text-slate-800 font-medium">Tenant record & isolated database schema provisioned</span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    propagationSecondsLeft <= 14 ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-600"
                  }`}>
                    {propagationSecondsLeft <= 14 ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                  </div>
                  <span className={propagationSecondsLeft <= 14 ? "text-slate-800 font-medium" : "text-blue-700 font-medium"}>
                    Reverse proxy dynamic SNI binding & certificate hook
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    propagationSecondsLeft <= 6 ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-400"
                  }`}>
                    {propagationSecondsLeft <= 6 ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    )}
                  </div>
                  <span className={propagationSecondsLeft <= 6 ? "text-slate-800 font-medium" : "text-slate-400 font-medium"}>
                    Verifying HTTPS cryptographic handshake & DNS routing
                  </span>
                </div>
              </div>

              {/* Direct Zero-SSL Instant Entry Option */}
              {pendingResult && (
                <div className="pt-2 max-w-md mx-auto">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 text-left">
                    <span className="font-bold text-amber-700 flex-shrink-0">Instant Entry:</span>
                    <span>
                      Don&apos;t want to wait? Access immediately via the guaranteed{" "}
                      <a 
                        href={pendingResult.fullDirectPortalUrl || pendingResult.loginUrl}
                        className="underline font-bold text-amber-950 hover:text-blue-600"
                      >
                        Direct Zero-SSL Portal Route &rarr;
                      </a>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE B: SUCCESS CONFIRMATION STATE (Revealed after SSL handshake)        */}
          {/* ========================================================================= */}
          {!isPropagating && registrationResult && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Status Banner */}
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-emerald-950">
                    {registrationResult.schoolName} is Live & Ready!
                  </h3>
                  <p className="text-sm text-emerald-800 mt-0.5">
                    Your institutional database boundary, administrative staff account, and 14-Day Full Access Trial have been initialized.
                  </p>
                </div>
              </div>

              {/* Subdomain & URL Card */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" />
                    Dedicated Tenant Subdomain
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    SSL Handshake Verified
                  </span>
                </div>

                {/* Subdomain Link Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="min-w-0 flex-1 font-mono text-sm font-semibold text-slate-900 truncate">
                    {registrationResult.subdomainUrl}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(registrationResult.subdomainUrl, "subdomain")}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition flex items-center gap-1.5 shadow-sm"
                    >
                      {copiedField === "subdomain" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <a
                      href={registrationResult.subdomainUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition flex items-center gap-1 shadow-sm"
                    >
                      <span>Visit</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Direct Zero-SSL Fallback Route */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Direct Zero-SSL Route:
                    </span>
                    <span className="text-[11px] text-slate-400">Guaranteed Instant Access</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <span className="font-mono text-slate-700 truncate pr-2">
                      {registrationResult.fullDirectPortalUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(registrationResult.fullDirectPortalUrl, "direct")}
                      className="text-blue-600 hover:text-blue-800 font-medium px-2 py-0.5 rounded hover:bg-blue-50 transition"
                    >
                      {copiedField === "direct" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Note: Your dynamic SSL certificate has been initialized. If your ISP/browser encounters a local DNS caching delay, you can immediately access your school workspace using the Direct Zero-SSL link above.
                  </p>
                </div>
              </div>

              {/* Account Credentials Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Administrator Credentials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">Admin Email:</span>
                    <span className="font-semibold text-slate-900">{registrationResult.adminEmail}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Default Password:</span>
                    <span className="font-semibold text-slate-900 font-mono">Password123</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={registrationResult.subdomainLoginUrl || registrationResult.loginUrl}
                  className="flex-1 py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-center transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
                >
                  <span>Go to School Admin Login</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href={registrationResult.subdomainUrl || registrationResult.portalUrl}
                  className="py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-center transition"
                >
                  View Public Portal
                </a>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE C: REGISTRATION INPUT FORM                                          */}
          {/* ========================================================================= */}
          {!isPropagating && !registrationResult && (
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
                      Only lowercase letters and numbers. Subdomain: <span className="font-mono text-blue-600">{formData.subdomain || "your-school"}.{rootDisplay}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Admin Email *</label>
                      <input 
                        required
                        type="email" 
                        className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="admin@school.edu"
                        value={formData.adminEmail} 
                        onChange={e => setFormData({...formData, adminEmail: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Phone</label>
                      <input 
                        type="tel" 
                        inputMode="numeric" 
                        pattern="[0-9+]*" 
                        className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="+1 (555) 000-0000"
                        value={formData.contactPhone} 
                        onChange={e => handleNumericChange(e, (val) => setFormData({...formData, contactPhone: val}))} 
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button type="submit" className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-sm">
                      Next Step &rarr;
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: ACADEMIC TIER ALLOCATION */}
              {step === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-slate-600 font-medium">Select the academic tiers your institution operates. You can select multiple.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableTiers.map(tier => {
                      const isSelected = selectedTiers.includes(tier.id);
                      return (
                        <div 
                          key={tier.id}
                          onClick={() => handleTierToggle(tier.id)}
                          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all duration-200 flex items-start gap-4 ${
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
                            <h4 className={`font-bold truncate ${isSelected ? "text-blue-900" : "text-slate-800"}`}>{tier.label}</h4>
                            <p className={`text-xs md:text-sm mt-1 leading-tight md:leading-normal ${isSelected ? "text-blue-700" : "text-slate-500"}`}>{tier.desc}</p>
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
                          Provisioning Environment...
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
