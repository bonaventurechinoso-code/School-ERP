"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  X,
  Phone,
  Mail,
  MessageCircle,
  GraduationCap,
  Award,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  FileCheck,
  FileText,
  UserCheck,
  ShieldCheck,
  DollarSign,
  Copy,
  ExternalLink,
  ChevronRight,
  Star,
  Save,
  Maximize2,
  Minimize2,
  Calendar,
  MapPin,
  Send,
  Calculator,
  Loader2,
  History,
  Lock,
  UploadCloud,
  Check,
  AlertTriangle,
  CreditCard,
  Bell,
} from "lucide-react";
import {
  updateLeadStatusAction,
  updateLeadDocumentsAction,
  updateLeadScreeningAction,
  enrollApplicantAction,
  enrollApplicantFromRegisterAction,
  scheduleAndDispatchExamAdmitSlipAction,
  sendBankDetailsEmailAction,
  markFormFeePaidAction,
  saveManualEntranceScoreAction,
  sendMissingDocsReminderAction,
  sendGuardianDirectEmailAction,
} from "./actions";
import { getExamSubjectsForTier } from "@/lib/tenant-tier-utils";

export interface ApplicantDossierDrawerProps {
  lead?: any | null;
  applicant?: any | null;
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  schoolDomain: string;
  schoolName?: string;
  canMutate?: boolean;
  onLeadUpdated?: () => void;
  onRecordUpdated?: () => void;
  onPrintOfferLetter?: (lead: any) => void;
  onPrintExamSlip?: (lead: any) => void;
}

const STAGES = ["INQUIRY", "APPLIED", "INTERVIEW", "APPROVED", "ENROLLED"];

function deriveTierFromClass(cls?: string, fallbackTier?: string): string {
  if (!cls) return fallbackTier || "Secondary School";
  const c = cls.toLowerCase().trim();
  if (
    ["creche", "playgroup", "pre-nursery", "nursery 1", "nursery 2", "nursery 3", "crèche", "creche"].some((k) =>
      c.includes(k)
    )
  ) {
    return "Creche / Nursery";
  }
  if (c.includes("primary") || c.includes("basic") || c.includes("elementary")) {
    return "Primary School";
  }
  if (
    c.includes("jss") ||
    c.includes("sss") ||
    c.includes("ss1") ||
    c.includes("ss 1") ||
    c.includes("ss2") ||
    c.includes("ss 2") ||
    c.includes("ss3") ||
    c.includes("ss 3") ||
    c.includes("secondary") ||
    c.includes("high")
  ) {
    return "Secondary School";
  }
  if (
    ["nd", "hnd", "100 level", "200", "300", "400", "university", "polytechnic", "college of education"].some((k) =>
      c.includes(k)
    )
  ) {
    return "Higher Institution / University";
  }
  return fallbackTier || "Primary School";
}

export function resolveDocUrl(candidate: any, key: string): string | null {
  if (!candidate) return null;

  const docs = candidate.documents || {};
  const metaDocs = candidate.metadata?.documents || {};
  const tierDocs = candidate.tierSpecificData?.documents || {};

  // 1. Direct candidate URL property (e.g. candidate.passportPhotoUrl)
  const directProp = `${key}Url`;
  if (typeof candidate[directProp] === "string" && candidate[directProp]) {
    return candidate[directProp];
  }

  // 2. Direct lookup in docs, metaDocs, tierDocs object maps
  for (const map of [docs, metaDocs, tierDocs]) {
    if (map && typeof map === "object" && !Array.isArray(map)) {
      if (typeof map[directProp] === "string" && map[directProp]) return map[directProp];
      const item = map[key];
      if (item) {
        if (typeof item === "string" && item.trim()) return item.trim();
        if (typeof item === "object") {
          const u = item.url || item.fileUrl || item.storageKey || item.path;
          if (typeof u === "string" && u.trim()) return u.trim();
        }
      }
    }
  }

  // Common aliases across diverse data sources
  const aliasKeys: Record<string, string[]> = {
    passportPhoto: [
      "PASSPORT_PHOTOGRAPH", "PASSPORT_PHOTO", "PASSPORT", "passportPhoto", "passport_photo", "passport", "photo"
    ],
    birthCertificate: [
      "BIRTH_CERTIFICATE", "BIRTH_CERT", "birthCertificate", "birth_certificate", "birthCert", "ageDeclaration"
    ],
    academicResults: [
      "ACADEMIC_TRANSCRIPT", "ACADEMIC_RESULTS", "O_LEVEL_RESULT", "TRANSCRIPT", "academicResults", "academic_results", "previousResults", "academicTranscript", "transcript", "results", "oLevelResult"
    ],
    medicalRecords: [
      "MEDICAL_REPORT", "MEDICAL_RECORDS", "MEDICAL", "medicalRecords", "medical_records", "medicalReport", "fitness"
    ],
    ninSlip: [
      "NIN_SLIP", "NIN", "ninSlip", "nin_slip", "nationalId", "nimc"
    ],
    applicationFeeReceipt: [
      "APPLICATION_FEE_RECEIPT", "FEE_RECEIPT", "PAYMENT_RECEIPT", "RECEIPT", "applicationFeeReceipt", "formFeeReceipt", "receipt", "feeReceipt", "paymentReceipt"
    ],
  };

  const aliases = aliasKeys[key] || [key];

  // 3. Array of documents (e.g. from AdmissionsDocument[] or credentialsJson[] or docs.documents[])
  const docArrays: any[] = [];
  if (Array.isArray(candidate.documents)) docArrays.push(candidate.documents);
  if (Array.isArray(candidate.rawDocuments)) docArrays.push(candidate.rawDocuments);
  if (Array.isArray(docs.documents)) docArrays.push(docs.documents);
  if (Array.isArray(candidate.credentialsJson)) docArrays.push(candidate.credentialsJson);

  for (const arr of docArrays) {
    for (const d of arr) {
      if (!d) continue;
      const dType = (d.documentType || d.type || d.key || d.docType || "").toUpperCase().replace(/[\s-_]/g, "");
      const matches = aliases.some((a) => {
        const aNorm = a.toUpperCase().replace(/[\s-_]/g, "");
        return dType === aNorm || dType.includes(aNorm) || aNorm.includes(dType);
      });
      if (matches) {
        const u = d.storageKey || d.url || d.fileUrl || d.path;
        if (typeof u === "string" && u.trim()) return u.trim();
      }
    }
  }

  // 4. Special cases
  if (key === "applicationFeeReceipt") {
    if (typeof candidate.applicationFeeReceiptUrl === "string" && candidate.applicationFeeReceiptUrl) return candidate.applicationFeeReceiptUrl;
    if (typeof candidate.formFeeReceiptUrl === "string" && candidate.formFeeReceiptUrl) return candidate.formFeeReceiptUrl;
    if (typeof docs.applicationFeeReceiptUrl === "string" && docs.applicationFeeReceiptUrl) return docs.applicationFeeReceiptUrl;
    if (typeof docs.formFeeReceiptUrl === "string" && docs.formFeeReceiptUrl) return docs.formFeeReceiptUrl;
    if (candidate.feeTransactions && Array.isArray(candidate.feeTransactions)) {
      const tx = candidate.feeTransactions.find((t: any) => t?.proofOfPaymentUrl);
      if (tx?.proofOfPaymentUrl) return tx.proofOfPaymentUrl;
    }
  }

  return null;
}

