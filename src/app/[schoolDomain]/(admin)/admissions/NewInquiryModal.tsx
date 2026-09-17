"use client";

import React, { useState, useTransition } from "react";
import { X, UserPlus, CheckCircle2, AlertCircle, Phone, User, GraduationCap } from "lucide-react";
import { createAdmissionLeadAction } from "./actions";

export interface NewInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  schoolDomain: string;
  tiers: any[];
  onLeadCreated?: () => void;
}

const COMMON_GRADES = [
  "Daycare / Creche",
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SSS 1",
  "SSS 2",
  "SSS 3",
];

export default function NewInquiryModal({
  isOpen,
  onClose,
  schoolId,
  schoolDomain,
  tiers,
  onLeadCreated,
}: NewInquiryModalProps) {
  const [isPending, startTransition] = useTransition();
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState({
    applicantName: "",
    targetGrade: "JSS 1",
    tierId: tiers[0]?.id || "",
    parentName: "",
    parentContact: "",
    parentEmail: "",
    source: "Walk-In Parent",
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.applicantName.trim() || !formData.parentContact.trim() || !formData.tierId) {
      setAlertMsg({ type: "error", text: "Please complete candidate name, contact, and educational tier." });
      return;
    }

    setAlertMsg(null);
    startTransition(async () => {
      const res = await createAdmissionLeadAction({
        schoolId,
        schoolDomain,
        ...formData,
      });

      if (res.success) {
        setAlertMsg({ type: "success", text: `Inquiry logged for ${formData.applicantName}!` });
        setFormData({
          applicantName: "",
          targetGrade: "JSS 1",
          tierId: tiers[0]?.id || "",
          parentName: "",
          parentContact: "",
          parentEmail: "",
          source: "Walk-In Parent",
        });
        if (onLeadCreated) onLeadCreated();
        setTimeout(() => onClose(), 800);
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to log inquiry." });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black">Register Admission Inquiry</h3>
              <p className="text-xs text-slate-400">Log walk-in parents or telephone inquiries directly into pipeline.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ALERT MSG */}
        {alertMsg && (
          <div className={`p-3 text-xs font-semibold flex items-center gap-2 ${
            alertMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200" : "bg-red-50 text-red-800 border-b border-red-200"
          }`}>
            {alertMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{alertMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Candidate Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Chukwuemeka Adebayo"
              value={formData.applicantName}
              onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
              className="w-full border border-slate-300 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Class *</label>
              <select
                value={formData.targetGrade}
                onChange={(e) => setFormData({ ...formData, targetGrade: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 font-medium bg-white"
              >
                {COMMON_GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Educational Tier *</label>
              <select
                value={formData.tierId}
                onChange={(e) => setFormData({ ...formData, tierId: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 font-medium bg-white"
                required
              >
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Parent / Guardian Name</label>
            <input
              type="text"
              placeholder="e.g. Chief & Mrs. Adebayo"
              value={formData.parentName}
              onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
              className="w-full border border-slate-300 rounded-xl p-2.5 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Parent Phone / WhatsApp *</label>
              <input
                type="tel"
                required
                placeholder="+234 803 123 4567"
                value={formData.parentContact}
                onChange={(e) => setFormData({ ...formData, parentContact: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 font-medium font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Inquiry Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 font-medium bg-white"
              >
                <option value="Walk-In Parent">Walk-In Parent</option>
                <option value="Telephone Call">Telephone Call</option>
                <option value="Referral by Parent">Referral by Current Parent</option>
                <option value="Social Media / Ads">Social Media / Digital</option>
                <option value="School Fair / Outreach">School Outreach</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Parent Email Address</label>
            <input
              type="email"
              placeholder="parent@example.com"
              value={formData.parentEmail}
              onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
              className="w-full border border-slate-300 rounded-xl p-2.5 font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition"
            >
              {isPending ? "Logging..." : "Log Inquiry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
