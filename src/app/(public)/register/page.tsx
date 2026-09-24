"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Copy, Check, Globe, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
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
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);

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

      // Success: Present the dedicated Registration Successful confirmation UI
      setRegistrationResult(data);
      setIsSubmitting(false);

    } catch (err: any) {
      console.error("[TENANT_REGISTRATION_EXCEPTION]:", err);
      setErrorMsg("An unexpected connection error occurred during registration. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Link href="/" className="absolute top-8 left-8 text-slate-500 hover:text-slate-800 font-medium transition-colors">
        &larr; Back to Home
      </Link>
      
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
        
        {/* Header */}
        <div className={`px-5 py-5 md:px-8 md:py-6 text-white transition-colors duration-300 ${
          registrationResult ? "bg-slate-900" : "bg-slate-900"
        }`}>
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
            {registrationResult ? "Registration Successful" : "Register Your School"}
          </h1>
          <p className="text-slate-400 mt-1">
            {registrationResult ? (
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
          {/* STEP 3: SUCCESS CONFIRMATION STATE (Prevents hanging / kickout)           */}
          {/* ========================================================================= */}
          {registrationResult ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Status Banner */}
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-emerald-950">
                    {registrationResult.schoolName} is Ready!
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
                    Active
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
                      Direct Zero-SSL Fallback Route:
                    </span>
                    <span className="text-[11px] text-slate-400">Instant Access Guaranteed</span>
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
                    Note: Automated dynamic SSL certificates are triggered instantly for your subdomain. If your browser encounters an SNI propagation delay on custom DNS, use the Direct Zero-SSL Fallback route above for immediate entry.
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
                    <span className="text-xs text-slate-500 block">Subscription Tier:</span>
                    <span className="font-semibold text-emerald-700">14-Day Full Access Trial</span>
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
          ) : (
            <>
              {/* ========================================================================= */}
              {/* STEP 1: INSTITUTIONAL IDENTITY FORM                                       */}
              {/* ========================================================================= */}
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

              {/* ========================================================================= */}
              {/* STEP 2: ACADEMIC TIER ALLOCATION                                          */}
              {/* ========================================================================= */}
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
                          Provisioning Workspace & SSL...
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