export function resolveDocRecord(candidate: any, key: string): any {
  if (!candidate) return {};

  const docs = candidate.documents || {};
  const metaDocs = (candidate.metadata as any)?.documents || {};
  const tierDocs = (candidate.tierSpecificData as any)?.documents || {};

  // Check direct key in objects
  for (const map of [docs, metaDocs, tierDocs]) {
    if (map && typeof map === "object" && !Array.isArray(map)) {
      if (map[key] && typeof map[key] === "object") return map[key];
    }
  }

  // Common aliases across diverse data sources
  const aliasKeys: Record<string, string[]> = {
    passportPhoto: [
      "PASSPORT_PHOTOGRAPH", "PASSPORT_PHOTO", "PASSPORT", "passportPhoto", "passport_photo", "passport", "photo"
    ],
    birthCertificate: [
      "BIRTH_CERTIFICATE", "BIRTH_CERT", "birthCertificate", "birth_certificate", "birthCert", "ageDeclaration"
    ],
    academicResults: [
      "ACADEMIC_TRANSCRIPT", "ACADEMIC_RESULTS", "O_LEVEL_RESULT", "TRANSCRIPT", "academicResults", "academic_results", "previousResults", "academicTranscript", "transcript", "results", "oLevelResult"
    ],
    medicalRecords: [
      "MEDICAL_REPORT", "MEDICAL_RECORDS", "MEDICAL", "medicalRecords", "medical_records", "medicalReport", "fitness"
    ],
    ninSlip: [
      "NIN_SLIP", "NIN", "ninSlip", "nin_slip", "nationalId", "nimc"
    ],
    applicationFeeReceipt: [
      "APPLICATION_FEE_RECEIPT", "FEE_RECEIPT", "PAYMENT_RECEIPT", "RECEIPT", "applicationFeeReceipt", "formFeeReceipt", "receipt", "feeReceipt", "paymentReceipt"
    ],
  };

  const aliases = aliasKeys[key] || [key];

  for (const map of [docs, metaDocs, tierDocs]) {
    if (map && typeof map === "object" && !Array.isArray(map)) {
      for (const a of aliases) {
        if (map[a] && typeof map[a] === "object") return map[a];
      }
    }
  }

  // Check array sources (rawDocuments, credentialsJson, candidate.documents)
  const arrays: any[] = [
    ...(Array.isArray(candidate.rawDocuments) ? [candidate.rawDocuments] : []),
    ...(Array.isArray(candidate.documents) ? [candidate.documents] : []),
    ...(Array.isArray(candidate.credentialsJson) ? [candidate.credentialsJson] : []),
    ...(Array.isArray(docs.documents) ? [docs.documents] : []),
  ];

  for (const arr of arrays) {
    for (const d of arr) {
      if (!d || typeof d !== "object") continue;
      const dType = (d.documentType || d.type || d.key || d.docType || "").toUpperCase().replace(/[\s-_]/g, "");
      const matches = aliases.some((a) => {
        const aNorm = a.toUpperCase().replace(/[\s-_]/g, "");
        return dType === aNorm || dType.includes(aNorm) || aNorm.includes(dType);
      });
      if (matches) return d;
    }
  }

  return {};
}

