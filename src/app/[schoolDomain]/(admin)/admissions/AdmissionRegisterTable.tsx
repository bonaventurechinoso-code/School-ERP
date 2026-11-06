"use client";

import React, { useState, useEffect, useMemo, useTransition, useCallback } from "react";
import {
  Search,
  RefreshCw,
  Copy,
  Check,
  Eye,
  FileCheck,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ban,
  UserCheck,
  Users,
  FileText,
  SlidersHorizontal,
  ArrowRight,
  Edit3,
  Save,
  Plus,
  AlertTriangle,
  X,
  Trash2,
  Sparkles,
} from "lucide-react";
import ApplicantDossierDrawer from "./ApplicantDossierDrawer";
import {
  enrollApplicantFromRegisterAction,
  enrollApplicantAction,
  saveManualEntranceScoreAction,
  bulkSaveManualEntranceScoresAction,
  transitionCandidateStageAction,
  deleteApplicantAction,
  deduplicateAdmissionsAction,
} from "./actions";

export interface UnifiedApplicantRow {
  id: string;
  leadId?: string;
  registerId?: string;
  applicationNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  classApplied: string;
  assignedClass?: string;
  parentPhone: string;
  email?: string;
  status: string;
  stageId?: string;
  feeState: "UNPAID" | "PENDING" | "PAID";
  formFeePaid: boolean;
  entranceScore: number | null;
  documents?: any;
  createdAt: string;
  rawLead?: any;
  rawRegister?: any;
}

export interface AdmissionRegisterTableProps {
  schoolId: string;
  schoolDomain: string;
  schoolName?: string;
  canMutate?: boolean;
  isTenantAdmin?: boolean;
  leads?: any[];
  stages?: any[];
  activeTrackName?: string;
  onLeadUpdated?: (updatedLead: any) => void;
  onLeadDeleted?: (deletedLeadId: string) => void;
}

