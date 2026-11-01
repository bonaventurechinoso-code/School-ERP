"use client";

import React, { useState, useTransition } from "react";
import {
  Building2,
  GraduationCap,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Upload,
  ArrowRight,
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  HelpCircle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { submitPublicApplication } from "./actions";

interface SchoolProfile {
  id: string;
  name: string;
  subdomain: string;
  logoUrl?: string | null;
  primaryColor?: string;
  academicTiers: Array<{ id: string; name: string; level: number }>;
  classrooms: Array<{ id: string; name: string; tierId: string }>;
}

interface PublicPortalProps {
  school: SchoolProfile;
  paymentSettings?: any;
}

export default function PublicAdmissionsPortalClient({
  school,
  paymentSettings,
}: PublicPortalProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPending, startTransition] = useTransition();

  // Step 1: Program Matrix State
  const [academicSession, setAcademicSession] = useState("2026/2027");
  const [selectedTierId, setSelectedTierId] = useState(
    school.academicTiers[0]?.id || ""
  );
  const [selectedFaculty, setSelectedFaculty] = useState("Science");
  const [selectedProgram, setSelectedProgram] = useState("");

  // Step 2: Bio-Data & Dynamic Tier Fields
  const [bioData, setBioData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    email: "",
    phoneNumber: "",
    whatsappNumber: "",
    dateOfBirth: "",
    gender: "MALE",
    stateOfOrigin: "",
    lga: "",
  });

  // K-12 / Creche dynamic schema state
  const [k12Data, setK12Data] = useState({
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    emergencyContact: "",
    immunizationChecked: {
      bcg: true,
      polio: true,
      measles: true,
      yellowFever: false,
    },
    previousSchool: "",
  });

  // Tertiary / Health dynamic schema state
  const [tertiaryData, setTertiaryData] = useState({
    jambRegNumber: "",
    jambScore: "",
    examBoard: "WAEC",
    sittings: 1,
    subjects: [
      { name: "English Language", grade: "C4" },
      { name: "Mathematics", grade: "B3" },
      { name: "Biology", grade: "B2" },
      { name: "Chemistry", grade: "C5" },
      { name: "Physics", grade: "B3" },
    ],
  });

  // Step 3: Document Uploads
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{
      documentType: string;
      fileName: string;
      mimeType: string;
      base64Data: string;
    }>
  >([]);

  // Step 4: Payment State
  const [feeAmount] = useState(5000);
  const [depositorName, setDepositorName] = useState("");
  const [receiptFile, setReceiptFile] = useState<{
    fileName: string;
    mimeType: string;
    base64Data: string;
  } | null>(null);

  // Completed State
  const [submissionResult, setSubmissionResult] = useState<{
    applicationNumber: string;
    magicTrackingLink: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedTier = school.academicTiers.find((t) => t.id === selectedTierId);
  const isTertiaryOrHealth =
    selectedTier?.name.toLowerCase().includes("tertiary") ||
    selectedTier?.name.toLowerCase().includes("health") ||
    selectedTier?.name.toLowerCase().includes("polytechnic") ||
    selectedTier?.name.toLowerCase().includes("college");

  const availableClassrooms = school.classrooms.filter(
    (c) => c.tierId === selectedTierId
  );

  const bankAccount = paymentSettings?.bank_accounts?.[0] || {
    bank_name: "Access Bank",
    account_number: "0123456789",
    account_name: `${school.name} Admissions`,
    branch: "Main Branch",
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File exceeds maximum 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setUploadedFiles((prev) => [
        ...prev.filter((d) => d.documentType !== docType),
        {
          documentType: docType,
          fileName: file.name,
          mimeType: file.type,
          base64Data: base64,
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Receipt exceeds maximum 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setReceiptFile({
        fileName: file.name,
        mimeType: file.type,
        base64Data: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await submitPublicApplication({
        tenantId: school.id,
        schoolId: school.id,
        programId: selectedProgram || availableClassrooms[0]?.name || "General Program",
        academicSessionId: academicSession,
        firstName: bioData.firstName,
        lastName: bioData.lastName,
        middleName: bioData.middleName,
        email: bioData.email,
        phoneNumber: bioData.phoneNumber,
        whatsappNumber: bioData.whatsappNumber,
        dateOfBirth: bioData.dateOfBirth,
        gender: bioData.gender,
        tierSpecificData: isTertiaryOrHealth
          ? {
              jamb: { regNumber: tertiaryData.jambRegNumber, score: tertiaryData.jambScore },
              oLevel: tertiaryData,
            }
          : {
              parent: k12Data,
              immunization: k12Data.immunizationChecked,
            },
        documents: uploadedFiles,
        feePayment: receiptFile
          ? {
              paymentMethod: "MANUAL_BANK_TRANSFER",
              amount: feeAmount,
              receiptBase64: receiptFile.base64Data,
              receiptFileName: receiptFile.fileName,
              receiptMimeType: receiptFile.mimeType,
              depositorName,
            }
          : undefined,
      });

      if (res.success && res.applicationNumber) {
        setSubmissionResult({
          applicationNumber: res.applicationNumber,
          magicTrackingLink: res.magicTrackingLink || "#",
        });
      } else {
        setErrorMessage(res.error || "Failed to submit application.");
      }
    });
  };

  // SUCCESS COMPLETION SCREEN
  if (submissionResult) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-6 font-sans">
        <div className="max-w-lg w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Application Submitted!
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Your application to {school.name} has been securely logged.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200 dark:border-zinc-700/60 text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Application Reference</span>
              <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md">
                {submissionResult.applicationNumber}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-300">
              We have dispatched a WhatsApp & Email confirmation with your tracking link.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href={submissionResult.magicTrackingLink}
              className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm block transition-colors shadow-xs"
            >
              Access Applicant Tracking Dashboard
            </a>
            <p className="text-[11px] text-slate-400">
              Bookmark your tracking link to view credential audit remarks and print formal admission offers.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-lg mb-2">
            {school.logoUrl ? (
              <img src={school.logoUrl} alt={school.name} className="w-10 h-10 object-contain" />
            ) : (
              <Building2 className="w-7 h-7" />
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {school.name}
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-zinc-400">
            Admissions Application Portal • Session {academicSession}
          </p>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="grid grid-cols-4 gap-2 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
          {[
            { num: 1, label: "Program" },
            { num: 2, label: "Bio-Data" },
            { num: 3, label: "Credentials" },
            { num: 4, label: "Payment" },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => s.num < currentStep && setCurrentStep(s.num)}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center ${
                currentStep === s.num
                  ? "bg-indigo-600 text-white shadow-xs"
                  : currentStep > s.num
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "text-slate-400 dark:text-zinc-600"
              }`}
            >
              {s.num}. {s.label}
            </button>
          ))}
        </div>

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Program Selection Matrix */}
        {currentStep === 1 && (
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Step 1: Program Selection Matrix
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Select your academic session, campus tier, and target course or classroom.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 block">
                  Academic Session:
                </label>
                <select
                  value={academicSession}
                  onChange={(e) => setAcademicSession(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold"
                >
                  <option value="2026/2027">2026/2027 Academic Session</option>
                  <option value="2027/2028">2027/2028 Academic Session</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 block">
                  Institutional Campus / Tier:
                </label>
                <select
                  value={selectedTierId}
                  onChange={(e) => {
                    setSelectedTierId(e.target.value);
                    setSelectedProgram("");
                  }}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold"
                >
                  {school.academicTiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {isTertiaryOrHealth && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 block">
                    Faculty / School of Study:
                  </label>
                  <select
                    value={selectedFaculty}
                    onChange={(e) => setSelectedFaculty(e.target.value)}
                    className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold"
                  >
                    <option value="School of Health Technology">School of Health Technology</option>
                    <option value="Faculty of Pure & Applied Sciences">Faculty of Pure & Applied Sciences</option>
                    <option value="School of Nursing & Midwifery">School of Nursing & Midwifery</option>
                    <option value="Faculty of Management & Social Sciences">Faculty of Management & Social Sciences</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 block">
                  Target Program / Class Arm:
                </label>
                {isTertiaryOrHealth ? (
                  <select
                    value={selectedProgram}
                    onChange={(e) => setSelectedProgram(e.target.value)}
                    className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold"
                  >
                    <option value="">-- Choose Program of Study --</option>
                    <option value="Community Health Extension Worker (CHEW)">Community Health Extension Worker (CHEW)</option>
                    <option value="Medical Laboratory Technician (MLT)">Medical Laboratory Technician (MLT)</option>
                    <option value="Pharmacy Technician">Pharmacy Technician</option>
                    <option value="Health Information Management (HIM)">Health Information Management (HIM)</option>
                    <option value="Environmental Health Technology">Environmental Health Technology</option>
                    <option value="Computer Science (ND/HND)">Computer Science (ND/HND)</option>
                  </select>
                ) : (
                  <select
                    value={selectedProgram}
                    onChange={(e) => setSelectedProgram(e.target.value)}
                    className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold"
                  >
                    <option value="">-- Choose Class --</option>
                    {availableClassrooms.length > 0 ? (
                      availableClassrooms.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Primary 1">Primary 1</option>
                        <option value="JSS 1">JSS 1</option>
                        <option value="SSS 1 (Science)">SSS 1 (Science)</option>
                        <option value="SSS 1 (Arts)">SSS 1 (Arts)</option>
                      </>
                    )}
                  </select>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => {
                  if (!selectedProgram) {
                    alert("Please select a target program or class.");
                    return;
                  }
                  setCurrentStep(2);
                }}
                className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition-colors"
              >
                <span>Continue to Bio-Data</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Bio-Data & Dynamic Tier Schema */}
        {currentStep === 2 && (
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Step 2: Applicant Information & Credentials
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Personal bio-data and tier-specific academic background.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">First Name *</label>
                <input
                  type="text"
                  required
                  value={bioData.firstName}
                  onChange={(e) => setBioData({ ...bioData, firstName: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                  placeholder="e.g. Chidera"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Last Name *</label>
                <input
                  type="text"
                  required
                  value={bioData.lastName}
                  onChange={(e) => setBioData({ ...bioData, lastName: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                  placeholder="e.g. Okonkwo"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Middle Name</label>
                <input
                  type="text"
                  value={bioData.middleName}
                  onChange={(e) => setBioData({ ...bioData, middleName: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                  placeholder="e.g. John"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Email Address *</label>
                <input
                  type="email"
                  required
                  value={bioData.email}
                  onChange={(e) => setBioData({ ...bioData, email: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                  placeholder="applicant@example.com"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={bioData.phoneNumber}
                  onChange={(e) => setBioData({ ...bioData, phoneNumber: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                  placeholder="08012345678"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">WhatsApp Number</label>
                <input
                  type="tel"
                  value={bioData.whatsappNumber}
                  onChange={(e) => setBioData({ ...bioData, whatsappNumber: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                  placeholder="08012345678"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={bioData.dateOfBirth}
                  onChange={(e) => setBioData({ ...bioData, dateOfBirth: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Gender *</label>
                <select
                  value={bioData.gender}
                  onChange={(e) => setBioData({ ...bioData, gender: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">State of Origin</label>
                <input
                  type="text"
                  value={bioData.stateOfOrigin}
                  onChange={(e) => setBioData({ ...bioData, stateOfOrigin: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                  placeholder="e.g. Enugu State"
                />
              </div>
            </div>

            {/* DYNAMIC SCHEMA: Tertiary / Health vs K-12 */}
            {isTertiaryOrHealth ? (
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Tertiary / Health Track: JAMB & O'Level Breakdown
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">JAMB/UTME Registration No:</label>
                    <input
                      type="text"
                      placeholder="e.g. 202610489201EF"
                      value={tertiaryData.jambRegNumber}
                      onChange={(e) => setTertiaryData({ ...tertiaryData, jambRegNumber: e.target.value })}
                      className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">JAMB Score:</label>
                    <input
                      type="number"
                      placeholder="e.g. 240"
                      value={tertiaryData.jambScore}
                      onChange={(e) => setTertiaryData({ ...tertiaryData, jambScore: e.target.value })}
                      className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">
                    O'Level Matrix (WAEC/NECO 5-Credit Core):
                  </label>
                  <div className="space-y-2">
                    {tertiaryData.subjects.map((sub, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => {
                            const updated = [...tertiaryData.subjects];
                            updated[idx].name = e.target.value;
                            setTertiaryData({ ...tertiaryData, subjects: updated });
                          }}
                          className="flex-1 text-xs p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-semibold"
                        />
                        <select
                          value={sub.grade}
                          onChange={(e) => {
                            const updated = [...tertiaryData.subjects];
                            updated[idx].grade = e.target.value;
                            setTertiaryData({ ...tertiaryData, subjects: updated });
                          }}
                          className="w-24 text-xs p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-black text-indigo-600"
                        >
                          {["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"].map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  K-12 / Primary: Parent Biometrics & Health History
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Parent/Guardian Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Emmanuel Okonkwo"
                      value={k12Data.parentName}
                      onChange={(e) => setK12Data({ ...k12Data, parentName: e.target.value })}
                      className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Parent Phone Number *</label>
                    <input
                      type="tel"
                      placeholder="08098765432"
                      value={k12Data.parentPhone}
                      onChange={(e) => setK12Data({ ...k12Data, parentPhone: e.target.value })}
                      className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2 block">Immunization Completed History:</label>
                  <div className="flex flex-wrap gap-4 text-xs font-semibold">
                    {["bcg", "polio", "measles", "yellowFever"].map((key) => (
                      <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(k12Data.immunizationChecked as any)[key]}
                          onChange={(e) =>
                            setK12Data({
                              ...k12Data,
                              immunizationChecked: {
                                ...k12Data.immunizationChecked,
                                [key]: e.target.checked,
                              },
                            })
                          }
                          className="rounded text-indigo-600"
                        />
                        <span className="uppercase">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="py-2.5 px-4 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!bioData.firstName || !bioData.lastName || !bioData.email || !bioData.phoneNumber || !bioData.dateOfBirth) {
                    alert("Please fill in all mandatory bio-data fields.");
                    return;
                  }
                  setCurrentStep(3);
                }}
                className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition-colors"
              >
                <span>Continue to Credential Uploads</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Credential Dropzone (Strict 5MB, PDF/JPG/PNG) */}
        {currentStep === 3 && (
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Step 3: Private Credential Uploads
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Upload clear scans (PDF, JPG, PNG only; max 5MB). Files are encrypted in private storage.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { type: "BIRTH_CERTIFICATE", label: "Birth Certificate / Age Declaration *" },
                { type: "PASSPORT_PHOTO", label: "Recent Passport Photograph *" },
                {
                  type: isTertiaryOrHealth ? "O_LEVEL_RESULT" : "LAST_SCHOOL_RESULT",
                  label: isTertiaryOrHealth ? "WAEC / NECO Result Slip *" : "Last Term Report Card *",
                },
                {
                  type: isTertiaryOrHealth ? "JAMB_RESULT_SLIP" : "IMMUNIZATION_RECORD",
                  label: isTertiaryOrHealth ? "JAMB / UTME Result Slip" : "Immunization Card",
                },
              ].map((slot) => {
                const uploaded = uploadedFiles.find((d) => d.documentType === slot.type);
                return (
                  <div
                    key={slot.type}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 space-y-2"
                  >
                    <label className="text-xs font-black text-slate-900 dark:text-white block truncate">
                      {slot.label}
                    </label>

                    {uploaded ? (
                      <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                        <span className="truncate">{uploaded.fileName}</span>
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-indigo-500 rounded-xl cursor-pointer transition-colors bg-white dark:bg-zinc-900">
                        <Upload className="w-5 h-5 text-slate-400 mb-1" />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-300">
                          Click to select file
                        </span>
                        <span className="text-[10px] text-slate-400">PDF, JPG, or PNG (Max 5MB)</span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileUpload(e, slot.type)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="py-2.5 px-4 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition-colors"
              >
                <span>Continue to Fee Settlement</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Application Fee Settlement & Zero-Custody Bank Transfer */}
        {currentStep === 4 && (
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Step 4: Application Processing Fee Settlement
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Non-custodial direct bank transfer to {school.name}.
              </p>
            </div>

            {/* Direct Bank Account Card */}
            <div className="p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-200">
                  Institutional Settlement Account
                </span>
                <span className="text-sm font-black font-mono text-indigo-700 dark:text-indigo-300">
                  NGN {feeAmount.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white dark:bg-zinc-900 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900 font-semibold">
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Bank Name</span>
                  <span className="text-slate-900 dark:text-white font-black">{bankAccount.bank_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Account Number</span>
                  <span className="text-slate-900 dark:text-white font-mono font-black text-sm">
                    {bankAccount.account_number}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Account Name</span>
                  <span className="text-slate-900 dark:text-white">{bankAccount.account_name}</span>
                </div>
              </div>

              <p className="text-[11px] text-indigo-800 dark:text-indigo-300 leading-relaxed">
                <strong>Instruction:</strong> Please transfer the sum of <strong>NGN {feeAmount.toLocaleString()}</strong> to the institutional account above. Take a screenshot or photograph of your debit receipt/teller and upload it below.
              </p>
            </div>

            {/* Proof Upload Area */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Attach Bank Transfer Proof / Teller Screenshot:
              </label>

              {receiptFile ? (
                <div className="flex items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                  <span className="truncate">{receiptFile.fileName}</span>
                  <button
                    type="button"
                    onClick={() => setReceiptFile(null)}
                    className="text-xs text-rose-600 font-bold hover:underline"
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-indigo-500 rounded-2xl cursor-pointer transition-colors bg-slate-50/50 dark:bg-zinc-800/30">
                  <CreditCard className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Upload Bank Transfer Receipt / Teller
                  </span>
                  <span className="text-[10px] text-slate-400">JPG, PNG, or PDF (Max 5MB)</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                </label>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">
                  Depositor / Sender Account Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chidera Okonkwo"
                  value={depositorName}
                  onChange={(e) => setDepositorName(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="py-2.5 px-4 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={handleSubmit}
                className="py-3.5 px-8 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2"
              >
                {isPending ? "Submitting Application..." : "Submit Formal Application"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
