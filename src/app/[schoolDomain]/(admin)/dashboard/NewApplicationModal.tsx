"use client";

import React, { useState, useTransition } from "react";
import { AcademicTier } from "@prisma/client";
import { X } from "lucide-react";
import { useNumericInput } from "@/hooks/useNumericInput";

export default function NewApplicationModal({
  isOpen,
  onClose,
  tiers,
  classrooms,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  tiers: AcademicTier[];
  classrooms: any[];
  onSubmit: (data: any) => Promise<void>;
}) {
  const { handleNumericChange } = useNumericInput();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    applicantName: "",
    parentName: "",
    parentContact: "",
    parentEmail: "",
    targetGrade: "",
    source: "Website",
    tierId: "",
  });

  const selectedTier = tiers.find(t => t.id === formData.tierId);
  const selectedTierName = selectedTier?.name || "";
  const isHigherEd = selectedTierName.toUpperCase().includes("UNIVERSITY") || 
                     selectedTierName.toUpperCase().includes("POLYTECHNIC") || 
                     selectedTierName.toUpperCase().includes("COLLEGE") ||
                     selectedTierName.toUpperCase().includes("HIGHER ED");

  let availableClassrooms = classrooms.filter((c) => c.tierId === formData.tierId);

  // Authentic Nigerian education grade fallback lists
  if (availableClassrooms.length === 0 && selectedTierName) {
    const norm = selectedTierName.toUpperCase();
    if (norm.includes("POLYTECHNIC") || norm.includes("ND") || norm.includes("HND")) {
      availableClassrooms = ["ND 1", "ND 2", "HND 1", "HND 2"].map(c => ({ id: c, name: c, tierId: formData.tierId }));
    } else if (norm.includes("COLLEGE") || norm.includes("NCE")) {
      availableClassrooms = ["NCE I", "NCE II", "NCE III"].map(c => ({ id: c, name: c, tierId: formData.tierId }));
    } else if (norm.includes("HIGHER ED") || norm.includes("UNIVERSITY") || norm.includes("DEGREE")) {
      availableClassrooms = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level"].map(c => ({ id: c, name: c, tierId: formData.tierId }));
    } else if (norm.includes("SECONDARY") || norm.includes("HIGH SCHOOL")) {
      availableClassrooms = ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"].map(c => ({ id: c, name: c, tierId: formData.tierId }));
    } else if (norm.includes("PRIMARY") || norm.includes("BASIC") || norm.includes("ELEMENTARY")) {
      availableClassrooms = ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"].map(c => ({ id: c, name: c, tierId: formData.tierId }));
    } else if (norm.includes("NURSERY") || norm.includes("CRECHE") || norm.includes("EARLY CARE") || norm.includes("CRÈCHE") || norm.includes("CRECHE")) {
      availableClassrooms = ["Creche", "Playgroup", "Nursery 1", "Nursery 2", "Kindergarten"].map(c => ({ id: c, name: c, tierId: formData.tierId }));
    }
  }

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await onSubmit(formData);
      setFormData({
        applicantName: "",
        parentName: "",
        parentContact: "",
        parentEmail: "",
        targetGrade: "",
        source: "Website",
        tierId: "",
      });
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto flex flex-col text-left">
        <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10 rounded-t-2xl">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-zinc-100">New Application / Inquiry</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Register a prospective applicant into the admissions pipeline.</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Applicant Full Name
              </label>
              <input 
                required 
                type="text" 
                placeholder="e.g. Chinedu Okafor"
                className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 sm:p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 transition-colors" 
                value={formData.applicantName} 
                onChange={e => setFormData({...formData, applicantName: e.target.value})} 
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                {isHigherEd ? "Sponsor / Next of Kin Full Name" : "Parent / Guardian Full Name"}
              </label>
              <input 
                required 
                type="text" 
                placeholder="e.g. Dr. Emeka Okafor"
                className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 sm:p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 transition-colors" 
                value={formData.parentName} 
                onChange={e => setFormData({...formData, parentName: e.target.value})} 
              />
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                {isHigherEd ? "Sponsor / Next of Kin Phone" : "Parent / Guardian Phone"}
              </label>
              <input 
                required 
                type="tel" 
                inputMode="numeric" 
                pattern="[0-9+]*" 
                placeholder="e.g. 08012345678"
                className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 sm:p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 transition-colors" 
                value={formData.parentContact} 
                onChange={e => handleNumericChange(e, (val) => setFormData({...formData, parentContact: val}))} 
              />
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                {isHigherEd ? "Sponsor / Next of Kin Email (Optional)" : "Parent / Guardian Email (Optional)"}
              </label>
              <input 
                type="email" 
                placeholder="parent@example.com"
                className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 sm:p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 transition-colors" 
                value={formData.parentEmail} 
                onChange={e => setFormData({...formData, parentEmail: e.target.value})} 
              />
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Academic Tier</label>
              <select 
                required 
                className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 sm:p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 transition-colors" 
                value={formData.tierId} 
                onChange={e => setFormData({...formData, tierId: e.target.value, targetGrade: ""})}
              >
                <option value="">Select Academic Tier</option>
                {tiers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                {isHigherEd ? "Target Qualification / Programme" : "Target Grade / Class"}
              </label>
              <select 
                required 
                className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 sm:p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 transition-colors disabled:opacity-50" 
                value={formData.targetGrade} 
                onChange={e => setFormData({...formData, targetGrade: e.target.value})} 
                disabled={!formData.tierId}
              >
                <option value="">Select a class</option>
                {availableClassrooms.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                {formData.tierId && availableClassrooms.length === 0 && (
                  <option value="General" disabled>No classes defined yet</option>
                )}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Inquiry Source</label>
              <select 
                required 
                className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 sm:p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 transition-colors" 
                value={formData.source} 
                onChange={e => setFormData({...formData, source: e.target.value})}
              >
                <option value="Website">Website</option>
                <option value="Walk-in">Walk-in</option>
                <option value="Referral">Referral</option>
                <option value="Social Media">Social Media</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3 border-t border-slate-100 dark:border-zinc-800 mt-6">
            <button 
              type="button" 
              onClick={onClose} 
              className="w-full sm:w-auto px-5 py-2.5 text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl font-semibold transition-colors text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isPending} 
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 dark:bg-zinc-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-xl font-semibold transition-colors disabled:opacity-70 text-sm shadow-xs"
            >
              {isPending ? "Saving..." : "Register Inquiry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