export default function AdmissionRegisterTable({
  schoolId,
  schoolDomain,
  schoolName = "Institution Admissions Desk",
  canMutate = true,
  isTenantAdmin = false,
  leads = [],
  stages = [],
  activeTrackName = "",
  onLeadUpdated,
  onLeadDeleted,
}: AdmissionRegisterTableProps) {
  const [remoteRecords, setRemoteRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [copiedAppNo, setCopiedAppNo] = useState<string | null>(null);

  // Deletion & Deduplication state
  const [rowToDelete, setRowToDelete] = useState<UnifiedApplicantRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  // Score editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [scoreInputVal, setScoreInputVal] = useState<string>("");
  const [savingScoreId, setSavingScoreId] = useState<string | null>(null);

  // Bulk Entry Mode for offline test marks
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkScores, setBulkScores] = useState<Record<string, string>>({});
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  // Drawer state
  const [selectedRow, setSelectedRow] = useState<UnifiedApplicantRow | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  // Action feedback
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admissions?tenantId=${encodeURIComponent(schoolId)}`, {
        headers: {
          "x-tenant-id": schoolId,
        },
      });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json) ? json : json.data || [];
        setRemoteRecords(data);
      }
    } catch (err) {
      console.error("Failed to load admissions register:", err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // UNIFIED DATASET: Merge active track Kanban leads with legacy/direct register records
  const unifiedRows: UnifiedApplicantRow[] = useMemo(() => {
    const rows: UnifiedApplicantRow[] = [];
    const seenAppNos = new Set<string>();
    const seenIds = new Set<string>();

    // 1. Process active track leads first (Primary source of truth)
    for (const lead of leads) {
      const appNo =
        lead.documents?.applicationNo ||
        lead.uploadToken?.substring(0, 8).toUpperCase() ||
        `ADM-${lead.id.substring(0, 6).toUpperCase()}`;

      seenAppNos.add(appNo.toLowerCase());
      seenIds.add(lead.id);

      const nameParts = (lead.applicantName || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "Candidate";
      const lastName = nameParts.slice(1).join(" ") || "";

      const rawScore =
        lead.documents?.entranceScore ??
        lead.documents?.examScore ??
        lead.documents?.examAggregate ??
        null;
      const numScore = rawScore !== null && rawScore !== undefined ? Number(rawScore) : null;

      rows.push({
        id: lead.id,
        leadId: lead.id,
        applicationNo: appNo,
        firstName,
        lastName,
        fullName: lead.applicantName || `${firstName} ${lastName}`,
        classApplied: lead.targetGrade || "Primary 1",
        assignedClass: lead.targetGrade,
        parentPhone: lead.parentPhone || lead.parentContact || "N/A",
        email: lead.studentEmail || lead.parentEmail || "",
        status: (lead.status || "INQUIRY").toUpperCase(),
        stageId: lead.stageId,
        feeState: (() => {
          const lDocs = lead.documents || {};
          const isPaid = Boolean(
            lDocs.formFeePaid ||
            lDocs.feePaid ||
            lDocs.formFeeStatus === "PAID" ||
            lDocs.formFeeStatus === "SETTLED" ||
            lDocs.paymentState === "SETTLED" ||
            lDocs.applicationFeeReceipt?.status === "VERIFIED" ||
            lDocs.applicationFeeReceipt?.verified === true ||
            lDocs.paymentReceipt?.status === "VERIFIED" ||
            lead.status === "APPROVED" ||
            lead.status === "ENROLLED"
          );
          if (isPaid) return "PAID";
          const isPending = Boolean(
            lDocs.formFeeStatus === "PENDING" ||
            lDocs.formFeeStatus === "PENDING_VERIFICATION" ||
            lDocs.paymentState === "PAYMENT_PENDING_REVIEW" ||
            lDocs.applicationFeeReceiptUrl ||
            lDocs.formFeeReceiptUrl ||
            lDocs.paymentReceiptUrl ||
            lDocs.applicationFeeReceipt?.url ||
            lDocs.paymentReceipt?.url ||
            (Array.isArray(lDocs.documents) && lDocs.documents.some((d: any) =>
              (d.key === "applicationFeeReceipt" || d.type === "applicationFeeReceipt" || d.key === "paymentReceipt" || d.type === "PAYMENT_RECEIPT")
            ))
          );
          if (isPending) return "PENDING";
          return "UNPAID";
        })(),
        formFeePaid: Boolean(
          lead.documents?.formFeePaid ||
            lead.documents?.feePaid ||
            lead.documents?.formFeeStatus === "PAID" ||
            lead.documents?.formFeeStatus === "SETTLED" ||
            lead.documents?.paymentState === "SETTLED" ||
            lead.documents?.applicationFeeReceipt?.status === "VERIFIED" ||
            lead.documents?.applicationFeeReceipt?.verified === true ||
            lead.documents?.paymentReceipt?.status === "VERIFIED" ||
            lead.status === "APPROVED" ||
            lead.status === "ENROLLED"
        ),
        entranceScore: numScore,
        documents: lead.documents || {},
        createdAt: lead.createdAt || new Date().toISOString(),
        rawLead: lead,
      });
    }

    // 2. Append remote register records if they don't already exist in leads
    for (const reg of remoteRecords) {
      const appNo = reg.applicationNo || "";
      if (seenAppNos.has(appNo.toLowerCase()) || seenIds.has(reg.id)) {
        continue;
      }
      seenAppNos.add(appNo.toLowerCase());
      seenIds.add(reg.id);

      const creds = typeof reg.credentialsJson === "object" && reg.credentialsJson !== null ? reg.credentialsJson : {};
      const rawScore = creds.entranceScore ?? creds.examScore ?? null;
      const numScore = rawScore !== null && rawScore !== undefined ? Number(rawScore) : null;

      const regFeePaid = Boolean(
        reg.formFeePaid ||
        creds.formFeePaid ||
        creds.feePaid ||
        creds.formFeeStatus === "PAID" ||
        creds.formFeeStatus === "SETTLED" ||
        creds.paymentState === "SETTLED" ||
        creds.applicationFeeReceipt?.status === "VERIFIED" ||
        creds.applicationFeeReceipt?.verified === true ||
        creds.paymentReceipt?.status === "VERIFIED" ||
        reg.status?.toUpperCase() === "APPROVED" ||
        reg.status?.toUpperCase() === "ENROLLED"
      );
      const regFeePending = Boolean(
        !regFeePaid && (
          creds.formFeeStatus === "PENDING" ||
          creds.formFeeStatus === "PENDING_VERIFICATION" ||
          creds.paymentState === "PAYMENT_PENDING_REVIEW" ||
          creds.applicationFeeReceiptUrl ||
          creds.formFeeReceiptUrl ||
          creds.paymentReceiptUrl ||
          creds.applicationFeeReceipt?.url ||
          creds.paymentReceipt?.url ||
          (Array.isArray(creds.documents) && creds.documents.some((d: any) =>
            (d.key === "applicationFeeReceipt" || d.type === "applicationFeeReceipt" || d.key === "paymentReceipt" || d.type === "PAYMENT_RECEIPT")
          ))
        )
      );
      const regFeeState: "UNPAID" | "PENDING" | "PAID" = regFeePaid ? "PAID" : regFeePending ? "PENDING" : "UNPAID";

      rows.push({
        id: reg.id,
        registerId: reg.id,
        applicationNo: appNo,
        firstName: reg.firstName,
        lastName: reg.lastName,
        fullName: `${reg.firstName} ${reg.lastName}`,
        classApplied: reg.classApplied || "Primary 1",
        assignedClass: reg.assignedClass || reg.classApplied,
        parentPhone: reg.parentPhone || "N/A",
        email: reg.email || "",
        status: (reg.status || "NEW").toUpperCase(),
        feeState: regFeeState,
        formFeePaid: regFeePaid,
        entranceScore: numScore,
        documents: creds,
        createdAt: reg.createdAt || new Date().toISOString(),
        rawRegister: reg,
      });
    }

    return rows;
  }, [leads, remoteRecords]);

  // Filtered rows by search and status
  const filteredRows = useMemo(() => {
    return unifiedRows.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.fullName.toLowerCase().includes(q) ||
        r.applicationNo.toLowerCase().includes(q) ||
        r.parentPhone.toLowerCase().includes(q) ||
        r.classApplied.toLowerCase().includes(q);

      const s = r.status;
      const matchesStatus =
        statusFilter === "ALL" ||
        s === statusFilter ||
        (statusFilter === "DOCS_PENDING" && (s === "APPLIED" || s === "DOCS_PENDING" || s === "NEW")) ||
        (statusFilter === "INTERVIEW" && (s === "INTERVIEW" || s === "VERIFIED" || s === "SCREENED")) ||
        (statusFilter === "CONVERTED" && (s === "ENROLLED" || s === "CONVERTED" || s === "ADMITTED"));

      return matchesSearch && matchesStatus;
    });
  }, [unifiedRows, searchQuery, statusFilter]);

  const handleCopy = (text: string) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopiedAppNo(text);
      setTimeout(() => setCopiedAppNo(null), 2000);
    }
  };

  // Save manual entrance assessment score inline
  const handleSaveScore = async (row: UnifiedApplicantRow, scoreVal: string) => {
    const parsed = parseFloat(scoreVal);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      setActionMessage({ type: "error", text: "Please provide a valid score between 0 and 100." });
      return;
    }

    setSavingScoreId(row.id);
    setActionMessage(null);

    try {
      const res = await saveManualEntranceScoreAction({
        leadId: row.leadId || row.id,
        score: parsed,
        schoolId,
        schoolDomain,
        notes: `Offline entrance examination score entered via Admissions Register table`,
      });

      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Entrance score of ${parsed}% saved successfully for ${row.fullName}.`,
        });

        if (row.rawLead && onLeadUpdated) {
          onLeadUpdated({
            ...row.rawLead,
            documents: {
              ...(row.rawLead.documents || {}),
              entranceScore: parsed,
              examScore: parsed,
              examAggregate: parsed,
              manualScoreEntry: true,
              examPassed: parsed >= 50,
            },
          });
        }

        setEditingRowId(null);
        setScoreInputVal("");
        await fetchRecords();
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to save entrance score." });
      }
    } catch (err: any) {
      console.error("Score save error:", err);
      setActionMessage({ type: "error", text: err.message || "Failed to save entrance score." });
    } finally {
      setSavingScoreId(null);
    }
  };

  // Bulk save manual entrance scores for multiple applicants
  const handleSaveBulkScores = async () => {
    const entries: Array<{ leadId: string; score: number }> = [];

    for (const [rowId, val] of Object.entries(bulkScores)) {
      if (val !== undefined && val !== "") {
        const parsed = parseFloat(val);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          const matchingRow = unifiedRows.find((r) => r.id === rowId);
          if (matchingRow) {
            entries.push({ leadId: matchingRow.leadId || matchingRow.id, score: parsed });
          }
        }
      }
    }

    if (entries.length === 0) {
      setActionMessage({ type: "error", text: "No new valid exam scores were entered." });
      return;
    }

    setIsSavingBulk(true);
    setActionMessage(null);

    try {
      const res = await bulkSaveManualEntranceScoresAction({
        entries,
        schoolId,
        schoolDomain,
      });

      if (res.success || (res.savedCount && res.savedCount > 0)) {
        setActionMessage({
          type: "success",
          text: `Successfully saved ${res.savedCount || entries.length} offline entrance examination scores.`,
        });

        // Update parent state
        if (onLeadUpdated) {
          for (const e of entries) {
            const matchingRow = unifiedRows.find((r) => r.leadId === e.leadId || r.id === e.leadId);
            if (matchingRow && matchingRow.rawLead) {
              onLeadUpdated({
                ...matchingRow.rawLead,
                documents: {
                  ...(matchingRow.rawLead.documents || {}),
                  entranceScore: e.score,
                  examScore: e.score,
                  examAggregate: e.score,
                  manualScoreEntry: true,
                  examPassed: e.score >= 50,
                },
              });
            }
          }
        }

        setIsBulkMode(false);
        setBulkScores({});
        await fetchRecords();
      } else {
        setActionMessage({ type: "error", text: res.errors?.join("; ") || "Failed to bulk save scores." });
      }
    } catch (err: any) {
      console.error("Bulk save score error:", err);
      setActionMessage({ type: "error", text: err.message || "Bulk score entry failed." });
    } finally {
      setIsSavingBulk(false);
    }
  };

  // Advance stage quick trigger
  const handleAdvanceStage = async (row: UnifiedApplicantRow) => {
    if (!canMutate || !row.leadId) return;
    const currentIdx = stages.findIndex((s) => s.id === row.stageId || s.name === row.status);
    if (currentIdx === -1 || currentIdx >= stages.length - 1) return;

    const targetStage = stages[currentIdx + 1];
    setActionLoadingId(row.id);
    setActionMessage(null);

    try {
      const res = await transitionCandidateStageAction({
        leadId: row.leadId,
        targetStageId: targetStage.id,
        targetStatus: targetStage.name,
        schoolId,
        schoolDomain,
      });

      if (res.success) {
        setActionMessage({
          type: "success",
          text: `${row.fullName} advanced to ${targetStage.name}.`,
        });
        if (row.rawLead && onLeadUpdated) {
          onLeadUpdated({
            ...row.rawLead,
            status: targetStage.name,
            stageId: targetStage.id,
          });
        }
        await fetchRecords();
      } else {
        const missing = (res as any)?.missingPrerequisites;
        if (missing && missing.length > 0) {
          setActionMessage({
            type: "error",
            text: `Cannot advance to ${targetStage.name}. Prerequisites missing: ${missing.join(", ")}`,
          });
        } else {
          setActionMessage({ type: "error", text: res.error || "Stage transition failed." });
        }
      }
    } catch (err: any) {
      console.error("Stage transition error:", err);
      setActionMessage({ type: "error", text: err.message || "Stage transition failed." });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Convert/Admit applicant
  const handleAdmit = async (row: UnifiedApplicantRow) => {
    if (!canMutate) {
      setActionMessage({ type: "error", text: "Access Denied: Only authorized staff can matriculate students." });
      return;
    }

    setActionLoadingId(row.id);
    setActionMessage(null);

    try {
      if (row.registerId) {
        const res = await enrollApplicantFromRegisterAction({
          registerId: row.registerId,
          schoolId,
          schoolDomain,
        });
        if (res.success) {
          setActionMessage({
            type: "success",
            text: `Applicant enrolled successfully. Matriculation No: ${(res.student as any)?.admissionNumber || "Generated"}`,
          });
          await fetchRecords();
        } else {
          setActionMessage({ type: "error", text: res.error || "Enrollment failed." });
        }
      } else if (row.leadId) {
        const res = await enrollApplicantAction({
          leadId: row.leadId,
          schoolId,
          schoolDomain,
        });
        if (res.success) {
          setActionMessage({
            type: "success",
            text: `Applicant enrolled successfully. Matriculation No: ${(res.student as any)?.admissionNumber || "Generated"}`,
          });
          if (row.rawLead && onLeadUpdated) {
            onLeadUpdated({ ...row.rawLead, status: "ENROLLED" });
          }
          await fetchRecords();
        } else {
          setActionMessage({ type: "error", text: res.error || "Enrollment failed." });
        }
      }
    } catch (err: any) {
      console.error("Enrollment error:", err);
      setActionMessage({ type: "error", text: err.message || "Enrollment failed." });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Auth-Checked Applicant Deletion
  const handleConfirmDelete = async () => {
    if (!rowToDelete) return;
    setIsDeleting(true);
    setActionMessage(null);

    try {
      const res = await deleteApplicantAction({
        applicantId: rowToDelete.id,
        leadId: rowToDelete.leadId,
        registerId: rowToDelete.registerId,
        schoolId,
        schoolDomain,
      });

      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Applicant "${rowToDelete.fullName}" was removed from the ledger.`,
        });

        // Instantly purge from local state
        setRemoteRecords((prev) =>
          prev.filter(
            (r) =>
              r.id !== rowToDelete.id &&
              r.id !== rowToDelete.registerId &&
              r.id !== rowToDelete.leadId
          )
        );

        if (onLeadDeleted && (rowToDelete.leadId || rowToDelete.id)) {
          onLeadDeleted(rowToDelete.leadId || rowToDelete.id);
        }

        setRowToDelete(null);
        await fetchRecords();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Failed to delete applicant record.",
        });
      }
    } catch (err: any) {
      console.error("Delete applicant error:", err);
      setActionMessage({
        type: "error",
        text: err.message || "Failed to delete applicant record.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Automatic Record Deduplication Engine Trigger
  const handleDeduplicateRegister = async () => {
    setIsDeduplicating(true);
    setActionMessage(null);

    try {
      const res = await deduplicateAdmissionsAction({
        schoolId,
        schoolDomain,
      });

      if (res.success) {
        setActionMessage({
          type: "success",
          text: res.message || `Deduplication complete: Merged ${res.mergedCount} group(s), purged ${res.purgedCount} redundant row(s).`,
        });
        await fetchRecords();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Failed to execute deduplication.",
        });
      }
    } catch (err: any) {
      console.error("Deduplication error:", err);
      setActionMessage({
        type: "error",
        text: err.message || "Failed to execute deduplication.",
      });
    } finally {
      setIsDeduplicating(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const s = (status || "INQUIRY").toUpperCase();
    if (s === "INQUIRY" || s === "NEW") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Inquiry</span>
        </span>
      );
    }
    if (s === "DOCS_PENDING" || s === "APPLIED" || s === "DOCS_SUBMITTED" || s === "UNDER_REVIEW") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>Docs Pending</span>
        </span>
      );
    }
    if (s === "VERIFIED" || s === "SCREENED" || s === "INTERVIEW" || s === "EXAM") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
          <FileCheck className="w-3.5 h-3.5 text-purple-600" />
          <span>Exam / Screening</span>
        </span>
      );
    }
    if (s === "APPROVED" || s === "OFFERED" || s === "PROVISIONAL") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
          <span>Offer Given</span>
        </span>
      );
    }
    if (s === "CONVERTED" || s === "ADMITTED" || s === "ENROLLED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Enrolled</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4 w-full">
      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Spreadsheet Toolbar: Search + Status Filter + Bulk Score Entry Toggle */}
      <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
        <div className="flex flex-1 items-center gap-3 w-full flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search register by candidate name, app no, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition text-slate-800 dark:text-zinc-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-zinc-200 shadow-2xs shrink-0"
          >
            <option value="ALL">All Stages ({unifiedRows.length})</option>
            <option value="INQUIRY">Inquiry</option>
            <option value="DOCS_PENDING">Docs Pending</option>
            <option value="INTERVIEW">Exam / Screening</option>
            <option value="APPROVED">Offer Given</option>
            <option value="CONVERTED">Enrolled</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Bulk offline score mode toggle */}
          {canMutate && (
            <button
              type="button"
              onClick={() => {
                if (isBulkMode) {
                  setIsBulkMode(false);
                  setBulkScores({});
                } else {
                  setIsBulkMode(true);
                  const initial: Record<string, string> = {};
                  unifiedRows.forEach((r) => {
                    if (r.entranceScore !== null) {
                      initial[r.id] = String(r.entranceScore);
                    }
                  });
                  setBulkScores(initial);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition border cursor-pointer ${
                isBulkMode
                  ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
              }`}
              title="Fast Tabular Offline Entrance Exam Score Entry"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isBulkMode ? "Exit Score Entry" : "Offline Exam Marks Entry"}</span>
            </button>
          )}

          {isBulkMode && (
            <button
              type="button"
              onClick={handleSaveBulkScores}
              disabled={isSavingBulk}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingBulk ? "Saving..." : "Save All Scores"}</span>
            </button>
          )}

          {canMutate && (
            <button
              type="button"
              onClick={handleDeduplicateRegister}
              disabled={isDeduplicating || loading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 font-bold text-xs transition shadow-2xs cursor-pointer disabled:opacity-50"
              title="Clean up historic duplicate applicant rows within this institution"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-600 ${isDeduplicating ? "animate-spin" : ""}`} />
              <span>{isDeduplicating ? "Deduplicating..." : "✨ Deduplicate Register"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchRecords}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Data Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/90 dark:border-zinc-800 shadow-sm overflow-hidden w-full">
        {loading && unifiedRows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
            <p className="text-xs sm:text-sm font-semibold">Loading admissions register...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">No applicants in register</p>
            <p className="text-xs">No records match the active track or search filter.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[980px] text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5">App #</th>
                  <th className="py-3 px-3.5">Candidate Name</th>
                  <th className="py-3 px-3.5">Class / Grade</th>
                  <th className="py-3 px-3.5">Stage / Status</th>
                  <th className="py-3 px-3.5">
                    <div className="flex items-center gap-1">
                      <span>Entrance Score</span>
                      <span className="text-[10px] lowercase font-normal text-indigo-500">(0-100)</span>
                    </div>
                  </th>
                  <th className="py-3 px-3.5">Application Fee</th>
                  <th className="py-3 px-3.5">Parent Phone</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredRows.map((r) => {
                  const isActionLoading = actionLoadingId === r.id;
                  const isSavingThisScore = savingScoreId === r.id;
                  const isEditingThisRow = editingRowId === r.id || isBulkMode;
                  const currentScore = r.entranceScore;
                  const hasPassingScore = currentScore !== null && currentScore >= 50;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition group"
                    >
                      {/* Application # */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleCopy(r.applicationNo)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-2 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700 hover:border-blue-400 transition cursor-pointer"
                          title="Click to copy Application Number"
                        >
                          <span>{r.applicationNo}</span>
                          {copiedAppNo === r.applicationNo ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Candidate Name */}
                      <td className="py-3 px-3.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRow(r);
                            setIsDossierOpen(true);
                          }}
                          className="font-bold text-slate-900 dark:text-zinc-50 hover:text-blue-600 dark:hover:text-blue-400 transition text-left cursor-pointer flex items-center gap-2"
                        >
                          <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-black flex items-center justify-center shrink-0">
                            {r.firstName.slice(0, 1).toUpperCase()}
                            {r.lastName.slice(0, 1).toUpperCase()}
                          </span>
                          <span>{r.fullName}</span>
                        </button>
                      </td>

                      {/* Class */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-slate-800 dark:text-zinc-200 font-semibold text-xs">
                          <GraduationCap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{r.assignedClass || r.classApplied}</span>
                        </span>
                      </td>

                      {/* Status / Stage */}
                      <td className="py-3 px-3.5 whitespace-nowrap">{renderStatusBadge(r.status)}</td>

                      {/* EDITABLE ENTRANCE SCORE COLUMN */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {isEditingThisRow ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={isBulkMode ? bulkScores[r.id] ?? "" : scoreInputVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (isBulkMode) {
                                  setBulkScores((prev) => ({ ...prev, [r.id]: val }));
                                } else {
                                  setScoreInputVal(val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (!isBulkMode) {
                                  if (e.key === "Enter") handleSaveScore(r, scoreInputVal);
                                  if (e.key === "Escape") setEditingRowId(null);
                                }
                              }}
                              placeholder="0-100"
                              className="w-16 px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-zinc-800 border-2 border-indigo-400 rounded-md outline-none text-slate-900 dark:text-zinc-50 text-center focus:ring-2 focus:ring-indigo-500"
                              autoFocus={!isBulkMode}
                            />
                            {!isBulkMode && (
                              <>
                                <button
                                  type="button"
                                  disabled={isSavingThisScore}
                                  onClick={() => handleSaveScore(r, scoreInputVal)}
                                  className="p-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer transition shadow-2xs disabled:opacity-50"
                                  title="Save Exam Score"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRowId(null)}
                                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : currentScore !== null ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold font-mono border inline-flex items-center gap-1 ${
                                hasPassingScore
                                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                  : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                              }`}
                            >
                              {hasPassingScore ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                              )}
                              <span>{currentScore}%</span>
                            </span>
                            {canMutate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRowId(r.id);
                                  setScoreInputVal(String(currentScore));
                                }}
                                className="opacity-0 group-hover:opacity-100 transition p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                                title="Edit Entrance Examination Score"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div>
                            {canMutate ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRowId(r.id);
                                  setScoreInputVal("");
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Record Score</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Pending</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Application Fee (UNPAID -> PENDING -> PAID) */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {r.feeState === "PAID" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <Check className="w-3 h-3" />
                            <span>Paid</span>
                          </span>
                        ) : r.feeState === "PENDING" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRow(r);
                              setIsDossierOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950/70 dark:hover:bg-blue-900/80 dark:text-blue-300 border border-blue-300 dark:border-blue-700 transition cursor-pointer shadow-xs"
                            title="Application fee receipt uploaded by parent. Click to inspect & Mark as Paid"
                          >
                            <Clock className="w-3 h-3 text-blue-600 animate-pulse" />
                            <span>Pending</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700">
                            <span>Unpaid</span>
                          </span>
                        )}
                      </td>

                      {/* Parent Phone */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-xs text-slate-600 dark:text-zinc-400">
                        {r.parentPhone}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRow(r);
                              setIsDossierOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-xs text-slate-700 dark:text-zinc-300 transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span>Dossier</span>
                          </button>

                          {canMutate && r.status !== "ENROLLED" && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceStage(r)}
                              disabled={isActionLoading}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                              title="Advance to Next Stage"
                            >
                              <span>Advance</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canMutate && r.status !== "ENROLLED" && (
                            <button
                              type="button"
                              onClick={() => handleAdmit(r)}
                              disabled={isActionLoading}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                            >
                              {isActionLoading ? "..." : "Admit"}
                            </button>
                          )}

                          {canMutate && (
                            <button
                              type="button"
                              onClick={() => setRowToDelete(r)}
                              disabled={isActionLoading}
                              className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
                              title="Delete Applicant Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION DIALOG MODAL */}
      {rowToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/60 max-w-md w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-slate-900 dark:text-zinc-50">
                  Delete Applicant Record
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Are you sure you want to remove <strong>{rowToDelete.fullName}</strong> ({rowToDelete.applicationNo})? This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
              <span className="font-bold">Permanent removal:</span> This will safely purge the candidate dossier, linked credentials, and progression records from your institution&apos;s admissions register.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Applicant</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED MASTER CANDIDATE DOSSIER DRAWER */}
      {selectedRow && (
        <ApplicantDossierDrawer
          lead={selectedRow.rawLead}
          applicant={selectedRow.rawRegister || selectedRow}
          isOpen={isDossierOpen}
          onClose={() => {
            setIsDossierOpen(false);
            setSelectedRow(null);
          }}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          canMutate={canMutate}
          onLeadUpdated={fetchRecords}
          onRecordUpdated={fetchRecords}
        />
      )}
    </div>
  );
}
