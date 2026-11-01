"use client";

import React, { useState } from "react";
import { updateSchoolWithTiers } from "./actions";
import { X, Building, Check, CheckSquare, Square, Layers, AlertCircle, Phone, Info, Database, ShieldCheck, Lock } from "lucide-react";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";

interface AcademicTierItem {
  id?: string;
  name: string;
}

interface EditSchoolProps {
  school: {
    id: string;
    name: string;
    contactPhone?: string | null;
    subdomain: string;
    academicTiers: AcademicTierItem[];
  };
  trigger?: React.ReactNode;
  isSuperAdmin?: boolean;
}

interface TierOption {
  id: string;
  label: string;
  description: string;
  badgeStyle: string;
}

const AVAILABLE_TIER_OPTIONS: TierOption[] = [
  {
    id: "CRECHE",
    label: "Creche / Nursery",
    description: "Early childhood care, crèche, playgroup & nursery foundation (Ages 0 - 5)",
    badgeStyle: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
  },
  {
    id: "PRIMARY",
    label: "Primary School",
    description: "Basic elementary education covering classes Basic 1 through Basic 6",
    badgeStyle: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
  },
  {
    id: "SECONDARY",
    label: "Secondary School",
    description: "Junior Secondary (JSS 1-3) & Senior Secondary (SS 1-3) / High School",
    badgeStyle: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20"
  },
  {
    id: "PRIMARY_SECONDARY",
    label: "Combined Primary & Secondary School",
    description: "Seamless single-campus continuum from Basic 1 through SS 3 graduation",
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
  },
  {
    id: "UNIVERSITY",
    label: "Higher Ed: University",
    description: "Degree-awarding tertiary institution (Undergraduate, Masters & Doctoral programs)",
    badgeStyle: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20"
  },
  {
    id: "POLYTECHNIC",
    label: "Higher Ed: Polytechnic",
    description: "National Diploma (ND) and Higher National Diploma (HND) technical curricula",
    badgeStyle: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20"
  },
  {
    id: "COLLEGE_OF_EDUCATION",
    label: "Higher Ed: College of Education",
    description: "Nigeria Certificate in Education (NCE) and teacher pedagogical training",
    badgeStyle: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20"
  }
];

function matchesTierOption(tierName: string, optionId: string): boolean {
  const norm = (tierName || "").toUpperCase().trim();
  switch (optionId) {
    case "CRECHE":
      return norm.includes("CRECHE") || norm.includes("NURSERY") || norm.includes("EARLY CARE");
    case "PRIMARY":
      return (norm === "PRIMARY" || norm === "PRIMARY SCHOOL") && !norm.includes("SECONDARY");
    case "SECONDARY":
      return (norm === "SECONDARY" || norm === "SECONDARY SCHOOL") && !norm.includes("PRIMARY");
    case "PRIMARY_SECONDARY":
      return norm === "PRIMARY_SECONDARY" || (norm.includes("PRIMARY") && norm.includes("SECONDARY"));
    case "UNIVERSITY":
      return norm.includes("UNIVERSITY");
    case "POLYTECHNIC":
      return norm.includes("POLYTECHNIC");
    case "COLLEGE_OF_EDUCATION":
      return norm.includes("COLLEGE_OF_EDUCATION") || norm.includes("COLLEGE OF EDUCATION");
    default:
      return norm === optionId.toUpperCase();
  }
}

