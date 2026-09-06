"use client";

import React, { useState, useTransition, useEffect } from "react";
import { AcademicTier } from "@prisma/client";
import { GraduationCap, ArrowRight, Loader2, CheckCircle2, CheckCircle } from "lucide-react";
import { useNumericInput } from "@/hooks/useNumericInput";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatTierLabel } from "@/lib/guestPortalUtils";
import { NIGERIAN_UNIVERSITY_HIERARCHY, POLYTECHNIC_HIERARCHY, COLLEGE_HIERARCHY } from "@/lib/academicHierarchies";

export default function PublicApplyForm({
  schoolName,
  schoolDomain,
  tiers,
  classrooms,
  brandColor
}: {
  schoolName: string;
  schoolDomain: string;
  tiers: AcademicTier[];
  classrooms: any[];
  brandColor: string;
}) {
  const { handleNumericChange } = useNumericInput();
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);
  
  // 1. Automatic Tier Selection
  const initialTierId = tiers.length > 0 ? tiers[0].id : "";
  
  const [formData, setFormData] = useState({
    applicantName: "",
    studentEmail: "",
    studentPhone: "",
    parentName: "",
    parentContact: "",
    parentEmail: "",
    targetGrade: "",
    facultyOrSchool: "",
    intendedCourseOrProgramme: "",
    tierId: initialTierId,
  });

  const selectedTier = tiers.find(t => t.id === formData.tierId);
  const selectedTierName = selectedTier?.name || "";
  
  // Determine if context is Higher Education
  const isHigherEd = selectedTierName.toLowerCase().includes("higher ed") || 
                     selectedTierName.toLowerCase().includes("university") || 
                     selectedTierName.toLowerCase().includes("college") ||
                     selectedTierName.toLowerCase().includes("polytechnic");

  // Institutional Subtype Evaluator
  let institutionSubtype = "UNIVERSITY"; // Default for higher ed
  const searchString = `${schoolName} ${selectedTierName}`.toUpperCase();
  
  if (searchString.includes("POLYTECHNIC")) {
    institutionSubtype = "POLYTECHNIC";
  } else if (searchString.includes("COLLEGE OF EDUCATION")) {
    institutionSubtype = "COLLEGE_OF_EDUCATION";
  }

  // Dynamic Structure Resolvers
  const getHierarchy = () => {
    if (institutionSubtype === "POLYTECHNIC") return POLYTECHNIC_HIERARCHY;
    if (institutionSubtype === "COLLEGE_OF_EDUCATION") return COLLEGE_HIERARCHY;
    return NIGERIAN_UNIVERSITY_HIERARCHY;
  };
  
  const activeHierarchy = getHierarchy();
  const orgUnitLabel = institutionSubtype === "UNIVERSITY" ? "Select Faculty *" : "Select School *";
  const courseProgrammeLabel = institutionSubtype === "UNIVERSITY" ? "Intended Course of Study *" : "Intended Programme *";

  // State synchronization when changing higher-level context
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      targetGrade: "",
      facultyOrSchool: "",
      intendedCourseOrProgramme: "",
    }));
  }, [formData.tierId, institutionSubtype]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/admissions/public-submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, schoolDomain })
        });

        if (res.ok) {
          setIsSuccess(true);
        } else {
          const err = await res.json();
          alert("Error: " + err.error);
        }
      } catch (error) {
        alert("An error occurred during submission.");
      }
    });
  };

  const renderClassOptions = () => {
    if (!selectedTierName) return null;
    const tier = selectedTierName.toUpperCase();
    
    switch (true) {
      case tier.includes("PRIMARY"):
        return ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6"].map(c => <option key={c} value={c}>{c}</option>);
      case tier.includes("SECONDARY"):
        return ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"].map(c => <option key={c} value={c}>{c}</option>);
      case isHigherEd:
        if (institutionSubtype === "POLYTECHNIC") {
          return ["ND 1", "ND 2", "HND 1", "HND 2"].map(c => <option key={c} value={c}>{c}</option>);
        } else if (institutionSubtype === "COLLEGE_OF_EDUCATION") {
          return ["NCE 1", "NCE 2", "NCE 3"].map(c => <option key={c} value={c}>{c}</option>);
        } else {
          return ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "600 Level"].map(c => <option key={c} value={c}>{c}</option>);
        }
      default:
        return ["Kindergarten", "Nursery 1", "Nursery 2", "Nursery 3"].map(c => <option key={c} value={c}>{c}</option>);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 rounded-3xl shadow-xl p-12 text-center animate-in fade-in zoom-in-95">
        <div className="mx-auto w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Application Received!</h2>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400 text-lg">
          Thank you for applying to {schoolName}. Our admissions team will review your inquiry and reach out shortly.
        </p>
        <button 
          onClick={() => window.location.href = `/`} 
          className="mt-8 px-8 py-3 text-white rounded-xl font-bold transition-transform hover:-translate-y-0.5 shadow-lg"
          style={{ backgroundColor: brandColor }}
        >
          Return to Website
        </button>
      </div>
    );
  }

  const inputStyles = "w-full border border-zinc-300 rounded-xl p-3 focus:ring-2 focus:outline-none transition-shadow bg-white text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 placeholder-zinc-400 disabled:bg-slate-100 disabled:dark:bg-zinc-800 disabled:text-slate-400 disabled:dark:text-zinc-500 disabled:cursor-not-allowed";
  const labelStyles = "block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1";
  const sectionHeaderStyles = "font-bold text-zinc-900 dark:text-zinc-100 text-lg";
  const sectionBorderStyles = "md:col-span-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 mt-6";

  return (
    <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <div className="px-8 py-10 text-center bg-zinc-100 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 relative transition-colors duration-300">
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <div 
          className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
          style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
        >
          <GraduationCap className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Apply to {schoolName}</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto">
          Begin your journey with us by completing this quick inquiry form.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Read-Only Academic Tier Badge */}
          {tiers.length > 0 && (
            <div className="md:col-span-2 flex flex-col items-start mb-2">
              <label className={labelStyles}>Academic Tier</label>
              <div className="inline-flex items-center px-4 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 font-medium text-sm shadow-sm transition-colors duration-300">
                <span className="w-2.5 h-2.5 rounded-full mr-3 shadow-sm" style={{ backgroundColor: brandColor }}></span>
                {formatTierLabel(selectedTierName || tiers[0].name)}
              </div>
            </div>
          )}

          {formData.tierId && (
            <>
              {/* Higher Ed Layout */}
              {isHigherEd ? (
                <>
                  <div className={sectionBorderStyles.replace("mt-6", "mt-2")}>
                    <h3 className={sectionHeaderStyles}>Applicant Details</h3>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className={labelStyles}>Full Name *</label>
                    <input required type="text" placeholder="e.g. Jane Doe" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.applicantName} onChange={e => setFormData({...formData, applicantName: e.target.value})} />
                  </div>

                  <div>
                    <label className={labelStyles}>Personal Email *</label>
                    <input required type="email" placeholder="jane@example.com" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.studentEmail} onChange={e => setFormData({...formData, studentEmail: e.target.value})} />
                  </div>

                  <div>
                    <label className={labelStyles}>Phone Number *</label>
                    <input 
                      required 
                      type="tel" 
                      inputMode="numeric" 
                      pattern="[0-9+]*"
                      minLength={14}
                      maxLength={14} 
                      placeholder="+155500000000" 
                      className={inputStyles} 
                      style={{ '--tw-ring-color': brandColor } as React.CSSProperties} 
                      value={formData.studentPhone} 
                      onChange={(e) => handleNumericChange(e, (val) => setFormData({...formData, studentPhone: val}))} 
                    />
                  </div>

                  <div className={sectionBorderStyles}>
                    <h3 className={sectionHeaderStyles}>Academic Programme Selection</h3>
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelStyles}>Academic Level *</label>
                    <select required className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.targetGrade} onChange={e => setFormData({...formData, targetGrade: e.target.value})}>
                      <option value="">Select a level...</option>
                      {renderClassOptions()}
                    </select>
                  </div>

                  <div>
                    <label className={labelStyles}>{orgUnitLabel}</label>
                    <select required className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.facultyOrSchool} onChange={e => setFormData({...formData, facultyOrSchool: e.target.value, intendedCourseOrProgramme: ""})}>
                      <option value="">Select...</option>
                      {Object.keys(activeHierarchy).map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelStyles}>{courseProgrammeLabel}</label>
                    <select required disabled={!formData.facultyOrSchool} className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.intendedCourseOrProgramme} onChange={e => setFormData({...formData, intendedCourseOrProgramme: e.target.value})}>
                      <option value="">{formData.facultyOrSchool ? "Select a programme..." : "Make a selection above first"}</option>
                      {formData.facultyOrSchool && activeHierarchy[formData.facultyOrSchool]?.map(prog => (
                        <option key={prog} value={prog}>{prog}</option>
                      ))}
                    </select>
                  </div>

                  <div className={sectionBorderStyles}>
                    <h3 className={sectionHeaderStyles}>Emergency Contact</h3>
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelStyles}>Contact Full Name *</label>
                    <input required type="text" placeholder="e.g. John Doe" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} />
                  </div>

                  <div>
                    <label className={labelStyles}>Contact Phone *</label>
                    <input 
                      required 
                      type="tel" 
                      inputMode="numeric" 
                      pattern="[0-9+]*" 
                      minLength={14}
                      maxLength={14}
                      placeholder="+155500000000" 
                      className={inputStyles} 
                      style={{ '--tw-ring-color': brandColor } as React.CSSProperties} 
                      value={formData.parentContact} 
                      onChange={(e) => handleNumericChange(e, (val) => setFormData({...formData, parentContact: val}))} 
                    />
                  </div>

                  <div>
                    <label className={labelStyles}>Contact Email</label>
                    <input type="email" placeholder="contact@example.com" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.parentEmail} onChange={e => setFormData({...formData, parentEmail: e.target.value})} />
                  </div>
                </>
              ) : (
                /* K-12 Layout */
                <>
                  <div className={sectionBorderStyles.replace("mt-6", "mt-2")}>
                    <h3 className={sectionHeaderStyles}>Student Details</h3>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className={labelStyles}>Student Full Name *</label>
                    <input required type="text" placeholder="e.g. Timmy Doe" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.applicantName} onChange={e => setFormData({...formData, applicantName: e.target.value})} />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelStyles}>Target Grade/Class *</label>
                    <select required className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.targetGrade} onChange={e => setFormData({...formData, targetGrade: e.target.value})}>
                      <option value="">Select a class...</option>
                      {renderClassOptions()}
                    </select>
                  </div>

                  <div className={sectionBorderStyles}>
                    <h3 className={sectionHeaderStyles}>
                      {isHigherEd ? "Sponsor / Next of Kin Details" : "Parent / Guardian Details"}
                    </h3>
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelStyles}>Parent/Guardian Full Name *</label>
                    <input required type="text" placeholder="e.g. John Doe" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} />
                  </div>
                  
                  <div>
                    <label className={labelStyles}>Parent Phone *</label>
                    <input 
                      required 
                      type="tel" 
                      inputMode="numeric" 
                      pattern="[0-9+]*" 
                      minLength={14}
                      maxLength={14}
                      placeholder="+155500000000" 
                      className={inputStyles} 
                      style={{ '--tw-ring-color': brandColor } as React.CSSProperties} 
                      value={formData.parentContact} 
                      onChange={(e) => handleNumericChange(e, (val) => setFormData({...formData, parentContact: val}))} 
                    />
                  </div>
                  
                  <div>
                    <label className={labelStyles}>Parent Email (Optional)</label>
                    <input type="email" placeholder="john@example.com" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.parentEmail} onChange={e => setFormData({...formData, parentEmail: e.target.value})} />
                  </div>
                </>
              )}
            </>
          )}

        </div>

        <div className="pt-6 mt-8 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button 
            type="submit" 
            disabled={isPending || !formData.tierId} 
            className="w-full md:w-auto px-10 py-4 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:hover:translate-y-0 hover:-translate-y-0.5"
            style={{ backgroundColor: brandColor }}
          >
            {isPending ? "Submitting Application..." : "Submit Application"}
          </button>
        </div>
      </form>
    </div>
  );
}
