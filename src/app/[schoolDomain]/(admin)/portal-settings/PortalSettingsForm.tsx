"use client";

import React, { useState, useEffect, useTransition } from "react";
import { updatePortalSettings } from "./actions";
import { NIGERIAN_BANKS } from "@/lib/nigerian-banks";
import { 
  Globe, 
  FileText, 
  GraduationCap, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink, 
  Phone, 
  School, 
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Landmark,
  CreditCard,
  Building2,
  Calendar,
  AlertTriangle,
  Info,
  Clock,
  ArrowRight
} from "lucide-react";

export interface PortalSettingsFormProps {
  schoolId: string;
  subdomain: string;
  initialName: string;
  initialPhone: string;
  initialIsPublic: boolean;
  initialGreeting: string;
  academicTiers?: string[];
  initialBankName?: string;
  initialBankCode?: string;
  initialAccountNumber?: string;
  initialAccountName?: string;
  initialPaymentInstruction?: string;
}

export default function PortalSettingsForm({
  schoolId,
  subdomain,
  initialName,
  initialPhone,
  initialIsPublic,
  initialGreeting,
  academicTiers = [],
  initialBankName = "",
  initialBankCode = "",
  initialAccountNumber = "",
  initialAccountName = "",
  initialPaymentInstruction = "Use Student Admission No as transfer narration",
}: PortalSettingsFormProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"branding" | "bank" | "academic">("branding");

  // Tab 1: Institutional & Public Portal
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [greeting, setGreeting] = useState(initialGreeting || "");

  // Tab 2: Direct Commercial Bank Settlement (Manual Bank Transfer Engine)
  const [bankName, setBankName] = useState(initialBankName || "");
  const [bankCode, setBankCode] = useState(initialBankCode || "");
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber || "");
  const [accountName, setAccountName] = useState(initialAccountName || "");
  const [paymentInstruction, setPaymentInstruction] = useState(initialPaymentInstruction);

  // Tab 3: Academic Session & Calendar State
  const [academicSession, setAcademicSession] = useState("2026/2027");
  const [academicTerm, setAcademicTerm] = useState("First Term");
  const [nextTermResumption, setNextTermResumption] = useState("2027-01-11");

  // Feedback and UI state
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(`${window.location.protocol}//${window.location.host}`);
    }
  }, []);

  const isBankConfigured = Boolean(bankName && accountNumber.length === 10 && accountName.trim());

  // Public Gateway shortcuts
  const gateways = [
    {
      key: "landing",
      title: "Public School Landing",
      description: "Institutional showcase with curriculum tiers, admissions hotline, and campus overview.",
      badge: "Public Portal",
      badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      icon: Globe,
      path: `/${subdomain}`,
      url: `${origin}/${subdomain}`,
      primaryActionLabel: "Visit Landing",
      buttonBg: "bg-blue-600 hover:bg-blue-700 text-white"
    },
    {
      key: "apply",
      title: "Online Application Form",
      description: "Direct prospective parents and candidates to start or check admission applications.",
      badge: "Admissions",
      badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      icon: FileText,
      path: `/${subdomain}/apply`,
      url: `${origin}/${subdomain}/apply`,
      primaryActionLabel: "Open Form",
      buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white"
    },
    {
      key: "student",
      title: "Student Portal Workspace",
      description: "Direct workspace for enrolled students to access timetables, subjects, and report cards.",
      badge: "Students",
      badgeColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
      icon: GraduationCap,
      path: `/${subdomain}/portal/student`,
      url: `${origin}/${subdomain}/portal/student`,
      primaryActionLabel: "Open Workspace",
      buttonBg: "bg-indigo-600 hover:bg-indigo-700 text-white"
    },
    {
      key: "staff",
      title: "Faculty & Staff Sign-In",
      description: "Dedicated portal login gateway for teachers, administrative staff, and management.",
      badge: "Faculty",
      badgeColor: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
      icon: ShieldCheck,
      path: `/${subdomain}/login`,
      url: `${origin}/${subdomain}/login`,
      primaryActionLabel: "Staff Gateway",
      buttonBg: "bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white"
    },
  ];

  const handleCopy = (text: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setBankName(selected);
    const found = NIGERIAN_BANKS.find((b) => b.name === selected);
    setBankCode(found ? found.code : "");
  };

  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
    setAccountNumber(numericOnly);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    // Validate NUBAN if user typed any bank detail
    if (accountNumber && accountNumber.length !== 10) {
      setMsg({
        type: "error",
        text: "Nigerian commercial bank account number must be exactly 10 digits (NUBAN standard).",
      });
      setActiveTab("bank");
      return;
    }

    if (bankName && !accountNumber) {
      setMsg({
        type: "error",
        text: "Please provide the 10-digit NUBAN account number for the selected bank.",
      });
      setActiveTab("bank");
      return;
    }

    if (accountNumber && !accountName.trim()) {
      setMsg({
        type: "error",
        text: "Please provide the official registered account name as it appears on the bank statement.",
      });
      setActiveTab("bank");
      return;
    }

    startTransition(async () => {
      const res = await updatePortalSettings(
        schoolId,
        {
          name,
          contactPhone: phone,
          isPublicPortalEnabled: isPublic,
          welcomeGreeting: greeting,
          settlementBankName: bankName,
          settlementBankCode: bankCode,
          settlementAccountNumber: accountNumber,
          settlementAccountName: accountName,
          paymentInstruction: paymentInstruction,
        },
        subdomain
      );

      if (res.success) {
        setMsg({
          type: "success",
          text: "Institution profile, public portal gateways, and direct settlement bank settings published and synchronized!",
        });
      } else {
        setMsg({
          type: "error",
          text: res.error || "Failed to update portal settings.",
        });
      }
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* ALERTS & STATUS */}
      {msg && (
        <div 
          className={`p-4 rounded-xl font-medium text-sm border flex items-center gap-3 animate-in fade-in duration-200 ${
            msg.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800" 
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800"
          }`}
        >
          {msg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-2 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("branding")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === "branding"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Identity & Gateways</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("bank")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === "bank"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Direct Bank Settlement</span>
          {!isBankConfigured && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Action Req
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("academic")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === "academic"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Session & Terms</span>
        </button>
      </div>

      {/* TAB 1: INSTITUTION IDENTITY & PUBLIC GATEWAYS */}
      {activeTab === "branding" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Direct Gateways */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Direct Access Gateways
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Public Gateway Shortcuts</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Share these verified URLs with prospective parents, candidates, enrolled students, and academic staff.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gateways.map((gw) => {
                const Icon = gw.icon;
                const isCopied = copiedKey === gw.key;
                return (
                  <div 
                    key={gw.key} 
                    className="p-4 bg-slate-50 dark:bg-zinc-950/70 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-col justify-between space-y-3 transition hover:border-indigo-300 dark:hover:border-indigo-700"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-700 dark:text-zinc-300 shadow-xs">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{gw.title}</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${gw.badgeColor}`}>
                          {gw.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 mt-1">
                        {gw.description}
                      </p>
                      <div className="font-mono text-[11px] text-slate-600 dark:text-zinc-400 truncate mt-2 bg-white dark:bg-zinc-900 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-zinc-800">
                        {origin ? gw.url : gw.path}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <a 
                        href={gw.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition shadow-xs ${gw.buttonBg}`}
                      >
                        <span>{gw.primaryActionLabel}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy(gw.url, gw.key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                          isCopied 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 font-bold" 
                            : "bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Institutional Branding Inputs */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Institution Identity & Helpline</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Control the school name, admissions telephone line, and public accessibility status.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                  Official School Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Greenwood Academy"
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 pl-9 text-sm text-slate-900 dark:text-white bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition"
                  />
                  <School className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Displayed prominently on public headers, footers, and official documents.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                  Admissions Helpline / Contact Phone
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +234 803 123 4567"
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 pl-9 text-sm text-slate-900 dark:text-white bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition font-mono"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Call link displayed in the public header and admissions enquiry footer.
                </p>
              </div>
            </div>

            {/* STATUS TOGGLE */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-6 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Public Portal & Application Availability</h3>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    isPublic 
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" 
                      : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}>
                    {isPublic ? "LIVE" : "MAINTENANCE"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  When enabled, guests can browse academic programs and parents can submit online enrollment applications.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isPublic} 
                  onChange={(e) => setIsPublic(e.target.checked)} 
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-xs font-bold text-slate-700 dark:text-zinc-300">
                  {isPublic ? "PORTAL ACTIVE" : "PORTAL DISABLED"}
                </span>
              </label>
            </div>

            {/* WELCOME HEADLINE */}
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                Welcome Headline & Mission Statement
              </label>
              <textarea
                className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none resize-none transition"
                rows={3}
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder="e.g. Welcome to Greenwood Academy! Fostering leadership, academic excellence, and moral integrity."
              />
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                Displayed prominently in the hero section of the public website.
              </p>
            </div>

            {/* LIVE PREVIEW BANNER */}
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Interactive Public Header Preview
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">Live preview reflects unsaved inputs</span>
              </div>

              <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-indigo-900/50 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30">
                      <School className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base sm:text-lg font-bold text-white tracking-tight">
                        {name || "Institution Name"}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`w-2 h-2 rounded-full ${isPublic ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                        <span className="text-[11px] font-medium text-slate-300">
                          {isPublic ? "Public Portal Live" : "Portal Offline / Maintenance"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {phone ? (
                    <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/15 text-xs text-indigo-200">
                      <Phone className="w-3.5 h-3.5 text-indigo-300" />
                      <span className="font-mono font-medium">{phone}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No Helpline Set</div>
                  )}
                </div>

                <div>
                  <p className="text-indigo-100 text-sm sm:text-base font-medium leading-relaxed">
                    &ldquo;{greeting || "Welcome to our institution!"}&rdquo;
                  </p>
                </div>

                {academicTiers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Academic Pathways:
                    </span>
                    {academicTiers.map((tierName, idx) => (
                      <span 
                        key={idx} 
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-white border border-white/15"
                      >
                        {tierName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DIRECT COMMERCIAL BANK SETTLEMENT */}
      {activeTab === "bank" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* CBN Model A Directive Banner */}
          <div className="p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 rounded-2xl border border-emerald-800/40 text-white space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                CBN Model A Compliance
              </span>
              <span className="text-xs text-slate-400 font-mono">100% Direct Settlement</span>
            </div>
            <h3 className="text-base font-bold text-white">Direct School Commercial Bank Collection</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              Parents transfer school fees <strong>directly to your institution&apos;s commercial bank account</strong>. 
              Our platform deducts <strong>0% from your tuition</strong> and holds zero wallet funds. 
              Payments are verified by the Bursar via the student financial ledger.
            </p>
          </div>

          {/* Bank Configuration Form */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Official Nigerian Commercial Bank Account</span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                This account is automatically rendered on parent payment screens, invoices, and payment receipts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Bank Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                  Commercial Bank Name <span className="text-rose-500">*</span>
                </label>
                <select
                  value={bankName}
                  onChange={handleBankChange}
                  className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition"
                >
                  <option value="">-- Select Registered Commercial Bank --</option>
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b.code} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  CBN-licensed commercial bank or national financial institution.
                </p>
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                  10-Digit NUBAN Account Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={10}
                    value={accountNumber}
                    onChange={handleAccountNumberChange}
                    placeholder="e.g. 0123456789"
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 pl-9 text-sm text-slate-900 dark:text-white bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition font-mono tracking-widest"
                  />
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <span className={`absolute right-3 top-3 text-[11px] font-bold ${
                    accountNumber.length === 10 ? "text-emerald-600" : "text-slate-400"
                  }`}>
                    {accountNumber.length}/10
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Must be exactly 10 digits in compliance with standard NUBAN formatting.
                </p>
              </div>

              {/* Account Holder Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                  Account Holder / Registered Institutional Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                  placeholder="e.g. GREENWOOD ACADEMY LIMITED"
                  className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition uppercase font-semibold"
                />
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Exact corporate or business name registered with the bank.
                </p>
              </div>

              {/* Payment Narration / Instructions */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                  Transfer Narration & Guidance for Parents
                </label>
                <input
                  type="text"
                  value={paymentInstruction}
                  onChange={(e) => setPaymentInstruction(e.target.value)}
                  placeholder="e.g. Use Student Admission No as transfer narration"
                  className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition"
                />
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Instructs parents what reference to put in their mobile banking app narration for instant ledger matching.
                </p>
              </div>
            </div>

            {/* LIVE PARENT PAYMENT PREVIEW CARD */}
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Live Parent Payment Preview
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                  Rendered on invoices and student finance screens
                </span>
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-lg border border-indigo-800/40 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-emerald-400">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{bankName || "Select Bank"}</div>
                      <div className="text-[11px] text-slate-300">Direct Bank Transfer</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Verified Settlement
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Account Number</span>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-widest">
                        {accountNumber || "0000000000"}
                      </span>
                      {accountNumber && (
                        <button
                          type="button"
                          onClick={() => handleCopy(accountNumber, "preview-acc")}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition flex items-center gap-1"
                        >
                          {copiedKey === "preview-acc" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === "preview-acc" ? "Copied" : "Copy"}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Account Name</span>
                    <div className="font-bold text-sm text-slate-100 uppercase tracking-wide">
                      {accountName || "INSTITUTION REGISTERED NAME"}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-xs text-amber-200">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Transfer Narration:</strong> {paymentInstruction}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACADEMIC SESSION & CALENDAR */}
      {activeTab === "academic" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Academic Operations
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Session & Term Scheduling</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Govern active academic sessions, term milestones, and resumption dates across student report cards and fee schedules.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                  Academic Session
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={academicSession}
                    onChange={(e) => setAcademicSession(e.target.value)}
                    placeholder="e.g. 2026/2027"
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 pl-9 text-sm text-slate-900 dark:text-white bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition font-mono"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Active academic year applied to attendance, broadsheets, and transcripts.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                  Current Term
                </label>
                <select
                  value={academicTerm}
                  onChange={(e) => setAcademicTerm(e.target.value)}
                  className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition"
                >
                  <option value="First Term">First Term (Michaelmas / Harmattan)</option>
                  <option value="Second Term">Second Term (Lent / Epiphany)</option>
                  <option value="Third Term">Third Term (Trinity / Rain)</option>
                </select>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Active instructional term for continuous assessment and grading.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                  Next Term Resumption Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={nextTermResumption}
                    onChange={(e) => setNextTermResumption(e.target.value)}
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 pl-9 text-sm text-slate-900 dark:text-white bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Rendered at the footer of all student terminal report cards.
                </p>
              </div>
            </div>

            {/* Configured Academic Tiers Overview */}
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                Active Multi-Tier Curriculum Pathways
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Each active curriculum tier runs on an isolated database schema with independent academic broadsheets.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {academicTiers.length > 0 ? (
                  academicTiers.map((t, idx) => (
                    <div 
                      key={idx}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{t}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 italic">No academic tiers registered.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL SAVE ACTION BAR */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>All updates apply immediately across public landing, admissions apply, and billing gateways.</span>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition disabled:opacity-50 shadow-md hover:shadow-lg shadow-indigo-600/20 text-sm flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Publishing Updates...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Save & Publish Settings</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