export default function EditSchoolModal({ school, trigger, isSuperAdmin = true }: EditSchoolProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [simulationNotice, setSimulationNotice] = useState<string | null>(null);

  // Form State (Front-Facing Metadata)
  const [schoolName, setSchoolName] = useState(school.name);
  const [contactPhone, setContactPhone] = useState(school.contactPhone || "");
  const [selectedTierIds, setSelectedTierIds] = useState<string[]>([]);

  // Open modal and pre-populate selections based on current school academic tiers
  const handleOpen = () => {
    setSchoolName(school.name);
    setContactPhone(school.contactPhone || "");
    setErrorMessage(null);
    setSimulationNotice(null);

    // Detect which tier options match the existing school's academic tiers
    const matched = AVAILABLE_TIER_OPTIONS
      .filter(opt => (school.academicTiers || []).some(t => matchesTierOption(t.name, opt.id)))
      .map(opt => opt.id);

    // If existing tiers didn't match standard IDs directly, check if labels match or default to first
    if (matched.length === 0 && (school.academicTiers || []).length > 0) {
      const fallbackMatches = AVAILABLE_TIER_OPTIONS.filter(opt =>
        (school.academicTiers || []).some(t =>
          t.name.toLowerCase().includes(opt.id.toLowerCase()) ||
          opt.label.toLowerCase().includes(t.name.toLowerCase())
        )
      ).map(opt => opt.id);

      setSelectedTierIds(fallbackMatches.length > 0 ? fallbackMatches : [AVAILABLE_TIER_OPTIONS[0].id]);
    } else {
      setSelectedTierIds(matched.length > 0 ? matched : [AVAILABLE_TIER_OPTIONS[0].id]);
    }

    setIsOpen(true);
  };

  // Toggle selection for a given tier
  const handleToggleTier = (tierId: string) => {
    setErrorMessage(null);
    if (!isSuperAdmin) {
      setErrorMessage("Meta Configuration Shield: Only Global SaaS Super Administrators are authorized to alter academic tiers and database partition mappings.");
      return;
    }
    if (selectedTierIds.includes(tierId)) {
      if (selectedTierIds.length <= 1) {
        setErrorMessage("At least one Institution Type / Tier must remain selected for this tenant.");
        return;
      }
      setSelectedTierIds(prev => prev.filter(id => id !== tierId));
    } else {
      setSelectedTierIds(prev => [...prev, tierId]);
    }
  };

  const handleSelectAll = () => {
    if (!isSuperAdmin) {
      setErrorMessage("Meta Configuration Shield: Only Global SaaS Super Administrators can alter academic tiers.");
      return;
    }
    setSelectedTierIds(AVAILABLE_TIER_OPTIONS.map(o => o.id));
    setErrorMessage(null);
  };

  const handleResetToOriginal = () => {
    if (!isSuperAdmin) return;
    const matched = AVAILABLE_TIER_OPTIONS
      .filter(opt => (school.academicTiers || []).some(t => matchesTierOption(t.name, opt.id)))
      .map(opt => opt.id);
    setSelectedTierIds(matched.length > 0 ? matched : [AVAILABLE_TIER_OPTIONS[0].id]);
    setErrorMessage(null);
  };

  // Submit form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schoolName.trim()) {
      setErrorMessage("School name cannot be empty.");
      return;
    }

    if (isSuperAdmin && selectedTierIds.length === 0) {
      setErrorMessage("Please select at least one Institution Type / Tier.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSimulationNotice(null);

    // META CONFIGURATION SHIELD:
    // Only Global SaaS Super Admins can alter critical infrastructure parameters (tiers and schema partitions).
    // Local tenant admins are restricted to modifying basic front-facing metadata variables.
    const tiersToSubmit = isSuperAdmin
      ? selectedTierIds.map(id => {
          const option = AVAILABLE_TIER_OPTIONS.find(o => o.id === id);
          const existing = (school.academicTiers || []).find(t => matchesTierOption(t.name, id));
          return {
            id: existing?.id,
            name: option ? option.label : id,
          };
        })
      : (school.academicTiers || []).map(t => ({
          id: t.id,
          name: t.name,
        }));

    const res = await updateSchoolWithTiers(school.id, {
      name: schoolName.trim(),
      contactPhone: contactPhone ? contactPhone.trim() : null,
      tiers: tiersToSubmit,
    });

    setIsSubmitting(false);

    if (res && !res.success) {
      setErrorMessage(res.error || "Failed to update tenant.");
    } else {
      if (res?.simulated) {
        setSimulationNotice(res.warning || "Saved in safe test-simulation mode.");
        setTimeout(() => {
          setIsOpen(false);
        }, 1200);
      } else {
        setIsOpen(false);
      }
    }
  };

  return (
    <>
      {/* Row Action Button */}
      {trigger ? (
        <div onClick={handleOpen} className="inline-flex items-center cursor-pointer" title="Edit Tenant">
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border shadow-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/20 transition-all duration-150 outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
          title="Edit Tenant & Institution Types"
        >
          EDIT
        </button>
      )}

      {/* Modal Overlay & Card */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Tenant Workspace
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Configure profile and Institution / Tier types for <span className="font-semibold text-slate-700 dark:text-zinc-300">{school.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulation Warning / Notification Banner */}
            {simulationNotice && (
              <div className="mx-6 mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <Info className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{simulationNotice}</span>
              </div>
            )}

            {/* Meta Configuration Shield Banner */}
            {!isSuperAdmin ? (
              <div className="mx-6 mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="block font-bold">Meta Configuration Shield Active</strong>
                  Critical infrastructure parameters (Academic Tiers &amp; Multi-Tier Database Partitioning) are restricted to Global SaaS Super Administrators. As a local tenant administrator, you are authorized to update basic front-facing metadata (School Name &amp; Contact Phone).
                </div>
              </div>
            ) : (
              <div className="mx-6 mt-4 p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center gap-2 text-xs text-indigo-900 dark:text-indigo-200">
                <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-600" />
                <span className="font-semibold">Global SaaS Super Admin Clearance: Full Infrastructure &amp; Tier Configuration Unlocked</span>
              </div>
            )}

            {/* Error message banner */}
            {errorMessage && (
              <div className="mx-6 mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Scrollable Form Body */}
            <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {/* Tenant Profile Fields (Front-Facing Metadata) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    School Name *
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    required
                    className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none text-sm font-medium"
                    placeholder="e.g. Riverside High"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Subdomain (Slug)
                  </label>
                  <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800/40">
                    <input
                      type="text"
                      value={school.subdomain}
                      disabled
                      className="w-full p-2.5 text-slate-500 dark:text-zinc-400 text-sm bg-transparent cursor-not-allowed select-none outline-none font-mono"
                    />
                    <span className="px-2.5 py-2 text-xs font-medium text-slate-400 border-l border-slate-200 dark:border-zinc-800">
                      .bonaveeict.com.ng
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    maxLength={16}
                    className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none text-sm"
                    placeholder="+2348000000000"
                  />
                </div>
              </div>

              {/* Multi-Select / Checkbox Section for Institution Types & Tiers */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <span>Institution Type / Tier Type Options ({selectedTierIds.length} Selected)</span>
                        {!isSuperAdmin && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/30 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-800">
                            <Lock className="w-3 h-3" />
                            Shielded
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {isSuperAdmin
                          ? "Check or uncheck the educational tiers offered by this school."
                          : "Tier infrastructure is shielded. Only Global Super Admins can reconfigure database tiers."}
                      </p>
                    </div>
                  </div>

                  {/* Quick toggle actions (Super Admin Only) */}
                  {isSuperAdmin ? (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium text-[11px] cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300 dark:text-zinc-700">•</span>
                      <button
                        type="button"
                        onClick={handleResetToOriginal}
                        className="text-slate-500 dark:text-zinc-400 hover:underline text-[11px] cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Grid of Checkbox Cards */}
                <div className={`space-y-2.5 ${!isSuperAdmin ? "opacity-60 cursor-not-allowed pointer-events-none select-none" : ""}`}>
                  {AVAILABLE_TIER_OPTIONS.map((option) => {
                    const isChecked = selectedTierIds.includes(option.id);
                    return (
                      <div
                        key={option.id}
                        onClick={() => handleToggleTier(option.id)}
                        className={`group relative flex items-start gap-3.5 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700/60 shadow-xs"
                            : "bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        {/* Custom Styled Checkbox Icon */}
                        <div className="mt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by parent container click
                            className="sr-only"
                          />
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                              isChecked
                                ? "bg-blue-600 text-white shadow-xs"
                                : "border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 group-hover:border-slate-400"
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                            <span className={`text-xs font-bold transition-colors ${
                              isChecked ? "text-blue-900 dark:text-blue-200" : "text-slate-800 dark:text-zinc-200"
                            }`}>
                              {option.label}
                            </span>
                            <span className={`${option.badgeStyle} text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border shadow-2xs`}>
                              {option.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                            {option.description}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                            <Database className="w-3 h-3 text-blue-500 shrink-0" />
                            <span>Target Database: <strong className="text-slate-700 dark:text-zinc-300 font-semibold">{school.subdomain.toLowerCase().replace(/[^a-z0-9]/g, '')}_{sanitizeTierSlug(option.label)}</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live Preview of Selected Badges */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/80 dark:border-zinc-800/80">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
                    Live Table Badge Preview:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTierIds.map((id) => {
                      const opt = AVAILABLE_TIER_OPTIONS.find(o => o.id === id);
                      if (!opt) return null;
                      return (
                        <span 
                          key={id} 
                          className={`${opt.badgeStyle} text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border shadow-xs`}
                        >
                          {opt.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving Changes...
                    </>
                  ) : (
                    "Save Tenant Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
