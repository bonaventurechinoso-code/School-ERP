"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useNumericInput } from "@/hooks/useNumericInput";

export default function RegisterTenantPage() {
  const router = useRouter();
  const { handleNumericChange } = useNumericInput();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    schoolName: "",
    adminEmail: "",
    contactPhone: "",
    subdomain: "",
  });

  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);

  const availableTiers = [
    { id: "NURSERY", label: "Nursery / Daycare", desc: "Ages 0-4" },
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

      // Success! Clear state and redirect
      router.push(data.redirectUrl);

    } catch (err) {
      console.error(err);
      setErrorMsg("An unexpected error occurred. Please try again.");
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
        <div className="bg-slate-900 px-5 py-5 md:px-8 md:py-6 text-white">
          <h1 className="text-2xl font-bold">Register Your School</h1>
          <p className="text-slate-400 mt-1">
            Step {step} of 2: {step === 1 ? "Institutional Identity" : "Academic Tier Allocation"}
          </p>
        </div>

        {/* Body */}
        <div className="p-5 md:p-8">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm font-medium">
              {errorMsg}
            </div>
          )}

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
                  <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-slate-500 sm:text-sm">
                    schoolerp.com/
                  </span>
                  <input 
                    required
                    type="text" 
                    className="flex-1 min-w-0 block w-full border border-slate-300 rounded-none rounded-r-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="greenwood"
                    value={formData.subdomain} 
                    onChange={e => setFormData({...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")})} 
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">Only lowercase letters and numbers. This will be your tenant workspace URL.</p>
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
                      Provisioning...
                    </>
                  ) : (
                    "Complete Registration"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
