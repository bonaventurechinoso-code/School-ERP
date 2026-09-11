"use client";

import React, { useState } from "react";
import { updateSchoolWithTiers } from "./actions";
import { X, Building, Plus, Trash2, Layers, AlertCircle, Phone } from "lucide-react";

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
}

const PRESET_TIER_OPTIONS = [
  "Daycare / Nursery",
  "Primary School",
  "Secondary School",
  "Combined Primary & Secondary School",
  "Combined Nursery, Primary & Secondary",
  "Higher Ed: University",
  "Higher Ed: Polytechnic",
  "Higher Ed: College of Education"
];

function getTierBadgeClass(tierName: string) {
  const upper = (tierName || "").toUpperCase();
  if (upper.includes("DAYCARE") || upper.includes("NURSERY")) {
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
  }
  if (upper.includes("PRIMARY") && upper.includes("SECONDARY")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
  }
  if (upper.includes("UNIVERSITY") || upper.includes("POLYTECHNIC") || upper.includes("COLLEGE") || upper.includes("HIGHER")) {
    return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20";
  }
  if (upper.includes("PRIMARY")) {
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
  }
  if (upper.includes("SECONDARY")) {
    return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
  }
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
}

export default function EditSchoolModal({ school }: EditSchoolProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [schoolName, setSchoolName] = useState(school.name);
  const [contactPhone, setContactPhone] = useState(school.contactPhone || "");
  const [tiers, setTiers] = useState<AcademicTierItem[]>(school.academicTiers || []);

  // Add Tier Input State
  const [selectedPreset, setSelectedPreset] = useState(PRESET_TIER_OPTIONS[0]);
  const [customTierName, setCustomTierName] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Reset state when opening modal
  const handleOpen = () => {
    setSchoolName(school.name);
    setContactPhone(school.contactPhone || "");
    setTiers([...(school.academicTiers || [])]);
    setErrorMessage(null);
    setIsCustomMode(false);
    setCustomTierName("");
    setSelectedPreset(PRESET_TIER_OPTIONS[0]);
    setIsOpen(true);
  };

  const handleAddTier = () => {
    const tierNameToAdd = isCustomMode ? customTierName.trim() : selectedPreset.trim();
    if (!tierNameToAdd) return;

    // Check duplicate
    if (tiers.some(t => t.name.toLowerCase() === tierNameToAdd.toLowerCase())) {
      setErrorMessage(`"${tierNameToAdd}" is already in this school's tier list.`);
      return;
    }

    setErrorMessage(null);
    setTiers([...tiers, { name: tierNameToAdd }]);

    if (isCustomMode) {
      setCustomTierName("");
      setIsCustomMode(false);
    }
  };

  const handleUpdateTierName = (index: number, newName: string) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], name: newName };
    setTiers(updated);
  };

  const handleRemoveTier = (index: number) => {
    if (tiers.length <= 1) {
      setErrorMessage("A school must have at least one Institution Type / Tier.");
      return;
    }
    setErrorMessage(null);
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) {
      setErrorMessage("School name cannot be empty.");
      return;
    }
    if (tiers.length === 0) {
      setErrorMessage("Please configure at least one Institution Type / Tier.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await updateSchoolWithTiers(school.id, {
      name: schoolName,
      contactPhone: contactPhone || null,
      tiers: tiers.map(t => ({ id: t.id, name: t.name.trim() })).filter(t => t.name.length > 0)
    });

    setIsSubmitting(false);

    if (res && !res.success) {
      setErrorMessage(res.error || "Failed to update school.");
    } else {
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border shadow-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/20 transition-all duration-150 outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
        title="Edit Tenant & Institution Types"
      >
        EDIT
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Tenant Workspace
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Configure profile and Institution / Tier types for {school.name}
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

            {/* Error message banner */}
            {errorMessage && (
              <div className="mx-6 mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Scrollable Form Body */}
            <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* General Info */}
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
                    className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none text-sm"
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
                      className="w-full p-2.5 text-slate-500 dark:text-zinc-400 text-sm bg-transparent cursor-not-allowed select-none outline-none"
                    />
                    <span className="px-2.5 py-2 text-xs font-medium text-slate-400 border-l border-slate-200 dark:border-zinc-800">
                      .schoolerp.com
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
                    placeholder="+155500000000"
                  />
                </div>
              </div>

              {/* Institution Types / Tier Types Management Section */}
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
                      Institution Types / Tier Types ({tiers.length})
                    </label>
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                    Active Educational Levels
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
                  Dynamically add, rename, or remove the institution types associated with this tenant workspace.
                </p>

                {/* Existing Tiers List */}
                <div className="space-y-2 mb-4">
                  {tiers.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-400 italic">
                      No tiers assigned. Add at least one tier below.
                    </div>
                  ) : (
                    tiers.map((tier, index) => (
                      <div
                        key={tier.id || `temp-${index}`}
                        className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40 hover:border-slate-300 dark:hover:border-zinc-700 transition"
                      >
                        {/* Status preview badge */}
                        <span className={`shrink-0 ${getTierBadgeClass(tier.name)} text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border shadow-2xs`}>
                          Tier {index + 1}
                        </span>

                        {/* Editable Name Input */}
                        <input
                          type="text"
                          value={tier.name}
                          onChange={(e) => handleUpdateTierName(index, e.target.value)}
                          required
                          placeholder="Institution Type / Tier Name"
                          className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        />

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(index)}
                          title="Remove this tier"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add New Tier Box */}
                <div className="p-3 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/30 space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                    Add New Institution Type / Tier
                  </span>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Mode Toggle / Selection */}
                    {!isCustomMode ? (
                      <select
                        value={selectedPreset}
                        onChange={(e) => {
                          if (e.target.value === "__CUSTOM__") {
                            setIsCustomMode(true);
                          } else {
                            setSelectedPreset(e.target.value);
                          }
                        }}
                        className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        {PRESET_TIER_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                        <option value="__CUSTOM__">+ Custom Tier Name...</option>
                      </select>
                    ) : (
                      <div className="flex-1 flex gap-1.5">
                        <input
                          type="text"
                          value={customTierName}
                          onChange={(e) => setCustomTierName(e.target.value)}
                          placeholder="e.g. Vocational Institute"
                          autoFocus
                          className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomMode(false);
                            setCustomTierName("");
                          }}
                          className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddTier}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Tier
                    </button>
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