export default function ApplicantDossierDrawer({
  lead,
  applicant,
  isOpen,
  onClose,
  schoolId,
  schoolDomain,
  schoolName = "Institution Admissions Desk",
  canMutate = false,
  onLeadUpdated,
  onRecordUpdated,
  onPrintOfferLetter,
  onPrintExamSlip,
}: ApplicantDossierDrawerProps) {
  // Normalize lead or applicant data into unified structure
  const activeCandidate = useMemo(() => {
    const rawApplicant = applicant || {};
    const rawLead = lead || {};
    if (!lead && !applicant) return null;

    const creds =
      typeof rawApplicant.credentialsJson === "object" && rawApplicant.credentialsJson !== null
        ? rawApplicant.credentialsJson
        : {};

    const rawDocs = [
      ...(Array.isArray(rawLead.documents) ? rawLead.documents : []),
      ...(Array.isArray(rawLead.rawDocuments) ? rawLead.rawDocuments : []),
      ...(Array.isArray(rawApplicant.documents) ? rawApplicant.documents : []),
      ...(Array.isArray(rawApplicant.rawDocuments) ? rawApplicant.rawDocuments : []),
      ...(Array.isArray(creds.documents) ? creds.documents : []),
      ...(Array.isArray(creds) ? creds : []),
    ];

    const mergedDocs = {
      ...(typeof creds === "object" && !Array.isArray(creds) ? creds : {}),
      ...(typeof rawLead.documents === "object" && !Array.isArray(rawLead.documents) ? rawLead.documents : {}),
      ...(typeof (rawLead.metadata as any)?.documents === "object" ? (rawLead.metadata as any).documents : {}),
      ...(typeof (rawApplicant.metadata as any)?.documents === "object" ? (rawApplicant.metadata as any).documents : {}),
      ...(typeof (rawLead.tierSpecificData as any)?.documents === "object" ? (rawLead.tierSpecificData as any).documents : {}),
      ...(typeof (rawApplicant.tierSpecificData as any)?.documents === "object" ? (rawApplicant.tierSpecificData as any).documents : {}),
    };

    return {
      ...rawApplicant,
      ...rawLead,
      id: rawLead.id || rawApplicant.id,
      leadId: rawLead.id || rawApplicant.leadId,
      applicationNo:
        rawLead.applicationNo ||
        rawApplicant.applicationNo ||
        rawLead.applicationNumber ||
        rawApplicant.applicationNumber ||
        (rawLead.id?.startsWith("ADM-") || rawLead.id?.startsWith("APP-") ? rawLead.id : undefined),
      applicationNumber:
        rawApplicant.applicationNumber ||
        rawLead.applicationNumber ||
        rawApplicant.applicationNo ||
        rawLead.applicationNo,
      applicantName:
        rawLead.applicantName ||
        rawApplicant.fullName ||
        `${rawApplicant.firstName || rawLead.firstName || ""} ${rawApplicant.lastName || rawLead.lastName || ""}`.trim() ||
        "Candidate",
      targetGrade: rawLead.targetGrade || rawApplicant.assignedClass || rawApplicant.classApplied || rawLead.targetClass || "Primary 1",
      targetClass: rawLead.targetClass || rawApplicant.assignedClass || rawApplicant.classApplied || rawLead.targetGrade || "Primary 1",
      documents: mergedDocs,
      rawDocuments: rawDocs,
      logs: rawLead.logs || creds.statusLogs || rawApplicant.logs || [],
    };
  }, [lead, applicant]);

  const [activeTab, setActiveTab] = useState<"overview" | "credentials" | "screening" | "timeline">(
    "overview"
  );
  const [isPending, startTransition] = useTransition();
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAppNo, setCopiedAppNo] = useState(false);
  const [localCandidate, setLocalCandidate] = useState<any>(activeCandidate);
  const [isMaximized, setIsMaximized] = useState(false);

  // Form Fee & Bank Details State
  const [isSendingBankEmail, setIsSendingBankEmail] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // Missing Documents Reminder State
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Email Guardian Composer Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({
    recipientEmail: "",
    subject: "",
    message: "",
  });
  const [isSendingDirectEmail, setIsSendingDirectEmail] = useState(false);

  // Screening state
  const [examScore, setExamScore] = useState<string>("");
  const [subjectScores, setSubjectScores] = useState<Record<string, string>>({});
  const [isDispatchingSlip, setIsDispatchingSlip] = useState(false);
  const [interviewRating, setInterviewRating] = useState<number>(4);
  const [recommendation, setRecommendation] = useState<string>("RECOMMENDED");
  const [screeningNotes, setScreeningNotes] = useState<string>("");

  useEffect(() => {
    setLocalCandidate(activeCandidate);
  }, [activeCandidate]);

  useEffect(() => {
    if (activeCandidate && isOpen) {
      setAlertMsg(null);
      setCopiedLink(false);
      setCopiedAppNo(false);

      const logs = Array.isArray(activeCandidate.logs) ? activeCandidate.logs : [];
      const screeningLog = logs.slice().reverse().find((l: any) => l.action === "SCREENING_EVALUATED");
      const docs = activeCandidate.documents || {};
      const savedSubjectScores: Record<string, string> = {};

      if (docs.examScores && typeof docs.examScores === "object") {
        Object.entries(docs.examScores).forEach(([k, v]) => {
          savedSubjectScores[k] = v !== undefined && v !== null ? String(v) : "";
        });
      } else if (screeningLog?.subjectScores && typeof screeningLog.subjectScores === "object") {
        Object.entries(screeningLog.subjectScores).forEach(([k, v]) => {
          savedSubjectScores[k] = v !== undefined && v !== null ? String(v) : "";
        });
      }
      setSubjectScores(savedSubjectScores);

      const existingScore =
        docs.entranceScore ?? docs.examScore ?? docs.examAggregate ?? screeningLog?.examScore ?? null;

      if (existingScore !== null && existingScore !== undefined) {
        setExamScore(String(existingScore));
      } else {
        setExamScore("");
      }

      setInterviewRating(screeningLog?.interviewRating || 4);
      setRecommendation(screeningLog?.recommendation || "RECOMMENDED");
      setScreeningNotes(screeningLog?.notes || "");
    }
  }, [activeCandidate, isOpen]);

  const examSubjects = useMemo(() => {
    return getExamSubjectsForTier(
      activeCandidate?.tier?.name,
      activeCandidate?.targetGrade || activeCandidate?.targetClass
    );
  }, [activeCandidate]);

  if (!isOpen || !activeCandidate) return null;

  const currentStatus = (activeCandidate.status || "INQUIRY").toUpperCase();
  const currentStageIndex = Math.max(0, STAGES.indexOf(currentStatus));
  const docs = localCandidate?.documents || activeCandidate.documents || {};

  const appNo =
    activeCandidate.applicationNo ||
    docs.applicationNo ||
    `ADM-${(activeCandidate.id || "").substring(0, 6).toUpperCase()}`;

  const parentPhone =
    activeCandidate.parentPhone ||
    activeCandidate.parentContact ||
    (activeCandidate.tierSpecificData as any)?.parentPhone ||
    (activeCandidate.tierSpecificData as any)?.parent?.phone ||
    "Not provided";
  const parentEmail =
    activeCandidate.parentEmail ||
    (activeCandidate.tierSpecificData as any)?.parentEmail ||
    (activeCandidate.metadata as any)?.parentEmail ||
    activeCandidate.email ||
    activeCandidate.studentEmail ||
    "";
  const cleanPhone = parentPhone.replace(/\D/g, "");

  const receiptUrl =
    docs.applicationFeeReceiptUrl ||
    docs.formFeeReceiptUrl ||
    localCandidate?.applicationFeeReceiptUrl ||
    activeCandidate?.applicationFeeReceiptUrl ||
    (docs.applicationFeeReceipt && typeof docs.applicationFeeReceipt === "object" ? docs.applicationFeeReceipt.url : null) ||
    (typeof docs.applicationFeeReceipt === "string" ? docs.applicationFeeReceipt : null);

  const isFeePaid = Boolean(
    docs.formFeePaid ||
      docs.feePaid ||
      localCandidate?.formFeePaid ||
      activeCandidate.formFeePaid ||
      docs.formFeeStatus === "PAID" ||
      localCandidate?.formFeeStatus === "PAID" ||
      activeCandidate?.formFeeStatus === "PAID" ||
      currentStatus === "APPROVED" ||
      currentStatus === "ENROLLED"
  );

  const isFeePending = Boolean(
    !isFeePaid &&
      (docs.formFeeStatus === "PENDING" ||
        docs.formFeeStatus === "PENDING_VERIFICATION" ||
        localCandidate?.formFeeStatus === "PENDING" ||
        activeCandidate?.formFeeStatus === "PENDING" ||
        Boolean(receiptUrl))
  );

  const feeState: "UNPAID" | "PENDING" | "PAID" = isFeePaid ? "PAID" : isFeePending ? "PENDING" : "UNPAID";

  // The Canonical Statutory & Admissions Documents Checklist
  const kycChecklist = [
    {
      key: "applicationFeeReceipt",
      label: "Application Fee Receipt",
      mandatory: true,
      url:
        resolveDocUrl(localCandidate || activeCandidate, "applicationFeeReceipt") ||
        receiptUrl ||
        localCandidate?.applicationFeeReceiptUrl ||
        activeCandidate?.applicationFeeReceiptUrl ||
        docs?.applicationFeeReceiptUrl ||
        docs?.formFeeReceiptUrl,
    },
    {
      key: "passportPhoto",
      label: "Passport Photograph",
      mandatory: true,
      url:
        resolveDocUrl(localCandidate || activeCandidate, "passportPhoto") ||
        localCandidate?.passportPhotoUrl ||
        docs?.passportPhoto?.url ||
        docs?.passportPhoto?.fileUrl ||
        docs?.passport,
    },
    {
      key: "birthCertificate",
      label: "NPC National Birth Certificate / Age Declaration",
      mandatory: true,
      url:
        resolveDocUrl(localCandidate || activeCandidate, "birthCertificate") ||
        localCandidate?.birthCertificateUrl ||
        docs?.birthCertificate?.url ||
        docs?.birthCertificate?.fileUrl ||
        docs?.birthCert,
    },
    {
      key: "academicResults",
      label: "Academic Transcripts / Previous Term Results",
      mandatory: true,
      url:
        resolveDocUrl(localCandidate || activeCandidate, "academicResults") ||
        localCandidate?.academicResultsUrl ||
        docs?.academicResults?.url ||
        docs?.academicResults?.fileUrl ||
        docs?.previousResults,
    },
    {
      key: "medicalRecords",
      label: "Medical Certificate of Fitness",
      mandatory: true,
      url:
        resolveDocUrl(localCandidate || activeCandidate, "medicalRecords") ||
        localCandidate?.medicalRecordsUrl ||
        docs?.medicalRecords?.url ||
        docs?.medicalRecords?.fileUrl ||
        docs?.medical,
    },
    {
      key: "ninSlip",
      label: "NIMC NIN Identification Slip",
      mandatory: false,
      url:
        resolveDocUrl(localCandidate || activeCandidate, "ninSlip") ||
        docs?.ninSlip?.url ||
        docs?.ninSlip?.fileUrl ||
        docs?.ninSlip ||
        docs?.nin,
    },
  ];

  // Missing Documents Reminder Handler
  const handleSendMissingDocsReminder = async () => {
    setIsSendingReminder(true);
    setAlertMsg(null);
    try {
      const missingItems = kycChecklist
        .filter((item) => !item.url)
        .map((item) => item.label);

      if (missingItems.length === 0) {
        setAlertMsg({
          type: "success",
          text: "All required statutory credentials have already been uploaded by this applicant!",
        });
        setIsSendingReminder(false);
        return;
      }

      const targetId = activeCandidate.leadId || activeCandidate.id;
      let res: any = null;

      // 1. First attempt: call REST API endpoint
      try {
        const apiResponse = await fetch("/api/v1/admissions/send-reminder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            schoolDomain,
            applicantId: targetId,
            applicationNo: appNo,
            applicantName: activeCandidate.applicantName,
            recipientEmail: parentEmail,
            recipientPhone: parentPhone !== "Not provided" ? parentPhone : undefined,
            missingDocuments: missingItems,
          }),
        });
        if (apiResponse.ok) {
          res = await apiResponse.json().catch(() => null);
        }
      } catch (fetchErr) {
        console.warn("[SEND_REMINDER_API_NOTICE] API route fetch failed, falling back to server action:", fetchErr);
      }

      // 2. Resilient fallback: call direct server action if REST route returned non-200 or null
      if (!res || !res.success) {
        res = await sendMissingDocsReminderAction({
          schoolId,
          schoolDomain,
          applicantId: targetId,
          applicationNo: appNo,
          applicantName: activeCandidate.applicantName,
          recipientEmail: parentEmail,
          recipientPhone: parentPhone !== "Not provided" ? parentPhone : undefined,
          missingDocuments: missingItems,
        });
      }

      if (res && res.success) {
        setAlertMsg({
          type: "success",
          text: `Reminder dispatched to ${parentEmail || "guardian"} for ${missingItems.length} missing document(s)!`,
        });
        if (onLeadUpdated) onLeadUpdated();
        if (onRecordUpdated) onRecordUpdated();
      } else {
        setAlertMsg({ type: "error", text: res?.error || "Failed to dispatch reminder." });
      }
    } catch (err: any) {
      console.error("[SEND_REMINDER_EXCEPTION]:", err);
      setAlertMsg({ type: "error", text: err?.message || "Failed to dispatch reminder." });
    } finally {
      setIsSendingReminder(false);
    }
  };

  // Open Guardian Email Modal
  const handleOpenEmailModal = () => {
    const candidateName =
      activeCandidate.applicantName ||
      `${activeCandidate.firstName || ""} ${activeCandidate.lastName || ""}`.trim() ||
      "Applicant";
    const defaultSubject = `[${schoolName || "Admissions Office"}] Admissions Application Status - ${candidateName} (${appNo})`;
    const defaultMessage = `Dear Parent / Guardian,\n\nWe are writing from the Admissions Office at ${schoolName || "the School"} regarding the admission application for ${candidateName} (Application No: ${appNo}).\n\nPlease find important updates regarding your application status.\n\nKind regards,\nAdmissions Committee\n${schoolName || ""}`;

    setEmailForm({
      recipientEmail: parentEmail && !parentEmail.includes("@applicant.schoolerp") ? parentEmail : "",
      subject: defaultSubject,
      message: defaultMessage,
    });
    setIsEmailModalOpen(true);
  };

  // Send Direct Email to Guardian
  const handleSendDirectEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.recipientEmail?.trim() || !emailForm.recipientEmail.includes("@")) {
      setAlertMsg({ type: "error", text: "Please enter a valid recipient email address." });
      return;
    }
    if (!emailForm.subject?.trim() || !emailForm.message?.trim()) {
      setAlertMsg({ type: "error", text: "Email subject and message body cannot be blank." });
      return;
    }

    setIsSendingDirectEmail(true);
    setAlertMsg(null);
    try {
      const targetId = activeCandidate.leadId || activeCandidate.id;
      const res = await sendGuardianDirectEmailAction({
        schoolId,
        schoolDomain,
        applicantId: targetId,
        applicationNo: appNo,
        recipientEmail: emailForm.recipientEmail.trim(),
        recipientName: activeCandidate.parentName || "Parent / Guardian",
        subject: emailForm.subject.trim(),
        message: emailForm.message.trim(),
      });

      if (res && res.success) {
        setIsEmailModalOpen(false);
        setAlertMsg({
          type: "success",
          text: `Direct email sent successfully to ${emailForm.recipientEmail.trim()}!`,
        });
      } else {
        setAlertMsg({ type: "error", text: res?.error || "Failed to dispatch email." });
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err?.message || "Failed to dispatch email." });
    } finally {
      setIsSendingDirectEmail(false);
    }
  };

  const bankDetails = {
    bankName: "Zenith Bank",
    accountNumber: "1012345678",
    accountName: `${schoolName} Admissions`,
    formFeeAmount: 5000,
  };

  const handleCopy = (text: string, type: "app" | "link") => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text);
      if (type === "app") {
        setCopiedAppNo(true);
        setTimeout(() => setCopiedAppNo(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    }
  };

  // Direct Document Upload by Admin
  const handleFileUpload = async (docKey: string, file?: File | null) => {
    if (!file || !activeCandidate) return;
    try {
      const formData = new FormData();
      formData.append("token", "admin-session");
      formData.append(docKey, file);

      const targetId = activeCandidate.leadId || activeCandidate.id;
      const res = await fetch(`/api/v1/admissions/upload/${targetId}?token=admin`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload file");
      }

      const newUrl = data.documents?.[docKey]?.url || data.documents?.[docKey]?.fileUrl;

      setLocalCandidate((prev: any) => {
        if (!prev) return prev;
        const currentDocs = { ...(prev.documents || {}) };
        currentDocs[docKey] = {
          ...(currentDocs[docKey] || {}),
          url: newUrl,
          fileUrl: newUrl,
          fileName: file.name,
          status: "UPLOADED",
          verified: false,
        };
        const colMap: Record<string, string> = {
          passportPhoto: "passportPhotoUrl",
          academicResults: "academicResultsUrl",
          birthCertificate: "birthCertificateUrl",
          medicalRecords: "medicalRecordsUrl",
          ninSlip: "ninSlipUrl",
          applicationFeeReceipt: "applicationFeeReceiptUrl",
        };
        const col = colMap[docKey];
        return {
          ...prev,
          documents: currentDocs,
          ...(col ? { [col]: newUrl } : {}),
        };
      });

      setAlertMsg({ type: "success", text: `${file.name} uploaded successfully.` });
      if (onLeadUpdated) onLeadUpdated();
      if (onRecordUpdated) onRecordUpdated();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Upload failed." });
    }
  };

  // Advance Stage Handler
  const handleAdvanceStage = (targetStage: string) => {
    setAlertMsg(null);
    startTransition(async () => {
      try {
        const targetId = activeCandidate.leadId || activeCandidate.id;
        const res = await updateLeadStatusAction({
          leadId: targetId,
          status: targetStage,
          schoolId,
          schoolDomain,
        });
        if (res && res.success) {
          setAlertMsg({ type: "success", text: `Candidate advanced to ${targetStage} stage!` });
          setLocalCandidate((prev: any) => ({ ...prev, status: targetStage }));
          if (onLeadUpdated) onLeadUpdated();
          if (onRecordUpdated) onRecordUpdated();
        } else {
          setAlertMsg({ type: "error", text: res?.error || "Failed to update stage." });
        }
      } catch (err: any) {
        setAlertMsg({ type: "error", text: err?.message || "Failed to update stage." });
      }
    });
  };

  // Document Verification Toggle
  const handleSetDocumentStatus = (docType: string, status: "VERIFIED" | "REJECTED") => {
    setAlertMsg(null);
    startTransition(async () => {
      try {
        const targetId = activeCandidate.leadId || activeCandidate.id || activeCandidate.applicationNo || activeCandidate.applicationNumber;
        const res = await updateLeadDocumentsAction({
          leadId: targetId,
          documentType: docType,
          status,
          schoolId,
          schoolDomain,
        });
        if (res && res.success) {
          setAlertMsg({ type: "success", text: `Document marked as ${status}.` });
          setLocalCandidate((prev: any) => {
            if (!prev) return prev;
            const currentDocs = { ...(prev.documents || {}) };
            currentDocs[docType] = {
              ...(typeof currentDocs[docType] === "object" ? currentDocs[docType] : {}),
              status,
              verificationStatus: status === "VERIFIED" ? "MANUALLY_VERIFIED" : "REJECTED",
              verified: status === "VERIFIED",
              rejected: status === "REJECTED",
            };
            if (docType === "applicationFeeReceipt" && status === "VERIFIED") {
              currentDocs.formFeePaid = true;
              currentDocs.formFeeStatus = "PAID";
            }
            return {
              ...prev,
              documents: currentDocs,
              ...(docType === "applicationFeeReceipt" && status === "VERIFIED" ? { formFeePaid: true, formFeeStatus: "PAID" } : {}),
            };
          });
          if (onLeadUpdated) onLeadUpdated();
          if (onRecordUpdated) onRecordUpdated();
        } else {
          setAlertMsg({ type: "error", text: res?.error || "Failed to update document status." });
        }
      } catch (err: any) {
        setAlertMsg({ type: "error", text: err?.message || "Failed to update document status." });
      }
    });
  };

  // Send Bank Details Email
  const handleSendBankDetailsEmail = async () => {
    setIsSendingBankEmail(true);
    setAlertMsg(null);
    try {
      const targetEmail = parentEmail || "admissions@schoolerp.com";
      const targetId = activeCandidate.leadId || activeCandidate.id;
      const res = await sendBankDetailsEmailAction({
        registerId: targetId,
        schoolDomain,
        guardianEmail: targetEmail,
        applicantName: activeCandidate.applicantName,
        applicationNo: appNo,
        amount: bankDetails.formFeeAmount,
        bankName: bankDetails.bankName,
        accountNumber: bankDetails.accountNumber,
        accountName: bankDetails.accountName,
      });

      if (res && res.success) {
        setAlertMsg({ type: "success", text: `Bank instructions dispatched to ${targetEmail}` });
      } else {
        setAlertMsg({ type: "error", text: res?.error || "Failed to dispatch bank email." });
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Failed to dispatch email." });
    } finally {
      setIsSendingBankEmail(false);
    }
  };

  // Mark Form Fee Paid
  const handleMarkAsPaid = async () => {
    setIsMarkingPaid(true);
    setAlertMsg(null);
    try {
      const targetId = activeCandidate.leadId || activeCandidate.id;
      const res = await markFormFeePaidAction({
        registerId: targetId,
        schoolDomain,
      });

      if (res && res.success) {
        setAlertMsg({ type: "success", text: "Application fee verified and marked as PAID ✓" });
        setLocalCandidate((prev: any) => ({
          ...prev,
          formFeePaid: true,
          formFeeStatus: "PAID",
          documents: {
            ...(prev?.documents || {}),
            formFeePaid: true,
            formFeeStatus: "PAID",
          },
        }));
        if (onLeadUpdated) onLeadUpdated();
        if (onRecordUpdated) onRecordUpdated();
      } else {
        setAlertMsg({ type: "error", text: res?.error || "Failed to mark fee paid." });
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Failed to mark fee paid." });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // Save Screening & Offline Exam Scores
  const handleSaveScreening = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);
    const scoreNum = examScore !== "" ? parseFloat(examScore) : undefined;

    const cleanSubjectScores: Record<string, number> = {};
    Object.entries(subjectScores).forEach(([k, v]) => {
      if (v !== "" && !isNaN(Number(v))) {
        cleanSubjectScores[k] = Number(v);
      }
    });

    startTransition(async () => {
      try {
        const targetId = activeCandidate.leadId || activeCandidate.id;
        const res = await updateLeadScreeningAction({
          leadId: targetId,
          schoolId,
          schoolDomain,
          examScore: scoreNum,
          subjectScores: cleanSubjectScores,
          interviewRating,
          recommendation,
          notes: screeningNotes,
        });

        if (res && res.success) {
          setAlertMsg({ type: "success", text: "Exam score and screening assessment saved successfully." });
          if (scoreNum !== undefined) {
            await saveManualEntranceScoreAction({
              leadId: targetId,
              score: scoreNum,
              schoolId,
              schoolDomain,
            });
          }
          if (onLeadUpdated) onLeadUpdated();
          if (onRecordUpdated) onRecordUpdated();
        } else {
          setAlertMsg({ type: "error", text: res?.error || "Failed to save assessment." });
        }
      } catch (err: any) {
        setAlertMsg({ type: "error", text: err?.message || "Failed to save assessment." });
      }
    });
  };

  // 1-Click Final Matriculation
  const handleFinalizeEnrollment = () => {
    if (
      !confirm(
        `Confirm matriculation of ${activeCandidate.applicantName} into ${activeCandidate.targetGrade}? This will create an official SIS student record.`
      )
    ) {
      return;
    }

    setAlertMsg(null);
    startTransition(async () => {
      try {
        const targetId = activeCandidate.leadId || activeCandidate.id;
        let res: any = null;

        if (activeCandidate.registerId) {
          res = await enrollApplicantFromRegisterAction({
            registerId: activeCandidate.registerId,
            schoolId,
            schoolDomain,
          });
        } else {
          res = await enrollApplicantAction({
            leadId: targetId,
            schoolId,
            schoolDomain,
          });
        }

        if (res && res.success) {
          setAlertMsg({
            type: "success",
            text: `Applicant successfully matriculated! Admission No: ${
              res.student?.admissionNumber || "Generated"
            }`,
          });
          setLocalCandidate((prev: any) => ({ ...prev, status: "ENROLLED" }));
          if (onLeadUpdated) onLeadUpdated();
          if (onRecordUpdated) onRecordUpdated();
        } else {
          setAlertMsg({ type: "error", text: res?.error || "Enrollment failed." });
        }
      } catch (err: any) {
        setAlertMsg({ type: "error", text: err?.message || "Enrollment failed." });
      }
    });
  };

  // Dispatch Admit Slip Email
  const handleDispatchAdmitSlip = async () => {
    setIsDispatchingSlip(true);
    setAlertMsg(null);
    try {
      const targetId = activeCandidate.leadId || activeCandidate.id;
      const res = await scheduleAndDispatchExamAdmitSlipAction({
        leadId: targetId,
        schoolId,
        schoolDomain,
      });
      if (res && res.success) {
        setAlertMsg({
          type: "success",
          text: res.emailSent
            ? `Admit Slip dispatched to ${res.recipient} via Resend!`
            : `Admit Slip generated. Roll No: ${res.examSchedule?.rollNo}`,
        });
        if (onLeadUpdated) onLeadUpdated();
      } else {
        setAlertMsg({ type: "error", text: res?.error || "Failed to dispatch Admit Slip." });
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err?.message || "Failed to dispatch Admit Slip." });
    } finally {
      setIsDispatchingSlip(false);
    }
  };



  return (
    <div
      className={`fixed inset-0 z-50 justify-end bg-slate-900/60 backdrop-blur-xs flex transition-opacity duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-zinc-900 h-screen shadow-2xl flex flex-col border-l border-slate-200 dark:border-zinc-800 overflow-hidden transition-all duration-300 ${
          isMaximized ? "w-full max-w-7xl md:w-[95vw]" : "w-full max-w-xl md:max-w-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. TOP HEADER */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xl font-black shrink-0 shadow-md border border-indigo-400/30">
                {activeCandidate.applicantName?.[0] || "A"}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                    {activeCandidate.applicantName}
                  </h3>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      currentStatus === "ENROLLED"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : currentStatus === "APPROVED"
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {currentStatus}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-indigo-200">
                  <span className="flex items-center gap-1 font-semibold text-white">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{activeCandidate.targetGrade || "Primary 1"}</span>
                  </span>
                  <span className="text-slate-500">•</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(appNo, "app")}
                    className="font-mono text-[11px] text-slate-300 hover:text-white flex items-center gap-1 transition"
                    title="Click to copy tracking ID"
                  >
                    <span>{appNo}</span>
                    {copiedAppNo ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title={isMaximized ? "Minimize Window" : "Maximize Window"}
                aria-label={isMaximized ? "Minimize Window" : "Maximize Window"}
              >
                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Close Dossier"
                aria-label="Close Dossier"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. RESPONSIVE SUB-NAVIGATION TAB BAR */}
        <div className="bg-slate-100 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-700 px-4 sm:px-6 py-2.5 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
            {[
              { id: "overview", label: "Overview & Progression", icon: UserCheck },
              { id: "credentials", label: "Credentials & Verification", icon: FileCheck },
              { id: "screening", label: "Assessment & Exam", icon: Star },
              { id: "timeline", label: "Audit Timeline", icon: History },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-zinc-700"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. ALERT BANNER */}
        {alertMsg && (
          <div
            className={`p-3 text-xs font-semibold flex items-center justify-between gap-2 shrink-0 ${
              alertMsg.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-b border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-rose-50 text-rose-900 border-b border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {alertMsg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{alertMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setAlertMsg(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 4. WORKSPACE BODY - FULLY SCROLLABLE & MOBILE OPTIMIZED */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50 dark:bg-zinc-950/40 overflow-x-hidden">
          {/* ===================== TAB 1: OVERVIEW & PROGRESSION ===================== */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* STAGE PROGRESSION TRACKER & ACTION BUTTONS */}
              <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <span>Admissions Pipeline Progression</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    Step {currentStageIndex + 1} of {STAGES.length}
                  </span>
                </div>

                {/* Step indicator pills */}
                <div className="grid grid-cols-5 gap-1">
                  {STAGES.map((s, idx) => {
                    const isPassed = idx <= currentStageIndex;
                    const isCurrent = idx === currentStageIndex;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleAdvanceStage(s)}
                        disabled={isPending}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-blue-600 ring-2 ring-blue-500/40"
                            : isPassed
                            ? "bg-emerald-500"
                            : "bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300"
                        }`}
                        title={`Advance to ${s}`}
                      />
                    );
                  })}
                </div>

                {/* Main progression actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
                  {currentStageIndex < STAGES.length - 1 && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAdvanceStage(STAGES[currentStageIndex + 1])}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <span>Advance to {STAGES[currentStageIndex + 1]}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}

                  {canMutate && currentStatus !== "ENROLLED" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleFinalizeEnrollment}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer ml-auto"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>1-Click Matriculate</span>
                    </button>
                  )}
                </div>
              </div>

              {/* QUICK COMMUNICATION TRIGGERS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <a
                  href={parentPhone !== "Not provided" ? `tel:${parentPhone}` : undefined}
                  className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 flex items-center justify-center gap-2 font-bold text-xs transition"
                >
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Call Parent</span>
                </a>

                <a
                  href={cleanPhone ? `https://wa.me/${cleanPhone}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl border bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800/60 hover:bg-green-100 flex items-center justify-center gap-2 font-bold text-xs transition"
                >
                  <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={handleOpenEmailModal}
                  className="p-3 rounded-xl border bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center justify-center gap-2 font-bold text-xs transition cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Email Guardian</span>
                </button>
              </div>

              {/* CORE APPLICANT BIO-DATA */}
              <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800 pb-2">
                  Candidate Bio-Data &amp; Enrollment Info
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-bold uppercase text-[10px]">
                      Full Name
                    </span>
                    <p className="font-extrabold text-slate-900 dark:text-zinc-50 text-sm">
                      {activeCandidate.applicantName}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-bold uppercase text-[10px]">
                      Target Grade / Cohort
                    </span>
                    <p className="font-bold text-slate-800 dark:text-zinc-200 text-sm">
                      {activeCandidate.targetGrade || "Primary 1"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-bold uppercase text-[10px]">
                      Tracking / Application Number
                    </span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-700 dark:text-zinc-300">
                      <span>{appNo}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(appNo, "app")}
                        className="text-slate-400 hover:text-blue-600 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-bold uppercase text-[10px]">
                      Submission Date
                    </span>
                    <p className="font-mono text-slate-700 dark:text-zinc-300">
                      {new Date(activeCandidate.createdAt || Date.now()).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* PARENT / GUARDIAN CONTACT DETAILS */}
              <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800 pb-2">
                  Parent / Guardian Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-bold uppercase text-[10px]">
                      Parent Name
                    </span>
                    <p className="font-bold text-slate-800 dark:text-zinc-200">
                      {activeCandidate.parentName || "Parent / Guardian"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-bold uppercase text-[10px]">
                      Telephone Contact
                    </span>
                    <p className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                      {parentPhone}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block mb-0.5 font-bold uppercase text-[10px]">
                      Email Address
                    </span>
                    <p className="font-medium text-slate-700 dark:text-zinc-300">
                      {parentEmail || "Not provided on file"}
                    </p>
                  </div>
                </div>
              </div>

              {/* APPLICATION FEE & DIRECT SETTLEMENT INSTRUCTIONS */}
              <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Application Fee
                  </h4>
                  {feeState === "PAID" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                      <Check className="w-3.5 h-3.5" />
                      <span>Paid</span>
                    </span>
                  ) : feeState === "PENDING" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300">
                      <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                      <span>Pending</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                      <span>Unpaid</span>
                    </span>
                  )}
                </div>

                {/* PARENT RECEIPT INSPECTION BANNER */}
                {receiptUrl && (
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-blue-950 dark:text-blue-200 truncate">
                          Application Fee Receipt Attached
                        </p>
                        <p className="text-[10px] text-blue-700 dark:text-blue-400 truncate">
                          Proof of payment uploaded by parent for verification
                        </p>
                      </div>
                    </div>
                    <a
                      href={receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-md shadow-xs hover:bg-blue-50 dark:hover:bg-zinc-800 shrink-0 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Inspect Receipt</span>
                    </a>
                  </div>
                )}

                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-lg text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bank:</span>
                    <strong className="text-slate-800 dark:text-zinc-100">{bankDetails.bankName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account No:</span>
                    <strong className="text-slate-800 dark:text-zinc-100">{bankDetails.accountNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Narration:</span>
                    <span className="text-slate-700 dark:text-zinc-300">{appNo}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <button
                    type="button"
                    onClick={handleSendBankDetailsEmail}
                    disabled={isSendingBankEmail}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 text-blue-500" />
                    <span>{isSendingBankEmail ? "Sending..." : "Email Bank Details"}</span>
                  </button>

                  {!isFeePaid && canMutate && (
                    <button
                      type="button"
                      onClick={handleMarkAsPaid}
                      disabled={isMarkingPaid}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ml-auto"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isMarkingPaid ? "Verifying..." : "Mark as Paid"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAB 2: CREDENTIALS & VERIFICATION ===================== */}
          {activeTab === "credentials" && (
            <div className="space-y-5">
              {/* PARENT SELF-SERVICE LINK CARD */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 sm:p-5 rounded-xl border border-indigo-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-white">Self-Service Document Upload Link</h4>
                  <p className="text-xs text-indigo-200 mt-0.5 leading-relaxed">
                    Share secure portal link with parents to attach birth certificates and transcripts.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isGeneratingLink}
                  onClick={async () => {
                    setIsGeneratingLink(true);
                    try {
                      const targetId = activeCandidate.leadId || activeCandidate.id;
                      const candidateName =
                        activeCandidate.applicantName ||
                        `${activeCandidate.firstName || ""} ${activeCandidate.lastName || ""}`.trim() ||
                        "Applicant";

                      // Call fresh token generation endpoint
                      const res = await fetch(
                        `/api/v1/admissions/upload/${targetId}/generate-link?schoolDomain=${encodeURIComponent(schoolDomain || "")}&schoolId=${encodeURIComponent(schoolId || "")}`,
                        { method: "POST" }
                      );
                      const data = await res.json().catch(() => ({}));
                      let link = data?.uploadUrl;

                      if (!link) {
                        const token = data?.token || activeCandidate.uploadToken || activeCandidate.documents?.uploadToken || targetId;
                        link = `${window.location.origin}/${schoolDomain}/admissions/upload/${targetId}?token=${token}`;
                      }

                      const descriptiveMessage = `Dear Parent/Guardian, please use this secure link to upload the remaining pending credentials for ${candidateName}: ${link}`;
                      handleCopy(descriptiveMessage, "link");
                    } catch (err) {
                      console.error("[GENERATE_LINK_ERROR]:", err);
                      const targetId = activeCandidate.leadId || activeCandidate.id;
                      const token = activeCandidate.uploadToken || activeCandidate.documents?.uploadToken || targetId;
                      const link = `${window.location.origin}/${schoolDomain}/admissions/upload/${targetId}?token=${token}`;
                      const candidateName =
                        activeCandidate.applicantName ||
                        `${activeCandidate.firstName || ""} ${activeCandidate.lastName || ""}`.trim() ||
                        "Applicant";
                      const descriptiveMessage = `Dear Parent/Guardian, please use this secure link to upload the remaining pending credentials for ${candidateName}: ${link}`;
                      handleCopy(descriptiveMessage, "link");
                    } finally {
                      setIsGeneratingLink(false);
                    }
                  }}
                  className="px-3.5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink ? "Message Copied!" : isGeneratingLink ? "Generating Link..." : "Copy Portal Link"}</span>
                </button>
              </div>

              {/* THE COMPLETE CANONICAL 6-DOCUMENT CHECKLIST */}
              <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3 gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      Statutory &amp; Admissions Verification Checklist ({kycChecklist.length})
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                      5 Mandatory • 1 Statutory NIN
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendMissingDocsReminder}
                    disabled={isSendingReminder}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSendingReminder ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Bell className="w-3.5 h-3.5" />
                    )}
                    <span>{isSendingReminder ? "Sending Reminder..." : "Send Reminder"}</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-zinc-800 space-y-2">
                  {kycChecklist.map((doc) => {
                    const docRecord = resolveDocRecord(localCandidate || activeCandidate, doc.key);
                    const isFeeDoc = doc.key === "applicationFeeReceipt";
                    const isVerified = isFeeDoc
                      ? Boolean(
                          isFeePaid ||
                          docRecord.verified ||
                          docRecord.status === "VERIFIED" ||
                          docRecord.status === "MANUALLY_VERIFIED" ||
                          docRecord.status === "AUTO_VERIFIED" ||
                          docRecord.verificationStatus === "MANUALLY_VERIFIED" ||
                          docRecord.verificationStatus === "AUTO_VERIFIED" ||
                          docs.formFeeStatus === "PAID"
                        )
                      : Boolean(
                          docRecord.verified ||
                          docRecord.status === "VERIFIED" ||
                          docRecord.status === "MANUALLY_VERIFIED" ||
                          docRecord.status === "AUTO_VERIFIED" ||
                          docRecord.verificationStatus === "MANUALLY_VERIFIED" ||
                          docRecord.verificationStatus === "AUTO_VERIFIED"
                        );
                    const isRejected = isFeeDoc
                      ? Boolean(
                          docRecord.rejected ||
                          docRecord.status === "REJECTED" ||
                          docRecord.status === "REJECTED" ||
                          docRecord.verificationStatus === "REJECTED" ||
                          docs.formFeeStatus === "REJECTED"
                        )
                      : Boolean(
                          docRecord.rejected ||
                          docRecord.status === "REJECTED" ||
                          docRecord.verificationStatus === "REJECTED"
                        );
                    const hasFile = Boolean(doc.url);

                    return (
                      <div
                        key={doc.key}
                        className="pt-3 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isVerified
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : isRejected
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                : hasFile
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"
                            }`}
                          >
                            <FileCheck className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-slate-900 dark:text-zinc-100 text-xs sm:text-sm">
                                {doc.label}
                              </p>
                              {doc.mandatory ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80">
                                  Required
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                                  Statutory
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {hasFile ? (
                                <span
                                  className={`font-semibold ${
                                    isVerified
                                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                      : isRejected
                                      ? "text-rose-600 dark:text-rose-400 font-bold"
                                      : "text-blue-600 dark:text-blue-400"
                                  }`}
                                >
                                  {isVerified ? "Verified ✓" : isRejected ? "Rejected ✗" : "Uploaded (Pending Review)"}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-zinc-500 italic">
                                  Not yet uploaded
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Document Actions */}
                        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
                          {hasFile && (
                            <button
                              type="button"
                              onClick={() => window.open(doc.url, "_blank", "noopener,noreferrer")}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                              title={`View ${doc.label}`}
                            >
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                              <span>View</span>
                            </button>
                          )}

                          {canMutate && (
                            <label className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs transition flex items-center gap-1 cursor-pointer">
                              <UploadCloud className="w-3 h-3 text-indigo-500" />
                              <span>{hasFile ? "Replace" : "Upload"}</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleFileUpload(doc.key, e.target.files[0]);
                                  }
                                }}
                              />
                            </label>
                          )}

                          {canMutate && hasFile && (
                            <>
                              <button
                                type="button"
                                disabled={isVerified}
                                onClick={async () => {
                                  if (doc.key === "applicationFeeReceipt") {
                                    await handleMarkAsPaid();
                                  }
                                  handleSetDocumentStatus(doc.key, "VERIFIED");
                                }}
                                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                                  isVerified
                                    ? "bg-emerald-600 text-white cursor-default"
                                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                                }`}
                              >
                                {isVerified ? "Verified ✓" : "Verify"}
                              </button>

                              {!isVerified && (
                                <button
                                  type="button"
                                  onClick={() => handleSetDocumentStatus(doc.key, "REJECTED")}
                                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                                    isRejected
                                      ? "bg-rose-600 text-white"
                                      : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                                  }`}
                                >
                                  {isRejected ? "Rejected ✗" : "Reject"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAB 3: ASSESSMENT & EXAM ===================== */}
          {activeTab === "screening" && (
            <div className="space-y-5">
              {/* DISPATCH SCREENING SCHEDULE CARD */}
              <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 text-white p-4 sm:p-5 rounded-xl border border-indigo-800/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold">Entrance Screening Admit Slip</h4>
                  <p className="text-xs text-indigo-200 mt-0.5 leading-relaxed">
                    Official examination schedule dispatched automatically via Resend.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDispatchAdmitSlip}
                  disabled={isDispatchingSlip}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isDispatchingSlip ? "Dispatching..." : "Dispatch Admit Slip"}</span>
                </button>
              </div>

              {/* OFFLINE ENTRANCE EXAM FORM */}
              <form
                onSubmit={handleSaveScreening}
                className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    Entrance Exam &amp; Interview Marks
                  </h4>
                  <span className="text-xs text-slate-400">Offline Pen-and-Paper Scoring</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                      Overall Exam Score (0-100)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={examScore}
                      onChange={(e) => setExamScore(e.target.value)}
                      placeholder="e.g. 78"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                      Admissions Recommendation
                    </label>
                    <select
                      value={recommendation}
                      onChange={(e) => setRecommendation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none font-semibold text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="RECOMMENDED">RECOMMENDED FOR ADMISSION</option>
                      <option value="PROVISIONAL">PROVISIONAL APPROVAL</option>
                      <option value="WAITLIST">WAITLIST CANDIDATE</option>
                      <option value="NOT_RECOMMENDED">NOT RECOMMENDED</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1 text-xs">
                    Staff Examiner Notes
                  </label>
                  <textarea
                    rows={2}
                    value={screeningNotes}
                    onChange={(e) => setScreeningNotes(e.target.value)}
                    placeholder="Enter candidate examination notes or interview observations..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {canMutate && (
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Assessment Results</span>
                  </button>
                )}
              </form>
            </div>
          )}

          {/* ===================== TAB 4: AUDIT TIMELINE ===================== */}
          {activeTab === "timeline" && (
            <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300 border-b border-slate-100 dark:border-zinc-800 pb-2">
                Candidate Progression Audit Log
              </h4>

              {Array.isArray(activeCandidate.logs) && activeCandidate.logs.length > 0 ? (
                <div className="space-y-3">
                  {activeCandidate.logs
                    .slice()
                    .reverse()
                    .map((log: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-lg border border-slate-200/80 dark:border-zinc-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-zinc-100">
                            {log.action || "STATUS_CHANGE"}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : "Just now"}
                          </span>
                        </div>
                        {log.notes && (
                          <p className="text-slate-600 dark:text-zinc-300 text-[11px]">{log.notes}</p>
                        )}
                        {log.score !== undefined && (
                          <p className="text-indigo-600 font-bold font-mono text-[11px]">
                            Score Recorded: {log.score}%
                          </p>
                        )}
                        {log.recordedBy && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Recorded by: {log.recordedBy}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 space-y-1">
                  <History className="w-6 h-6 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">No audit logs recorded yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================== EMAIL GUARDIAN COMPOSER MODAL OVERLAY ===================== */}
      {isEmailModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6"
          onClick={() => setIsEmailModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-zinc-100">
                    Email Applicant Guardian
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {activeCandidate.applicantName} • {appNo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSendDirectEmail} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5">
                  Guardian Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={emailForm.recipientEmail}
                  onChange={(e) => setEmailForm((prev) => ({ ...prev, recipientEmail: e.target.value }))}
                  placeholder="guardian@example.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                {!emailForm.recipientEmail && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    No guardian email was linked yet. Please enter the parent&apos;s email above.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5">
                  Subject Line <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm((prev) => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5">
                  Message Body <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  required
                  value={emailForm.message}
                  onChange={(e) => setEmailForm((prev) => ({ ...prev, message: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-sans"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {emailForm.recipientEmail ? (
                  <a
                    href={`mailto:${emailForm.recipientEmail}?subject=${encodeURIComponent(
                      emailForm.subject
                    )}&body=${encodeURIComponent(emailForm.message)}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 self-start sm:self-auto py-1.5"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Native Mail Client</span>
                  </a>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2 justify-end ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsEmailModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingDirectEmail}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSendingDirectEmail ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{isSendingDirectEmail ? "Sending..." : "Send Email"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
