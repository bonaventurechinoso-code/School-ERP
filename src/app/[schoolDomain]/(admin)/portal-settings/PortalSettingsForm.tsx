"use client";

import React, { useState, useTransition } from "react";
import { updatePortalSettings } from "./actions";
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
  AlertCircle
} from "lucide-react";

export default function PortalSettingsForm({
  schoolId,
  subdomain,
  initialName,
  initialPhone,
  initialIsPublic,
  initialGreeting,
  academicTiers = [],
}: {
  schoolId: string;
  subdomain: string;
  initialName: string;
  initialPhone: string;
  initialIsPublic: boolean;
  initialGreeting: string;
  academicTiers?: string[];
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [greeting, setGreeting] = useState(initialGreeting || "");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [origin, setOrigin] = useState("");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(`${window.location.protocol}//${window.location.host}`);
    }
  }, []);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updatePortalSettings(schoolId, {
        name,
        contactPhone: phone,
        isPublicPortalEnabled: isPublic,
        welcomeGreeting: greeting,
      });

      if (res.success) {
        setMsg({ type: "success", text: "Portal settings updated and revalidated across public landing and admissions gateways!" });
      } else {
        setMsg({ type: "error", text: res.error || "Failed to update portal settings." });
      }
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
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

      {/* PUBLIC GATEWAYS QUICK ACCESS */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 p-6 space-y-5">
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

      {/* INSTITUTION SETTINGS */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 p-6 space-y-6">
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
            placeholder="e.g. Welcome to Greenwood Academy! Fostering leadership, excellence, and character."
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
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">Live preview reflects your unsaved input</span>
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

        {/* SUBMIT BUTTON */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-6">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Changes take effect immediately across all public and admissions routes.
          </p>
          <button 
            type="submit" 
            disabled={isPending}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition disabled:opacity-50 shadow-md hover:shadow-lg shadow-indigo-600/20 text-sm"
          >
            {isPending ? "Saving & Revalidating..." : "Save & Publish Changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
