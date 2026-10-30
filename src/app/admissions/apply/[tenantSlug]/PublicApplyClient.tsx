"use client";

import React, { useState, useTransition, useId } from "react";
import Link from "next/link";
import {
  User,
  GraduationCap,
  FileText,
  ClipboardCheck,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Upload,
  Check,
  Copy,
  Printer,
  ShieldCheck,
  Building,
  School,
  Baby,
  BookOpen,
  Calendar,
  Phone,
  Mail,
  Home,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  NigerianTier,
  PersonalData,
  CrecheData,
  NurseryPrimaryData,
  SecondaryData,
  TertiaryData,
  WaecSubjectRow,
  UploadedDoc,
  DocumentsData,
  PaymentData,
  PublicApplicationPayload,
} from "./types";
import { submitPublicApplicationAction } from "./actions";

const DEFAULT_WAEC_SUBJECTS = [
  "English Language",
  "Mathematics",
  "Biology",
  "Chemistry",
  "Physics",
  "Economics",
  "Government",
  "Literature in English",
  "Agricultural Science",
];

const WAEC_GRADES = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"] as const;

export interface PublicApplyClientProps {
  schoolId: string;
  schoolName: string;
  tenantSlug: string;
  schoolSubdomain: string;
  availableTiers: { id: string; name: string }[];
  initialTier?: NigerianTier;
  bankAccountDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

export default function PublicApplyClient({
  schoolId,
  schoolName,
  tenantSlug,
  schoolSubdomain,
  availableTiers,
  initialTier = "NURSERY_PRIMARY",
  bankAccountDetails = {
    bankName: "Zenith Bank PLC",
    accountNumber: "1012345678",
    accountName: `${schoolName} Admissions`,
  },
}: PublicApplyClientProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  // STEP 1 - Personal Data State
  const [personal, setPersonal] = useState<PersonalData>({
    firstName: "",
    lastName: "",
    middleName: "",
    dateOfBirth: "",
    gender: "",
    photoUrl: "",
    photoName: "",
    parentName: "",
    parentRelationship: "Father",
    parentPhone: "",
    parentEmail: "",
    residentialAddress: "",
    stateOfOrigin: "",
    lga: "",
  });

  // STEP 2 - Academic & Nigerian Tiers State
  const [selectedTier, setSelectedTier] = useState<NigerianTier>(initialTier);

  const [creche, setCreche] = useState<CrecheData>({
    immunizationChecklist: {
      bcg: true,
      opv: true,
      dpt: true,
      measles: true,
      vitaminA: true,
      yellowFever: false,
    },
    bloodGroup: "O+",
    genotype: "AA",
    allergies: "None",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  const [nurseryPrimary, setNurseryPrimary] = useState<NurseryPrimaryData>({
    guardianNin: "",
    previousSchool: "",
    previousClass: "",
    classApplying: "Primary 1",
    hasSpecialNeeds: false,
    specialNeedsDescription: "",
  });

  const [secondary, setSecondary] = useState<SecondaryData>({
    beceResultStatus: "Passed",
    beceAggregateScore: "",
    jss3SchoolAttended: "",
    jss3CompletionYear: "2026",
    classApplying: "JSS 1",
    secondaryChoice: "Science",
  });

  const [tertiary, setTertiary] = useState<TertiaryData>({
    jambRegNumber: "",
    jambScore: "",
    jambYear: "2026",
    facultyChoice: "Sciences",
    courseOfStudy: "Computer Science",
    waecSitting1: {
      examType: "WAEC",
      examYear: "2025",
      centerNumber: "420108",
      results: [
        { subject: "English Language", grade: "B3" },
        { subject: "Mathematics", grade: "A1" },
        { subject: "Physics", grade: "B2" },
        { subject: "Chemistry", grade: "B3" },
        { subject: "Biology", grade: "C4" },
      ],
    },
    hasSecondSitting: false,
    waecSitting2: {
      examType: "NECO",
      examYear: "2025",
      centerNumber: "510923",
      results: [{ subject: "Economics", grade: "C5" }],
    },
  });

  // STEP 3 - Documents State
  const [documents, setDocuments] = useState<DocumentsData>({});

  // STEP 4 - Summary Declaration State
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  // STEP 5 - Payment State
  const [payment, setPayment] = useState<PaymentData>({
    amount: 5000,
    feeType: "Application Form Processing Fee",
    paymentMethod: "BANK_TRANSFER",
    bankName: bankAccountDetails.bankName,
    accountNumber: bankAccountDetails.accountNumber,
    accountName: bankAccountDetails.accountName,
    paymentReference: `FORM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    senderAccountName: "",
    senderBank: "",
    transactionReference: "",
  });

  // Steps configuration
  const steps = [
    { number: 1, label: "Personal", icon: User },
    { number: 2, label: "Academic", icon: GraduationCap },
    { number: 3, label: "Documents", icon: FileText },
    { number: 4, label: "Summary", icon: ClipboardCheck },
    { number: 5, label: "Payment", icon: CreditCard },
  ];

  // Helper for mock document file upload
  const handleFileUpload = (docType: keyof DocumentsData, file: File | null) => {
    if (!file) return;
    const sizeKb = Math.round(file.size / 1024);
    const uploaded: UploadedDoc = {
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      type: file.type || "application/octet-stream",
      fileSize: `${sizeKb} KB`,
      uploadedAt: new Date().toLocaleTimeString(),
    };
    setDocuments((prev) => ({ ...prev, [docType]: uploaded }));
  };

  // Helper to add subject to tertiary sitting
  const addSubjectRow = (sitting: 1 | 2) => {
    if (sitting === 1) {
      setTertiary((prev) => ({
        ...prev,
        waecSitting1: {
          ...prev.waecSitting1,
          results: [...prev.waecSitting1.results, { subject: "", grade: "" }],
        },
      }));
    } else {
      setTertiary((prev) => ({
        ...prev,
        waecSitting2: {
          ...prev.waecSitting2!,
          results: [...(prev.waecSitting2?.results || []), { subject: "", grade: "" }],
        },
      }));
    }
  };

  const removeSubjectRow = (sitting: 1 | 2, index: number) => {
    if (sitting === 1) {
      setTertiary((prev) => ({
        ...prev,
        waecSitting1: {
          ...prev.waecSitting1,
          results: prev.waecSitting1.results.filter((_, idx) => idx !== index),
        },
      }));
    } else {
      setTertiary((prev) => ({
        ...prev,
        waecSitting2: {
          ...prev.waecSitting2!,
          results: (prev.waecSitting2?.results || []).filter((_, idx) => idx !== index),
        },
      }));
    }
  };

  // Validation per step
  const validateStep = (stepNumber: number): boolean => {
    setErrorMessage(null);
    if (stepNumber === 1) {
      if (!personal.firstName.trim() || !personal.lastName.trim()) {
        setErrorMessage("Please enter both First Name and Last Name.");
        return false;
      }
      if (!personal.dateOfBirth) {
        setErrorMessage("Please provide candidate's Date of Birth.");
        return false;
      }
      if (!personal.gender) {
        setErrorMessage("Please select applicant Gender.");
        return false;
      }
      if (!personal.parentName.trim() || !personal.parentPhone.trim()) {
        setErrorMessage("Please provide Parent/Guardian Name and Phone Number.");
        return false;
      }
      return true;
    }

    if (stepNumber === 2) {
      if (selectedTier === "NURSERY_PRIMARY") {
        if (nurseryPrimary.guardianNin && nurseryPrimary.guardianNin.length !== 11) {
          setErrorMessage("National Identification Number (NIN) must be exactly 11 digits.");
          return false;
        }
        if (!nurseryPrimary.classApplying) {
          setErrorMessage("Please select the class applied for.");
          return false;
        }
      } else if (selectedTier === "SECONDARY") {
        if (!secondary.classApplying) {
          setErrorMessage("Please select secondary class applying for.");
          return false;
        }
      } else if (selectedTier === "TERTIARY") {
        if (!tertiary.jambScore || parseInt(tertiary.jambScore) < 100) {
          setErrorMessage("Please enter a valid JAMB / UTME score (min 100).");
          return false;
        }
        if (!tertiary.courseOfStudy.trim()) {
          setErrorMessage("Please provide intended Course / Programme of study.");
          return false;
        }
      }
      return true;
    }

    if (stepNumber === 4) {
      if (!declarationAccepted) {
        setErrorMessage("You must accept the truthfulness declaration before proceeding to payment.");
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setErrorMessage(null);
    startTransition(async () => {
      const payload: PublicApplicationPayload = {
        tenantSlug,
        schoolId,
        personal,
        tier: selectedTier,
        creche: selectedTier === "CRECHE" ? creche : undefined,
        nurseryPrimary: selectedTier === "NURSERY_PRIMARY" ? nurseryPrimary : undefined,
        secondary: selectedTier === "SECONDARY" ? secondary : undefined,
        tertiary: selectedTier === "TERTIARY" ? tertiary : undefined,
        documents,
        payment,
        declarationAccepted,
      };

      const result = await submitPublicApplicationAction(payload);
      if (result.success && result.applicationRef) {
        setSubmittedRef(result.applicationRef);
      } else {
        setErrorMessage(result.error || "Failed to submit application. Please try again.");
      }
    });
  };

  const copyRefToClipboard = () => {
    if (submittedRef) {
      navigator.clipboard.writeText(submittedRef);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2500);
    }
  };

  // If application was successfully submitted, display confirmation view
  if (submittedRef) {
    return (
      <div className="w-full max-w-xl mx-auto px-3 sm:px-4 py-6 sm:py-8 animate-in fade-in duration-300 overflow-hidden">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-md text-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-semibold rounded-full uppercase tracking-wider mb-2">
            Application Received • INQUIRY Stage
          </span>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white break-words">
            Application Submitted Successfully!
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-sm mt-2">
            Your admission file has been logged into the official admissions register of{" "}
            <strong>{schoolName}</strong>.
          </p>

          {/* Reference Box */}
          <div className="my-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Official Application Reference Number
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-3xl font-extrabold tracking-wider sm:tracking-widest text-indigo-600 dark:text-indigo-400 font-mono break-all">
                {submittedRef}
              </span>
              <button
                onClick={copyRefToClipboard}
                title="Copy Reference"
                className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 text-slate-600 dark:text-slate-200 transition-colors"
              >
                {copiedRef ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {copiedRef && <span className="text-xs text-emerald-600 font-medium">Copied to clipboard!</span>}
          </div>

          {/* Key Instructions */}
          <div className="text-left bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 text-xs text-blue-900 dark:text-blue-200 space-y-2 mb-6">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <span>
                Please quote reference <strong>{submittedRef}</strong> in any bank payment narration or admission inquiry.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <span>
                An SMS/Email confirmation will be dispatched to <strong>{personal.parentPhone}</strong>.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => window.print()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Slip
            </button>
            <Link
              href={`/${schoolSubdomain}/admissions/track/${encodeURIComponent(submittedRef)}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shadow-sm"
            >
              Track Application
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-6 pt-4 pb-28 overflow-hidden">
      {/* Top Tenant Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800 w-full">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Phase 2 Public Portal
          </span>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white break-words">
            {schoolName}
          </h1>
        </div>
        <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] sm:text-xs font-semibold rounded-full border border-indigo-200/60 shrink-0 self-start sm:self-auto">
          2026/2027 Admissions
        </span>
      </div>

      {/* Stepper Progress Bar (Top) */}
      <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Progress indicator percentage */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
          <span>
            Step {currentStep} of {steps.length}: {steps[currentStep - 1].label}
          </span>
          <span className="text-indigo-600 dark:text-indigo-400">
            {Math.round(((currentStep - 1) / (steps.length - 1)) * 100)}% Complete
          </span>
        </div>

        {/* Progress bar line */}
        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>

        {/* Steps Bubbles */}
        <div className="grid grid-cols-5 gap-1">
          {steps.map((st) => {
            const Icon = st.icon;
            const isCompleted = currentStep > st.number;
            const isCurrent = currentStep === st.number;

            return (
              <button
                key={st.number}
                type="button"
                onClick={() => {
                  if (st.number < currentStep) setCurrentStep(st.number);
                }}
                disabled={st.number > currentStep}
                className={`flex flex-col items-center text-center p-1 rounded-lg transition-colors ${
                  isCurrent
                    ? "text-indigo-600 font-bold"
                    : isCompleted
                    ? "text-emerald-600 font-medium"
                    : "text-slate-400"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold mb-1 transition-all ${
                    isCurrent
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-900/40"
                      : isCompleted
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className="text-[10px] hidden sm:block truncate w-full">{st.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: PERSONAL INFORMATION */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              Candidate Personal Details
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter official candidate information as seen on official documents.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chidera"
                  value={personal.firstName}
                  onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Last Name (Surname) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Okeke"
                  value={personal.lastName}
                  onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Middle Name
                </label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={personal.middleName}
                  onChange={(e) => setPersonal({ ...personal, middleName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date of Birth <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={personal.dateOfBirth}
                  onChange={(e) => setPersonal({ ...personal, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <select
                  value={personal.gender}
                  onChange={(e) => setPersonal({ ...personal, gender: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            {/* Passport Photo Upload preview */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Candidate Passport Photo
              </label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 overflow-hidden">
                  {personal.photoUrl ? (
                    <img src={personal.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    id="passport-input"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const url = URL.createObjectURL(f);
                        setPersonal({ ...personal, photoUrl: url, photoName: f.name });
                        handleFileUpload("passportPhoto", f);
                      }
                    }}
                  />
                  <label
                    htmlFor="passport-input"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {personal.photoName ? "Change Photo" : "Upload Passport (JPG/PNG)"}
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1">Clear white background recommended (max 2MB).</p>
                </div>
              </div>
            </div>
          </div>

          {/* Parent / Guardian Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-600" />
              Parent / Guardian Information
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Primary point of contact for admission notifications and verification.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Parent / Guardian Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chief Emeka Okeke"
                  value={personal.parentName}
                  onChange={(e) => setPersonal({ ...personal, parentName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Relationship <span className="text-rose-500">*</span>
                </label>
                <select
                  value={personal.parentRelationship}
                  onChange={(e) => setPersonal({ ...personal, parentRelationship: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Legal Guardian">Legal Guardian</option>
                  <option value="Sponsor">Sponsor</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Phone Number (SMS alerts) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 08031234567"
                  value={personal.parentPhone}
                  onChange={(e) => setPersonal({ ...personal, parentPhone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Parent / Contact Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. guardian@gmail.com"
                  value={personal.parentEmail}
                  onChange={(e) => setPersonal({ ...personal, parentEmail: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  State of Origin
                </label>
                <input
                  type="text"
                  placeholder="e.g. Enugu State"
                  value={personal.stateOfOrigin}
                  onChange={(e) => setPersonal({ ...personal, stateOfOrigin: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 14 Independence Layout, Enugu"
                  value={personal.residentialAddress}
                  onChange={(e) => setPersonal({ ...personal, residentialAddress: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: ACADEMIC & NIGERIAN TIERS LOGIC */}
      {currentStep === 2 && (
        <div className="space-y-4">
          {/* Tier Selector Tabs */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <School className="w-4 h-4 text-indigo-600" />
              Select Educational Tier
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Select the academic level you are applying for to load required Nigerian curriculum fields.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: "CRECHE", label: "Creche / Daycare", icon: Baby },
                  { id: "NURSERY_PRIMARY", label: "Nursery / Primary", icon: School },
                  { id: "SECONDARY", label: "Secondary (JSS/SSS)", icon: BookOpen },
                  { id: "TERTIARY", label: "Tertiary / Higher", icon: GraduationCap },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                const isSelected = selectedTier === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTier(t.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs ring-2 ring-indigo-500/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1.5" />
                    <span className="text-xs">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TIER 1: CRECHE SPECIFIC LOGIC */}
          {selectedTier === "CRECHE" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Baby className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Early Childhood & Immunization Checklist
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Required for Nigerian Daycare & Creche health compliance.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {[
                  { key: "bcg", label: "BCG (Tuberculosis)" },
                  { key: "opv", label: "OPV (Oral Polio)" },
                  { key: "dpt", label: "DPT (Triple Antigen)" },
                  { key: "measles", label: "Measles Vaccine" },
                  { key: "vitaminA", label: "Vitamin A Drops" },
                  { key: "yellowFever", label: "Yellow Fever" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={(creche.immunizationChecklist as any)[item.key]}
                      onChange={(e) =>
                        setCreche({
                          ...creche,
                          immunizationChecklist: {
                            ...creche.immunizationChecklist,
                            [item.key]: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={creche.bloodGroup}
                    onChange={(e) => setCreche({ ...creche, bloodGroup: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="O+">O Positive (O+)</option>
                    <option value="O-">O Negative (O-)</option>
                    <option value="A+">A Positive (A+)</option>
                    <option value="B+">B Positive (B+)</option>
                    <option value="AB+">AB Positive (AB+)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Genotype
                  </label>
                  <select
                    value={creche.genotype}
                    onChange={(e) => setCreche({ ...creche, genotype: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="AA">AA (Standard)</option>
                    <option value="AS">AS (Carrier)</option>
                    <option value="SS">SS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Known Allergies
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Groundnut, Dust, None"
                    value={creche.allergies}
                    onChange={(e) => setCreche({ ...creche, allergies: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TIER 2: NURSERY / PRIMARY SPECIFIC LOGIC */}
          {selectedTier === "NURSERY_PRIMARY" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <School className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Basic Education Details & Identity Verification
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Class Applying For <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={nurseryPrimary.classApplying}
                    onChange={(e) => setNurseryPrimary({ ...nurseryPrimary, classApplying: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-medium text-indigo-700 dark:text-indigo-400"
                  >
                    <option value="Pre-Nursery">Pre-Nursery</option>
                    <option value="Nursery 1">Nursery 1</option>
                    <option value="Nursery 2">Nursery 2</option>
                    <option value="Nursery 3">Nursery 3</option>
                    <option value="Primary 1">Primary 1</option>
                    <option value="Primary 2">Primary 2</option>
                    <option value="Primary 3">Primary 3</option>
                    <option value="Primary 4">Primary 4</option>
                    <option value="Primary 5">Primary 5</option>
                    <option value="Primary 6">Primary 6</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Guardian NIN (National Identity No)
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    placeholder="11 digits (e.g. 10293847561)"
                    value={nurseryPrimary.guardianNin}
                    onChange={(e) =>
                      setNurseryPrimary({
                        ...nurseryPrimary,
                        guardianNin: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">11-digit NIN for statutory verification.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Previous School Attended
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Holy Child Preparatory, Enugu"
                    value={nurseryPrimary.previousSchool}
                    onChange={(e) => setNurseryPrimary({ ...nurseryPrimary, previousSchool: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Last Class Completed
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nursery 2 / Primary 2"
                    value={nurseryPrimary.previousClass}
                    onChange={(e) => setNurseryPrimary({ ...nurseryPrimary, previousClass: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TIER 3: SECONDARY SPECIFIC LOGIC */}
          {selectedTier === "SECONDARY" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Secondary Placement & BECE Examination Result
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Class Applying For <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={secondary.classApplying}
                    onChange={(e) => setSecondary({ ...secondary, classApplying: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-medium text-indigo-700 dark:text-indigo-400"
                  >
                    <option value="JSS 1">JSS 1 (Junior Secondary 1)</option>
                    <option value="JSS 2">JSS 2 (Junior Secondary 2)</option>
                    <option value="JSS 3">JSS 3 (Junior Secondary 3)</option>
                    <option value="SSS 1">SSS 1 (Senior Secondary 1)</option>
                    <option value="SSS 2">SSS 2 (Senior Secondary 2)</option>
                    <option value="SSS 3">SSS 3 (Senior Secondary 3)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Academic Department / Secondary Choice
                  </label>
                  <select
                    value={secondary.secondaryChoice}
                    onChange={(e) => setSecondary({ ...secondary, secondaryChoice: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="General Junior">General Junior (JSS 1 - 3)</option>
                    <option value="Science">Pure Sciences (Physics, Chem, Bio)</option>
                    <option value="Arts">Humanities / Arts (Literature, Govt)</option>
                    <option value="Commercial">Commercial / Business Studies</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    BECE Result Status
                  </label>
                  <select
                    value={secondary.beceResultStatus}
                    onChange={(e) => setSecondary({ ...secondary, beceResultStatus: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="Passed">Passed (Results Available)</option>
                    <option value="Awaiting">Awaiting Result (AR)</option>
                    <option value="Exempted">Exempted / Transfer Entry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    BECE Aggregate / Distinctions
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 7 Distinctions / 4 Credits"
                    value={secondary.beceAggregateScore || ""}
                    onChange={(e) => setSecondary({ ...secondary, beceAggregateScore: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    JSS3 / Prior School Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Federal Govt College"
                    value={secondary.jss3SchoolAttended}
                    onChange={(e) => setSecondary({ ...secondary, jss3SchoolAttended: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TIER 4: TERTIARY SPECIFIC LOGIC (JAMB + WAEC TABLE) */}
          {selectedTier === "TERTIARY" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Tertiary Admissions (JAMB &amp; O&apos;Level Tables)
                </h3>
              </div>

              {/* JAMB Entry */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-purple-900 dark:text-purple-300 mb-1">
                    JAMB / UTME Reg Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 202610482912AF"
                    value={tertiary.jambRegNumber}
                    onChange={(e) => setTertiary({ ...tertiary, jambRegNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-900 dark:text-purple-300 mb-1">
                    JAMB Score (0-400) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={400}
                    placeholder="e.g. 274"
                    value={tertiary.jambScore}
                    onChange={(e) => setTertiary({ ...tertiary, jambScore: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-bold text-purple-700 dark:text-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-900 dark:text-purple-300 mb-1">
                    UTME Year
                  </label>
                  <input
                    type="text"
                    value={tertiary.jambYear}
                    onChange={(e) => setTertiary({ ...tertiary, jambYear: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Course & Faculty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Faculty / School
                  </label>
                  <select
                    value={tertiary.facultyChoice}
                    onChange={(e) => setTertiary({ ...tertiary, facultyChoice: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="Sciences">Faculty of Pure & Applied Sciences</option>
                    <option value="Engineering">Faculty of Engineering & Tech</option>
                    <option value="Arts">Faculty of Arts & Humanities</option>
                    <option value="Management">Faculty of Management & Social Sciences</option>
                    <option value="Law">Faculty of Law</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Intended Course of Study <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science, Medicine, Accounting"
                    value={tertiary.courseOfStudy}
                    onChange={(e) => setTertiary({ ...tertiary, courseOfStudy: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* WAEC / NECO First Sitting Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    O&apos;Level Table — 1st Sitting ({tertiary.waecSitting1.examType})
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <select
                      value={tertiary.waecSitting1.examType}
                      onChange={(e) =>
                        setTertiary({
                          ...tertiary,
                          waecSitting1: { ...tertiary.waecSitting1, examType: e.target.value as any },
                        })
                      }
                      className="px-2 py-1 border rounded dark:bg-slate-800 dark:border-slate-700"
                    >
                      <option value="WAEC">WAEC (WASSCE)</option>
                      <option value="NECO">NECO (SSCE)</option>
                      <option value="NABTEB">NABTEB</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Year"
                      value={tertiary.waecSitting1.examYear}
                      onChange={(e) =>
                        setTertiary({
                          ...tertiary,
                          waecSitting1: { ...tertiary.waecSitting1, examYear: e.target.value },
                        })
                      }
                      className="w-16 px-2 py-1 border rounded dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                </div>

                {/* Table of Subjects x Grades */}
                <div className="space-y-2">
                  {tertiary.waecSitting1.results.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={row.subject}
                        onChange={(e) => {
                          const updated = [...tertiary.waecSitting1.results];
                          updated[index].subject = e.target.value;
                          setTertiary({
                            ...tertiary,
                            waecSitting1: { ...tertiary.waecSitting1, results: updated },
                          });
                        }}
                        className="flex-1 px-2.5 py-1.5 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                      >
                        <option value="">Select Subject</option>
                        {DEFAULT_WAEC_SUBJECTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>

                      <select
                        value={row.grade}
                        onChange={(e) => {
                          const updated = [...tertiary.waecSitting1.results];
                          updated[index].grade = e.target.value as any;
                          setTertiary({
                            ...tertiary,
                            waecSitting1: { ...tertiary.waecSitting1, results: updated },
                          });
                        }}
                        className="w-20 px-2 py-1.5 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-bold"
                      >
                        <option value="">Grade</option>
                        {WAEC_GRADES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removeSubjectRow(1, index)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md"
                        title="Remove Subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addSubjectRow(1)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Subject
                  </button>
                </div>
              </div>

              {/* Second Sitting Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={tertiary.hasSecondSitting}
                    onChange={(e) => setTertiary({ ...tertiary, hasSecondSitting: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Add Second Sitting O&apos;Level Result (Combined Sittings)</span>
                </label>
              </div>

              {/* Optional 2nd Sitting Table */}
              {tertiary.hasSecondSitting && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      O&apos;Level Table — 2nd Sitting ({tertiary.waecSitting2?.examType})
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <select
                        value={tertiary.waecSitting2?.examType}
                        onChange={(e) =>
                          setTertiary({
                            ...tertiary,
                            waecSitting2: {
                              ...tertiary.waecSitting2!,
                              examType: e.target.value as any,
                            },
                          })
                        }
                        className="px-2 py-1 border rounded dark:bg-slate-800 dark:border-slate-700"
                      >
                        <option value="NECO">NECO (SSCE)</option>
                        <option value="WAEC">WAEC (WASSCE)</option>
                        <option value="NABTEB">NABTEB</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Year"
                        value={tertiary.waecSitting2?.examYear}
                        onChange={(e) =>
                          setTertiary({
                            ...tertiary,
                            waecSitting2: {
                              ...tertiary.waecSitting2!,
                              examYear: e.target.value,
                            },
                          })
                        }
                        className="w-16 px-2 py-1 border rounded dark:bg-slate-800 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {tertiary.waecSitting2?.results.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          value={row.subject}
                          onChange={(e) => {
                            const updated = [...(tertiary.waecSitting2?.results || [])];
                            updated[index].subject = e.target.value;
                            setTertiary({
                              ...tertiary,
                              waecSitting2: { ...tertiary.waecSitting2!, results: updated },
                            });
                          }}
                          className="flex-1 px-2.5 py-1.5 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                        >
                          <option value="">Select Subject</option>
                          {DEFAULT_WAEC_SUBJECTS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        <select
                          value={row.grade}
                          onChange={(e) => {
                            const updated = [...(tertiary.waecSitting2?.results || [])];
                            updated[index].grade = e.target.value as any;
                            setTertiary({
                              ...tertiary,
                              waecSitting2: { ...tertiary.waecSitting2!, results: updated },
                            });
                          }}
                          className="w-20 px-2 py-1.5 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-bold"
                        >
                          <option value="">Grade</option>
                          {WAEC_GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => removeSubjectRow(2, index)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addSubjectRow(2)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 pt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Second Sitting Subject
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: DOCUMENT UPLOADS */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Upload Supporting Credentials
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Accepted formats: PDF, JPG, PNG (max 5MB each). Documents can also be supplemented during physical screening.
            </p>

            <div className="space-y-3">
              {[
                {
                  id: "birthCertificate",
                  title: "Birth Certificate / Statutory Declaration of Age",
                  desc: "National Population Commission (NPC) or Court Affidavit",
                  current: documents.birthCertificate,
                },
                {
                  id: "immunizationOrMedical",
                  title: "Medical Report / Immunization Card",
                  desc: "Hospital fitness report or Yellow Card",
                  current: documents.immunizationOrMedical,
                },
                {
                  id: "academicResultOrTranscript",
                  title:
                    selectedTier === "CRECHE"
                      ? "Prior Care Assessment (Optional)"
                      : selectedTier === "TERTIARY"
                      ? "WAEC/NECO Certificate & JAMB Original Result Slip"
                      : "Previous Term Academic Report / BECE Slip",
                  desc: "Official certified academic record",
                  current: documents.academicResultOrTranscript,
                },
                {
                  id: "guardianIdProof",
                  title: "Parent / Guardian Identification Slip",
                  desc: "NIN Slip, Driver's License, or Voter's Card",
                  current: documents.guardianIdProof,
                },
              ].map((doc) => {
                const inputId = `doc-file-${doc.id}`;
                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/20"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{doc.title}</h4>
                      <p className="text-[11px] text-slate-500">{doc.desc}</p>
                      {doc.current && (
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[200px]">{doc.current.name}</span>
                          <span className="text-slate-400">({doc.current.fileSize})</span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <input
                        type="file"
                        id={inputId}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          handleFileUpload(doc.id as keyof DocumentsData, file);
                        }}
                      />
                      <label
                        htmlFor={inputId}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                          doc.current
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                            : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {doc.current ? "Replace" : "Select File"}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: SUMMARY & REVIEW */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-indigo-600" />
              Application Review & Summary
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Please double-check all details before final submission.
            </p>

            {/* Candidate Box */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 mb-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[11px]">
                  1. Candidate Bio-Data
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400">Name: </span>
                  <strong>
                    {personal.firstName} {personal.lastName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">DOB: </span>
                  {personal.dateOfBirth || "N/A"}
                </div>
                <div>
                  <span className="text-slate-400">Gender: </span>
                  {personal.gender}
                </div>
                <div>
                  <span className="text-slate-400">Parent: </span>
                  {personal.parentName} ({personal.parentPhone})
                </div>
              </div>
            </div>

            {/* Academic Box */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 mb-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[11px]">
                  2. Academic Placement
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400">Tier: </span>
                  <strong>{selectedTier}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Target Class: </span>
                  <strong>
                    {selectedTier === "CRECHE"
                      ? "Creche"
                      : selectedTier === "NURSERY_PRIMARY"
                      ? nurseryPrimary.classApplying
                      : selectedTier === "SECONDARY"
                      ? secondary.classApplying
                      : tertiary.courseOfStudy}
                  </strong>
                </div>
                {selectedTier === "NURSERY_PRIMARY" && nurseryPrimary.guardianNin && (
                  <div>
                    <span className="text-slate-400">Guardian NIN: </span>
                    <span className="font-mono">{nurseryPrimary.guardianNin}</span>
                  </div>
                )}
                {selectedTier === "TERTIARY" && (
                  <div>
                    <span className="text-slate-400">JAMB Score: </span>
                    <strong>{tertiary.jambScore} / 400</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Documents Box */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 mb-4 text-xs space-y-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[11px]">
                  3. Uploaded Credentials
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Edit
                </button>
              </div>
              <p className="text-slate-500">
                {Object.keys(documents).length} document(s) attached for verification.
              </p>
            </div>

            {/* Truthfulness Declaration Checkbox */}
            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-800 dark:text-slate-200 font-medium">
                <input
                  type="checkbox"
                  required
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                />
                <span>
                  I solemnly declare that the information provided in this application is correct and authentic. I
                  understand that false declarations disqualify admission consideration.
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: PAYMENT (FORM FEE) */}
      {currentStep === 5 && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              Application Form Fee & Payment
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Complete the statutory form fee to obtain your official application reference.
            </p>

            {/* Fee Amount Card */}
            <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between mb-4">
              <div>
                <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                  {payment.feeType}
                </span>
                <h3 className="text-2xl font-extrabold text-indigo-950 dark:text-white">₦5,000.00</h3>
              </div>
              <span className="px-2.5 py-1 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-lg border border-indigo-200">
                Non-Refundable
              </span>
            </div>

            {/* Bank Transfer Details Box (Read-Only) */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 space-y-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>Official Central Bank Account Details</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Bank Name</span>
                  <strong className="text-slate-900 dark:text-white text-sm">
                    {payment.bankName}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Account Number</span>
                  <strong className="text-slate-900 dark:text-white text-sm font-mono tracking-wider">
                    {payment.accountNumber}
                  </strong>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">Account Name</span>
                  <strong className="text-slate-900 dark:text-white">{payment.accountName}</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                  <span>Transfer Narration / Reference:</span>
                  <span className="font-mono font-bold text-indigo-600">{payment.paymentReference}</span>
                </div>
              </div>
            </div>

            {/* Payment Evidence / Transfer Reference */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sender Account Name / Depositor
                </label>
                <input
                  type="text"
                  placeholder="e.g. Emeka Okeke"
                  value={payment.senderAccountName || ""}
                  onChange={(e) => setPayment({ ...payment, senderAccountName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Transaction Reference / Session ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 000013241028309102"
                  value={payment.transactionReference || ""}
                  onChange={(e) => setPayment({ ...payment, transactionReference: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Optional: If transfer is already completed, paste the 30-digit Session ID or Ref.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM STICKY NAVIGATION BAR (Mobile-First 360px responsive) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={isPending}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors shadow-sm"
            >
              Next Step
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors shadow-sm"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting Application...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Submit Application (₦5,000)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
