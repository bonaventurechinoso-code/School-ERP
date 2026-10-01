"use client";

import React, { useState, useTransition, useEffect } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  // Extract schoolDomain safely from pathname: e.g. "/springfield-academy/apply" -> "springfield-academy"
  const domainFromPath = pathname ? pathname.split("/").filter(Boolean)[0] : null;
  const currentDomain = domainFromPath || schoolDomain;

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

  const [step, setStep] = useState<number>(1);
  const [submittedAppNo, setSubmittedAppNo] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const handleContinueToStep2 = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!formData.applicantName.trim()) {
      setFormError("Student Full Name is required.");
      return;
    }
    if (!formData.studentEmail.trim()) {
      setFormError("Student / Account Email is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.studentEmail.trim())) {
      setFormError("Please enter a valid Student / Account Email.");
      return;
    }
    if (!formData.targetGrade.trim()) {
      setFormError("Target Grade/Class is required.");
      return;
    }

    if (isHigherEd) {
      if (!formData.facultyOrSchool) {
        setFormError(`Please select ${orgUnitLabel}.`);
        return;
      }
      if (!formData.intendedCourseOrProgramme) {
        setFormError(`Please select ${courseProgrammeLabel}.`);
        return;
      }
    }

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (step === 1) {
      handleContinueToStep2();
      return;
    }

    if (!formData.parentName.trim()) {
      setFormError("Parent/Guardian Full Name is required.");
      return;
    }

    if (!formData.parentContact.trim()) {
      setFormError("Parent Phone is required.");
      return;
    }

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
          const resData = await res.json();
          const applicationNo = resData.applicationNo || resData.appNo || resData.lead?.id;
          const derivedDomain = typeof window !== "undefined" ? window.location.pathname.split('/')[1] : schoolDomain;
          const encoded = encodeURIComponent(applicationNo);
          const finalUrl = `/${derivedDomain}/admissions/track/${encoded}`;
          console.log("[PublicApplyForm] Redirect URL built:", finalUrl, { applicationNo, encoded, schoolDomain: derivedDomain });
          setSubmittedAppNo(applicationNo);
          setRedirectUrl(finalUrl);
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
    const derivedDomain = typeof window !== "undefined" ? window.location.pathname.split('/')[1] : schoolDomain;
    const encoded = encodeURIComponent(submittedAppNo || "");
    const finalTrackUrl = redirectUrl || `/${derivedDomain}/admissions/track/${encoded}`;
    return (
      <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 rounded-3xl shadow-xl p-8 sm:p-12 text-center animate-in fade-in zoom-in-95">
        <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Application Received!</h2>
        {submittedAppNo && (
          <div className="inline-block mt-3 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-sm border border-indigo-200 dark:border-indigo-800">
            Application No: {submittedAppNo}
          </div>
        )}
        <p className="mt-4 text-zinc-600 dark:text-zinc-300 text-base max-w-lg mx-auto">
          Thank you for applying to <strong>{schoolName}</strong>. Next step: upload your verification documents to complete your admission processing.
        </p>

        {/* Save your tracking link */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 max-w-lg mx-auto text-left">
          <p className="font-semibold text-slate-800 dark:text-zinc-200 mb-1">Save your tracking link:</p>
          <div className="font-mono break-all text-indigo-600 dark:text-indigo-400 select-all">
            {typeof window !== "undefined" ? `${window.location.origin}${finalTrackUrl}` : finalTrackUrl}
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              const domain = typeof window !== "undefined" ? window.location.pathname.split('/')[1] : schoolDomain;
              const encodedAppNo = encodeURIComponent(submittedAppNo || "");
              const finalUrl = `/${domain}/admissions/track/${encodedAppNo}`;
              console.log("[PublicApplyForm] Navigating to track page via window.location.replace:", finalUrl);
              window.location.replace(finalUrl);
            }}
            className="w-full sm:w-auto px-8 py-3.5 text-white rounded-xl font-bold transition-transform hover:-translate-y-0.5 shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: brandColor }}
          >
            <span>Go to track page</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => {
              const domain = typeof window !== "undefined" ? window.location.pathname.split('/')[1] : schoolDomain;
              window.location.replace(`/${domain}`);
            }}
            className="w-full sm:w-auto px-6 py-3.5 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl font-bold transition cursor-pointer"
          >
            Return to Website
          </button>
        </div>
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

      {/* 2-Step Progress Indicator */}
      <div className="px-6 md:px-10 pt-6 pb-2">
        <div className="flex items-center justify-between max-w-xs mx-auto relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-zinc-800 -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 left-0 h-0.5 transition-all duration-300 -translate-y-1/2 z-0"
            style={{
              width: step === 1 ? "0%" : "100%",
              backgroundColor: brandColor || "#4f46e5",
            }}
          />

          {/* Step 1 Pill */}
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setStep(1);
            }}
            className="relative z-10 flex flex-col items-center group cursor-pointer"
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-sm ${
                step === 1
                  ? "text-white ring-4 ring-indigo-100 dark:ring-indigo-950"
                  : "bg-emerald-500 text-white"
              }`}
              style={{ backgroundColor: step === 1 ? (brandColor || "#0f172a") : undefined }}
            >
              {step > 1 ? "✓" : "1"}
            </div>
            <span
              className={`text-xs mt-1.5 font-bold ${
                step === 1 ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-zinc-400"
              }`}
            >
              Student Details
            </span>
          </button>

          {/* Step 2 Pill */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-sm ${
                step === 2
                  ? "text-white ring-4 ring-indigo-100 dark:ring-indigo-950"
                  : "bg-slate-200 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
              style={{ backgroundColor: step === 2 ? (brandColor || "#0f172a") : undefined }}
            >
              2
            </div>
            <span
              className={`text-xs mt-1.5 font-bold ${
                step === 2 ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-zinc-500"
              }`}
            >
              Parent &amp; Security
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-8">
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            {/* Academic Tier pills */}
            <div className="md:col-span-2 flex flex-col items-start">
              <label className={labelStyles}>Academic Tier</label>
              <div className="flex flex-wrap gap-2">
                {tiers && tiers.length > 0 ? (
                  tiers.map((t) => {
                    const isSelected =
                      formData.tierId === t.id ||
                      (tier && t.name.toLowerCase() === tier.toLowerCase());
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTier(t.name);
                          setFormData((prev) => ({ ...prev, tierId: t.id, targetGrade: "" }));
                        }}
                        className={`inline-flex items-center px-4 py-2 rounded-xl border font-medium text-sm transition-all cursor-pointer ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-200 shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full mr-2.5 shadow-sm"
                          style={{
                            backgroundColor: isSelected ? (brandColor || "#4f46e5") : "#94a3b8",
                          }}
                        />
                        {formatTierLabel(t.name)}
                      </button>
                    );
                  })
                ) : (
                  <div className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 font-medium text-sm shadow-sm">
                    <span
                      className="w-2.5 h-2.5 rounded-full mr-3 shadow-sm"
                      style={{ backgroundColor: brandColor }}
                    />
                    {tier}
                  </div>
                )}
              </div>
            </div>

            {formData.tierId && (
              <>
                {isHigherEd ? (
                  <>
                    <div className={panelStyles}>
                      <h3 className={sectionHeaderStyles}>Applicant Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                          <label className={labelStyles}>Full Name *</label>
                          <input
                            required
                            type="text"
                            placeholder="e.g. Jane Doe"
                            className={inputStyles}
                            style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                            value={formData.applicantName}
                            onChange={(e) =>
                              setFormData({ ...formData, applicantName: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className={labelStyles}>Personal Email *</label>
                          <input
                            required
                            type="email"
                            placeholder="jane@example.com"
                            className={inputStyles}
                            style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                            value={formData.studentEmail}
                            onChange={(e) =>
                              setFormData({ ...formData, studentEmail: e.target.value })
                            }
                          />
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
                            style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                            value={formData.studentPhone}
                            onChange={(e) =>
                              handleNumericChange(e, (val) =>
                                setFormData({ ...formData, studentPhone: val })
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className={panelStyles}>
                      <h3 className={sectionHeaderStyles}>Academic Programme Selection</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                          <label className={labelStyles}>Academic Level *</label>
                          <select
                            required
                            className={inputStyles}
                            style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                            value={formData.targetGrade}
                            onChange={(e) =>
                              setFormData({ ...formData, targetGrade: e.target.value })
                            }
                          >
                            <option value="">Select a level...</option>
                            {renderClassOptions()}
                          </select>
                        </div>
                        <div>
                          <label className={labelStyles}>{orgUnitLabel}</label>
                          <select
                            required
                            className={inputStyles}
                            style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                            value={formData.facultyOrSchool}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                facultyOrSchool: e.target.value,
                                intendedCourseOrProgramme: "",
                              })
                            }
                          >
                            <option value="">Select...</option>
                            {Object.keys(activeHierarchy).map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelStyles}>{courseProgrammeLabel}</label>
                          <select
                            required
                            disabled={!formData.facultyOrSchool}
                            className={inputStyles}
                            style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                            value={formData.intendedCourseOrProgramme}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                intendedCourseOrProgramme: e.target.value,
                              })
                            }
                          >
                            <option value="">
                              {formData.facultyOrSchool
                                ? "Select a programme..."
                                : "Make a selection above first"}
                            </option>
                            {formData.facultyOrSchool &&
                              activeHierarchy[formData.facultyOrSchool]?.map((prog) => (
                                <option key={prog} value={prog}>
                                  {prog}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* K-12 Layout (Step 1) */
                  <div className={panelStyles}>
                    <h3 className={sectionHeaderStyles}>Student Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={labelStyles}>Student Full Name *</label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. Timmy Doe"
                          className={inputStyles}
                          style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                          value={formData.applicantName}
                          onChange={(e) =>
                            setFormData({ ...formData, applicantName: e.target.value })
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelStyles}>Student / Account Email *</label>
                        <input
                          required
                          type="email"
                          placeholder="student@example.com"
                          className={inputStyles}
                          style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                          value={formData.studentEmail}
                          onChange={(e) =>
                            setFormData({ ...formData, studentEmail: e.target.value })
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelStyles}>Target Grade/Class *</label>
                        <select
                          required
                          className={inputStyles}
                          style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                          value={formData.targetGrade}
                          onChange={(e) =>
                            setFormData({ ...formData, targetGrade: e.target.value })
                          }
                        >
                          <option value="">Select a class...</option>
                          {renderClassOptions()}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {formError && (
              <div className="md:col-span-2 p-4 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl text-sm font-semibold border border-rose-200 dark:border-rose-900">
                {formError}
              </div>
            )}

            <div className="md:col-span-2 pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleContinueToStep2}
                className="w-full md:w-auto px-8 py-3.5 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: brandColor }}
              >
                <span>Continue to Parent Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            {isHigherEd ? (
              <div className={panelStyles}>
                <h3 className={sectionHeaderStyles}>Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className={labelStyles}>Contact Full Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. John Doe"
                      className={inputStyles}
                      style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                      value={formData.parentName}
                      onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    />
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
                      style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                      value={formData.parentContact}
                      onChange={(e) =>
                        handleNumericChange(e, (val) =>
                          setFormData({ ...formData, parentContact: val })
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className={labelStyles}>Contact Email</label>
                    <input
                      type="email"
                      placeholder="contact@example.com"
                      className={inputStyles}
                      style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                      value={formData.parentEmail}
                      onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className={panelStyles}>
                <h3 className={sectionHeaderStyles}>Parent / Guardian Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className={labelStyles}>Parent/Guardian Full Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. John Doe"
                      className={inputStyles}
                      style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                      value={formData.parentName}
                      onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    />
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
                      style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                      value={formData.parentContact}
                      onChange={(e) =>
                        handleNumericChange(e, (val) =>
                          setFormData({ ...formData, parentContact: val })
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className={labelStyles}>Parent Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="john@example.com"
                      className={inputStyles}
                      style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                      value={formData.parentEmail}
                      onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Student Portal Account Security Panel */}
            <div className={panelStyles}>
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className={sectionHeaderStyles}>Student Portal Account Security</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
                Create a secure password to access your student portal and track your application
                status.
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
                      style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                      style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Real-time validation badges */}
              <div className="flex flex-wrap items-center gap-3 text-xs pt-4">
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    formData.password.length >= 8
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400"
                  }`}
                >
                  {formData.password.length >= 8 ? "✓" : "•"} Min. 8 characters
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    /[a-zA-Z]/.test(formData.password) && /[0-9]/.test(formData.password)
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400"
                  }`}
                >
                  {/[a-zA-Z]/.test(formData.password) && /[0-9]/.test(formData.password)
                    ? "✓"
                    : "•"}{" "}
                  Alphanumeric
                </span>
                {formData.confirmPassword.length > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      formData.password === formData.confirmPassword
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {formData.password === formData.confirmPassword
                      ? "✓ Passwords match"
                      : "⚠ Passwords do not match"}
                  </span>
                )}
              </div>
            </div>

            {formError && (
              <div className="md:col-span-2 p-4 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl text-sm font-semibold border border-rose-200 dark:border-rose-900">
                {formError}
              </div>
            )}

            <div className="md:col-span-2 pt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setStep(1);
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 font-bold text-sm transition cursor-pointer"
              >
                ← Back to Student Details
              </button>

              <button
                type="submit"
                disabled={isPending || !formData.tierId}
                className="w-full sm:w-auto px-10 py-3.5 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:hover:translate-y-0 hover:-translate-y-0.5 cursor-pointer"
                style={{ backgroundColor: brandColor }}
              >
                {isPending ? "Submitting Application..." : "Submit Application"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
