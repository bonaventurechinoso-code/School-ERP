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

  // Hardcoded development fallback data
  if (availableClassrooms.length === 0 && selectedTierName) {
    if (selectedTierName.includes("Higher Ed") || selectedTierName.includes("University") || selectedTierName.includes("College")) {
      availableClassrooms = ["Year 1", "Year 2", "Year 3", "Year 4"].map(c => ({ id: c, name: c, tierId: formData.tierId }));
    } else if (selectedTierName.includes("Secondary") || selectedTierName.includes("High School")) {
      availableClassrooms = ["JSS 1", "JSS 2", "SSS 1", "SSS 2"].map(c => ({ id: c, name: c, tierId: formData.tierId }));
    } else if (selectedTierName.includes("Primary") || selectedTierName.includes("Elementary")) {
      availableClassrooms = ["Class 1", "Class 2", "Class 3"].map(c => ({ id: c, name: c, tierId: formData.tierId }));
    } else if (selectedTierName.includes("Nursery") || selectedTierName.includes("Daycare") || selectedTierName.includes("Early Care")) {
      availableClassrooms = ["Kindergarten", "Nursery 1", "Nursery 2", "Nursery 3"].map(c => ({ id: c, name: c, tierId: formData.tierId }));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">New Application / Inquiry</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Applicant Full Name</label>
              <input required type="text" className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.applicantName} onChange={e => setFormData({...formData, applicantName: e.target.value})} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isHigherEd ? "Sponsor / Next of Kin Full Name" : "Parent / Guardian Full Name"}
              </label>
              <input required type="text" className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isHigherEd ? "Sponsor / Next of Kin Phone" : "Parent / Guardian Phone"}
              </label>
              <input required type="tel" inputMode="numeric" pattern="[0-9+]*" className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.parentContact} onChange={e => handleNumericChange(e, (val) => setFormData({...formData, parentContact: val}))} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isHigherEd ? "Sponsor / Next of Kin Email (Optional)" : "Parent / Guardian Email (Optional)"}
              </label>
              <input type="email" className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.parentEmail} onChange={e => setFormData({...formData, parentEmail: e.target.value})} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Tier</label>
              <select required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" value={formData.tierId} onChange={e => setFormData({...formData, tierId: e.target.value})}>
                <option value="">Select Academic Tier</option>
                {tiers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isHigherEd ? "Target Qualification / Programme" : "Target Grade / Class"}
              </label>
              <select required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" value={formData.targetGrade} onChange={e => setFormData({...formData, targetGrade: e.target.value})} disabled={!formData.tierId}>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
              <select required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})}>
                <option value="Website">Website</option>
                <option value="Walk-in">Walk-in</option>
                <option value="Referral">Referral</option>
                <option value="Social Media">Social Media</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-medium transition-colors disabled:opacity-70">
              {isPending ? "Saving..." : "Register Inquiry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
