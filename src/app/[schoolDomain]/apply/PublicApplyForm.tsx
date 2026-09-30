"use client";

import React, { useState, useTransition, useEffect } from "react";
import { AcademicTier } from "@prisma/client";
import { GraduationCap, ArrowRight, Loader2, CheckCircle2, CheckCircle, Eye, EyeOff, Lock } from "lucide-react";
import { useNumericInput } from "@/hooks/useNumericInput";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatTierLabel } from "@/lib/guestPortalUtils";
import { NIGERIAN_UNIVERSITY_HIERARCHY, POLYTECHNIC_HIERARCHY, COLLEGE_HIERARCHY } from "@/lib/academicHierarchies";
import { TIER_CLASSES, getClassesForTier } from "@/lib/school-tiers";

export default function PublicApplyForm({
  schoolName,
  schoolDomain,
  schoolTier,
  tiers,
  initialTierId: propInitialTierId,
  classrooms,
  brandColor
}: {
  schoolName: string;
  schoolDomain: string;
  schoolTier?: string;
  tiers: AcademicTier[];
  initialTierId?: string;
  classrooms: any[];
  brandColor: string;
}) {
  const { handleNumericChange } = useNumericInput();
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);
  
  // School tier state with loading guard (defaults to schoolTier or "secondary")
  const [tier, setTier] = useState<string | null>(schoolTier || "secondary");
  const [loadingTier, setLoadingTier] = useState<boolean>(false);

  // Sync / resolve tier on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTier = urlParams.get("tier");
      const cookieTierMatch = document.cookie.match(/(?:^|;\s*)activeTier=([^;]*)/);
      const cookieTier = cookieTierMatch ? decodeURIComponent(cookieTierMatch[1]) : null;
      const resolved = urlTier || cookieTier || schoolTier || "secondary";
      console.log(`[PublicApplyForm] Resolved school tier:`, resolved);
      setTier(resolved);
      setLoadingTier(false);
    }
  }, [schoolTier, tiers]);

  // 1. Automatic Tier Selection matching resolved tier
  const matchedTierRecord = tiers.find(
    (t) =>
      (tier && t.name.toLowerCase() === tier.toLowerCase()) ||
      (tier && t.name.toLowerCase().includes(tier.toLowerCase())) ||
      (tier && tier.toLowerCase().includes(t.name.toLowerCase()))
  );
  const initialTierId = propInitialTierId || matchedTierRecord?.id || (tiers.length > 0 ? tiers[0].id : "");
  
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
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedTier = tiers.find(t => t.id === formData.tierId) || matchedTierRecord;
  const selectedTierName = tier || selectedTier?.name || "";
  
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
    setFormError(null);

    if (formData.password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    if (!hasLetter || !hasNumber) {
      setFormError("Password must be alphanumeric (contain at least one letter and at least one number).");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError("Create Account Password and Confirm Password do not match.");
      return;
    }

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
          setFormError(err.error || "Failed to submit application.");
        }
      } catch (error) {
        setFormError("An error occurred during submission. Please try again.");
      }
    });
  };

  const renderClassOptions = () => {
    if (!tier) return null;
    const classes = getClassesForTier(tier);
    return classes.map((c) => (
      <option key={c} value={c}>
        {c}
      </option>
    ));
  };

  if (loadingTier || !tier) {
    return (
      <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 rounded-3xl shadow-xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-semibold text-slate-600 dark:text-zinc-400">Loading school academic tier...</p>
      </div>
    );
  }

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
          onClick={() => window.location.href = `/${schoolDomain}`} 
          className="mt-8 px-8 py-3 text-white rounded-xl font-bold transition-transform hover:-translate-y-0.5 shadow-lg"
          style={{ backgroundColor: brandColor }}
        >
          Return to Website
        </button>
      </div>
    );
  }

  const inputStyles = "w-full border border-slate-200 rounded-xl p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all bg-white text-slate-900 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 placeholder-slate-400 disabled:bg-slate-50 disabled:dark:bg-zinc-800 disabled:text-slate-400 disabled:dark:text-zinc-500 disabled:cursor-not-allowed";
  const labelStyles = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";
  const sectionHeaderStyles = "font-bold text-slate-900 dark:text-slate-100 text-xl mb-4";
  const panelStyles = "md:col-span-2 bg-slate-50/50 dark:bg-zinc-900/50 p-6 md:p-8 rounded-2xl border border-slate-100 dark:border-zinc-800/80";

  return (
    <div className="bg-white text-slate-900 dark:bg-zinc-950 dark:text-slate-50 rounded-3xl shadow-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <div className="p-8 text-center bg-slate-900 dark:bg-zinc-950 rounded-t-3xl relative transition-colors duration-300">
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm bg-white/10 backdrop-blur-sm border border-white/20">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Apply to {schoolName}</h1>
        <p className="mt-2 text-slate-200 text-sm max-w-lg mx-auto">
          Begin your journey with us by completing this quick inquiry form.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Read-Only Academic Tier Badge */}
          <div className="md:col-span-2 flex flex-col items-start">
            <label className={labelStyles}>Academic Tier</label>
            <div className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 font-medium text-sm shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full mr-3 shadow-sm" style={{ backgroundColor: brandColor }}></span>
              {tier}
            </div>
          </div>

          {formData.tierId && (
            <>
              {/* Higher Ed Layout */}
              {isHigherEd ? (
                <>
                  <div className={panelStyles}>
                    <h3 className={sectionHeaderStyles}>Applicant Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <input required type="tel" inputMode="numeric" pattern="[0-9+]*" minLength={14} maxLength={14} placeholder="+155500000000" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.studentPhone} onChange={(e) => handleNumericChange(e, (val) => setFormData({...formData, studentPhone: val}))} />
                      </div>
                    </div>
                  </div>

                  <div className={panelStyles}>
                    <h3 className={sectionHeaderStyles}>Academic Programme Selection</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    </div>
                  </div>

                  <div className={panelStyles}>
                    <h3 className={sectionHeaderStyles}>Emergency Contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={labelStyles}>Contact Full Name *</label>
                        <input required type="text" placeholder="e.g. John Doe" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} />
                      </div>
                      <div>
                        <label className={labelStyles}>Contact Phone *</label>
                        <input required type="tel" inputMode="numeric" pattern="[0-9+]*" minLength={14} maxLength={14} placeholder="+155500000000" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.parentContact} onChange={(e) => handleNumericChange(e, (val) => setFormData({...formData, parentContact: val}))} />
                      </div>
                      <div>
                        <label className={labelStyles}>Contact Email</label>
                        <input type="email" placeholder="contact@example.com" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.parentEmail} onChange={e => setFormData({...formData, parentEmail: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* K-12 Layout */
                <>
                    <div className={panelStyles}>
                    <h3 className={sectionHeaderStyles}>Student Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={labelStyles}>Student Full Name *</label>
                        <input required type="text" placeholder="e.g. Timmy Doe" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.applicantName} onChange={e => setFormData({...formData, applicantName: e.target.value})} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelStyles}>Student / Account Email *</label>
                        <input required type="email" placeholder="student@example.com" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.studentEmail} onChange={e => setFormData({...formData, studentEmail: e.target.value})} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelStyles}>Target Grade/Class *</label>
                        <select required className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.targetGrade} onChange={e => setFormData({...formData, targetGrade: e.target.value})}>
                          <option value="">Select a class...</option>
                          {renderClassOptions()}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className={panelStyles}>
                    <h3 className={sectionHeaderStyles}>
                      {isHigherEd ? "Sponsor / Next of Kin Details" : "Parent / Guardian Details"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={labelStyles}>Parent/Guardian Full Name *</label>
                        <input required type="text" placeholder="e.g. John Doe" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} />
                      </div>
                      <div>
                        <label className={labelStyles}>Parent Phone *</label>
                        <input required type="tel" inputMode="numeric" pattern="[0-9+]*" minLength={14} maxLength={14} placeholder="+155500000000" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.parentContact} onChange={(e) => handleNumericChange(e, (val) => setFormData({...formData, parentContact: val}))} />
                      </div>
                      <div>
                        <label className={labelStyles}>Parent Email (Optional)</label>
                        <input type="email" placeholder="john@example.com" className={inputStyles} style={{ '--tw-ring-color': brandColor } as React.CSSProperties} value={formData.parentEmail} onChange={e => setFormData({...formData, parentEmail: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Student Portal Account Security Panel */}
              <div className={panelStyles}>
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className={sectionHeaderStyles}>Student Portal Account Security</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
                  Create a secure password to access your student portal and track your application status.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelStyles}>Create Account Password *</label>
                    <div className="relative">
                      <input 
                        required
                        type={showPassword ? "text" : "password"}
                        placeholder="Min. 8 alphanumeric characters"
                        className={`${inputStyles} pr-10`}
                        style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelStyles}>Confirm Password *</label>
                    <div className="relative">
                      <input 
                        required
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter password"
                        className={`${inputStyles} pr-10`}
                        style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                        value={formData.confirmPassword}
                        onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Real-time validation badges */}
                <div className="flex flex-wrap items-center gap-3 text-xs pt-4">
                  <span className={`inline-flex items-center gap-1 font-semibold ${
                    formData.password.length >= 8 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                  }`}>
                    {formData.password.length >= 8 ? "✓" : "•"} Min. 8 characters
                  </span>
                  <span className={`inline-flex items-center gap-1 font-semibold ${
                    (/[a-zA-Z]/.test(formData.password) && /[0-9]/.test(formData.password)) ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                  }`}>
                    {(/[a-zA-Z]/.test(formData.password) && /[0-9]/.test(formData.password)) ? "✓" : "•"} Alphanumeric
                  </span>
                  {formData.confirmPassword.length > 0 && (
                    <span className={`inline-flex items-center gap-1 font-semibold ${
                      formData.password === formData.confirmPassword ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                    }`}>
                      {formData.password === formData.confirmPassword ? "✓ Passwords match" : "⚠ Passwords do not match"}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

        {formError && (
          <div className="p-4 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl text-sm font-semibold border border-rose-200 dark:border-rose-900">
            {formError}
          </div>
        )}

        <div className="pt-8 flex justify-end">
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
