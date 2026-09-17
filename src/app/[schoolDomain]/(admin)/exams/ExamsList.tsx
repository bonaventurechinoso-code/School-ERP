"use client";

import React, { useState, useTransition, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTenant } from "@/lib/tenant-context";
import { resolveStaffTierCategory, StaffTierCategory } from "@/lib/staff-roles-config";
import {
  Calendar,
  Award,
  Trash2,
  Edit2,
  Clock,
  MapPin,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Lock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  X,
  Layers,
  BookOpen,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  createScheduledExam,
  updateScheduledExam,
  toggleExamPublishStatus,
  deleteScheduledExam,
  ScheduledExamPayload,
} from "./actions";

// Canonical Nigerian Educational Classes by Tier
export const BONAVEE_CLASSES_MAP: Record<string, string[]> = {
  NURSERY: [
    "Creche",
    "Daycare / Nursery",
    "Nursery 1",
    "Nursery 2",
    "Nursery 3",
    "Pre-School / Kindergarten",
  ],
  PRIMARY: [
    "Primary 1",
    "Primary 2",
    "Primary 3",
    "Primary 4",
    "Primary 5",
    "Primary 6",
  ],
  SECONDARY: [
    "JSS 1",
    "JSS 2",
    "JSS 3",
    "SS 1",
    "SS 2",
    "SS 3",
  ],
  TERTIARY: [
    "100 Level",
    "200 Level",
    "300 Level",
    "400 Level",
    "500 Level",
  ],
};

// Authentic Nigerian Educational Subjects by Tier
export const NURSERY_SUBJECTS: readonly string[] = [
  "Numeracy / Cognitive Development",
  "Literacy / Phonics",
  "Rhymes & Poetry",
  "Social Norms / Habits",
  "Sensory Play & Creative Arts",
  "Health Habits",
];

export const PRIMARY_SUBJECTS: readonly string[] = [
  "Mathematics",
  "English Studies",
  "Basic Science & Technology",
  "Social Studies",
  "Civic Education / National Values",
  "Agricultural Science",
  "Home Economics",
  "Cultural & Creative Arts (CCA)",
  "Computer Studies / ICT",
  "Nigerian History",
  "Nigerian Language (Yoruba/Igbo/Hausa)",
];

export const SECONDARY_SUBJECTS: readonly string[] = [
  "General Mathematics",
  "English Language",
  "Civic Education",
  "Biology",
  "Chemistry",
  "Physics",
  "Further Mathematics",
  "Agricultural Science",
  "Economics",
  "Government",
  "Literature-in-English",
  "Financial Accounting",
  "Commerce",
  "Data Processing / Marketing",
  "Geography",
];

export const HIGHER_ED_COURSES: readonly string[] = [
  "GST 111 - Use of English",
  "GST 112 - Philosophy & Logic",
  "GST 113 - Nigerian Peoples & Culture",
  "GST 211 - Entrepreneurship & Innovation",
  "MTH 101 - Elementary Mathematics",
  "CHM 101 - General Chemistry",
  "PHY 101 - General Physics",
  "COS 101 - Introduction to Computer Science",
];

export const ASSESSMENT_TYPES = [
  { value: "CA1", label: "CA1 (Continuous Assessment 1)", defaultMax: 20, locked: true },
  { value: "CA2", label: "CA2 (Continuous Assessment 2)", defaultMax: 20, locked: true },
  { value: "CA3", label: "CA3 (Continuous Assessment 3)", defaultMax: 20, locked: false },
  { value: "EXAM", label: "EXAM (Terminal Examination)", defaultMax: 60, locked: true },
] as const;

type AssessmentTypeEnum = "CA1" | "CA2" | "CA3" | "EXAM";

type StaffOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type ScheduledExamRecord = {
  id: string;
  tenant_id: string;
  title: string;
  class_name: string;
  subject: string;
  assessment_type: string;
  exam_date: string | Date;
  start_time: string;
  duration: number;
  venue: string;
  invigilator_id?: string | null;
  invigilator_name?: string | null;
  max_score: number;
  status: string;
  created_by?: string | null;
  created_at?: string | Date;
  course?: { name: string };
  name?: string;
  semester?: string;
  date?: string | Date;
  maxScore?: number;
};

type ExamsListProps = {
  schoolId: string;
  schoolDomain?: string;
  exams?: any[];
  scheduledExams?: any[];
  courses?: any[];
  staff?: StaffOption[];
  tierName?: string;
};

export default function ExamsList({
  schoolId,
  schoolDomain: propSchoolDomain,
  exams = [],
  scheduledExams = [],
  courses = [],
  staff = [],
  tierName,
}: ExamsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenant = useTenant();
  const [isPending, startTransition] = useTransition();

  // Multi-tenant domain fallback
  const schoolDomain = propSchoolDomain || tenant.subdomain || (tenant as any)?.schoolDomain || "greenwood";

  // Tier category resolution
  const paramTier = searchParams.get("tier");
  const tenantActiveTier = (tenant as any)?.activeTier;
  const tenantPreciseTier = tenant.preciseTier;
  const tenantType = tenant.institutionType;

  const tierCategory: StaffTierCategory = useMemo(() => {
    return resolveStaffTierCategory(
      tierName || paramTier || tenantActiveTier || tenantPreciseTier || (tenantType === "HIGHER_ED" ? "TERTIARY" : "PRIMARY")
    );
  }, [tierName, paramTier, tenantActiveTier, tenantPreciseTier, tenantType]);

  // 1. Dynamic 'bonavee_classes' array state
  const bonavee_classes = useMemo<string[]>(() => {
    return BONAVEE_CLASSES_MAP[tierCategory] || BONAVEE_CLASSES_MAP.PRIMARY;
  }, [tierCategory]);

  // 2. Dynamic 'bonavee_subjects' array state
  const bonavee_subjects = useMemo<string[]>(() => {
    switch (tierCategory) {
      case "NURSERY":
        return [...NURSERY_SUBJECTS];
      case "PRIMARY":
        return [...PRIMARY_SUBJECTS];
      case "SECONDARY":
        return [...SECONDARY_SUBJECTS];
      case "TERTIARY":
        return [...HIGHER_ED_COURSES];
      default:
        return [...PRIMARY_SUBJECTS];
    }
  }, [tierCategory]);

  // Modal & Notification UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [deleteTargetExam, setDeleteTargetExam] = useState<ScheduledExamRecord | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Unify incoming records into local state for instant optimistic updates
  const initialNormalizedList: ScheduledExamRecord[] = useMemo(() => {
    const listMap = new Map<string, ScheduledExamRecord>();

    // Priority 1: Records directly from bonavee_scheduled_exams
    scheduledExams.forEach((se: any) => {
      listMap.set(se.id, {
        id: se.id,
        tenant_id: se.tenant_id,
        title: se.title || se.name,
        class_name: se.class_name || "General Class",
        subject: se.subject || se.course?.name || "General Subject",
        assessment_type: se.assessment_type || "EXAM",
        exam_date: se.exam_date || se.date,
        start_time: se.start_time || "09:00",
        duration: Number(se.duration) || 60,
        venue: se.venue || "Examination Hall A",
        invigilator_id: se.invigilator_id,
        invigilator_name: se.invigilator_name,
        max_score: Number(se.max_score || se.maxScore || 100),
        status: se.status || "published",
        created_by: se.created_by,
        created_at: se.created_at,
      });
    });

    // Priority 2: Complement with records from Prisma exams if not yet mapped
    exams.forEach((ex: any) => {
      if (!listMap.has(ex.id)) {
        listMap.set(ex.id, {
          id: ex.id,
          tenant_id: ex.schoolId,
          title: ex.name,
          class_name: ex.semester?.includes(" - ") ? ex.semester.split(" - ")[0] : "Primary 1",
          subject: ex.course?.name || "Mathematics",
          assessment_type: ex.name?.toUpperCase().includes("CA1")
            ? "CA1"
            : ex.name?.toUpperCase().includes("CA2")
            ? "CA2"
            : ex.name?.toUpperCase().includes("CA3")
            ? "CA3"
            : "EXAM",
          exam_date: ex.date,
          start_time: "09:00",
          duration: 60,
          venue: "Examination Hall A",
          invigilator_id: null,
          invigilator_name: null,
          max_score: Number(ex.maxScore || 100),
          status: "published",
          created_by: null,
          created_at: ex.createdAt,
        });
      }
    });

    return Array.from(listMap.values()).sort((a, b) => {
      const dateA = new Date(a.exam_date).getTime();
      const dateB = new Date(b.exam_date).getTime();
      return dateB - dateA;
    });
  }, [scheduledExams, exams]);

  const [examList, setExamList] = useState<ScheduledExamRecord[]>(initialNormalizedList);

  useEffect(() => {
    setExamList((prev) => {
      const localStatusMap = new Map(prev.map((e) => [e.id, e.status]));
      return initialNormalizedList.map((item) => {
        const localStatus = localStatusMap.get(item.id);
        return {
          ...item,
          status: localStatus !== undefined ? localStatus : item.status,
        };
      });
    });
  }, [initialNormalizedList]);

  // Form input states
  const defaultFormData = {
    title: "",
    className: bonavee_classes[0] || "Primary 1",
    subject: bonavee_subjects[0] || "Mathematics",
    assessmentType: "CA1" as AssessmentTypeEnum,
    examDate: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    duration: 60,
    venue: "Examination Hall A",
    invigilatorId: staff[0]?.id || "",
    maxScore: 20,
  };

  const [formData, setFormData] = useState(defaultFormData);

  // Auto-align class and subject selections with active tier
  useEffect(() => {
    if (!bonavee_classes.includes(formData.className) && bonavee_classes.length > 0) {
      setFormData((prev) => ({ ...prev, className: bonavee_classes[0] }));
    }
  }, [bonavee_classes, formData.className]);

  useEffect(() => {
    if (!bonavee_subjects.includes(formData.subject) && bonavee_subjects.length > 0) {
      setFormData((prev) => ({ ...prev, subject: bonavee_subjects[0] }));
    }
  }, [bonavee_subjects, formData.subject]);

  /**
   * SMART DYNAMIC LISTENER HOOK:
   * If Type is 'CA1' or 'CA2' -> default and lock the field to exactly 20.
   * If Type is 'EXAM' -> default and lock the field to exactly 60.
   * If Type is 'CA3' -> unlocked with flexible scoring.
   */
  useEffect(() => {
    if (formData.assessmentType === "CA1" || formData.assessmentType === "CA2") {
      setFormData((prev) => ({ ...prev, maxScore: 20 }));
    } else if (formData.assessmentType === "EXAM") {
      setFormData((prev) => ({ ...prev, maxScore: 60 }));
    }
  }, [formData.assessmentType]);

  const isMaxScoreLocked =
    formData.assessmentType === "CA1" ||
    formData.assessmentType === "CA2" ||
    formData.assessmentType === "EXAM";

  // Open modal in create mode
  const handleOpenCreateModal = () => {
    setEditingExamId(null);
    setFormData({
      title: "",
      className: bonavee_classes[0] || "Primary 1",
      subject: bonavee_subjects[0] || "Mathematics",
      assessmentType: "CA1",
      examDate: new Date().toISOString().split("T")[0],
      startTime: "09:00",
      duration: 60,
      venue: "Examination Hall A",
      invigilatorId: staff[0]?.id || "",
      maxScore: 20,
    });
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Open modal in edit mode
  const handleOpenEditModal = (exam: ScheduledExamRecord) => {
    setEditingExamId(exam.id);
    const dateFormatted = new Date(exam.exam_date).toISOString().split("T")[0];
    const examType = (
      ["CA1", "CA2", "CA3", "EXAM"].includes(exam.assessment_type)
        ? exam.assessment_type
        : "EXAM"
    ) as AssessmentTypeEnum;

    setFormData({
      title: exam.title,
      className: exam.class_name,
      subject: exam.subject,
      assessmentType: examType,
      examDate: dateFormatted,
      startTime: exam.start_time || "09:00",
      duration: exam.duration || 60,
      venue: exam.venue || "Examination Hall A",
      invigilatorId: exam.invigilator_id || "",
      maxScore: exam.max_score || (examType === "EXAM" ? 60 : 20),
    });
    setValidationError(null);
    setIsModalOpen(true);
  };

  /**
   * FORM SUBMISSION PIPELINE:
   * Executes secure multi-tenant mutation router transaction into 'bonavee_scheduled_exams'
   */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);

    const trimmedTitle = formData.title.trim();
    if (!trimmedTitle || trimmedTitle.length < 2) {
      setValidationError("Please enter a valid examination title (at least 2 characters).");
      return;
    }

    if (!formData.className) {
      setValidationError("Please select a target class from bonavee_classes.");
      return;
    }

    if (!formData.subject) {
      setValidationError("Please select an academic subject from bonavee_subjects.");
      return;
    }

    if (!formData.examDate) {
      setValidationError("Please choose an examination date.");
      return;
    }

    const payload: ScheduledExamPayload = {
      title: trimmedTitle,
      className: formData.className,
      subject: formData.subject,
      assessmentType: formData.assessmentType,
      examDate: formData.examDate,
      startTime: formData.startTime || "09:00",
      duration: Number(formData.duration) || 60,
      venue: formData.venue.trim() || "Main Examination Hall",
      invigilatorId: formData.invigilatorId || undefined,
      maxScore: Number(formData.maxScore),
    };

    startTransition(async () => {
      if (editingExamId) {
        // Update existing assessment
        const res = await updateScheduledExam(schoolId, schoolDomain, editingExamId, payload);
        if (res.success) {
          const invigilatorObj = staff.find((s) => s.id === payload.invigilatorId);
          setExamList((prev) =>
            prev.map((item) =>
              item.id === editingExamId
                ? {
                    ...item,
                    title: payload.title,
                    class_name: payload.className,
                    subject: payload.subject,
                    assessment_type: payload.assessmentType,
                    exam_date: payload.examDate,
                    start_time: payload.startTime,
                    duration: payload.duration,
                    venue: payload.venue,
                    invigilator_id: payload.invigilatorId || null,
                    invigilator_name: invigilatorObj
                      ? `${invigilatorObj.firstName} ${invigilatorObj.lastName}`
                      : item.invigilator_name,
                    max_score: payload.maxScore,
                  }
                : item
            )
          );
          setSuccessMessage(`Assessment "${payload.title}" updated successfully.`);
          setIsModalOpen(false);
          router.refresh();
        } else {
          setValidationError(res.error || "Failed to update assessment.");
        }
      } else {
        // Create new assessment
        const res = await createScheduledExam(schoolId, schoolDomain, payload);
        if (res.success && res.exam) {
          setExamList((prev) => [res.exam as ScheduledExamRecord, ...prev]);
          setSuccessMessage(
            `Assessment "${payload.title}" successfully scheduled for ${payload.className} (${payload.assessmentType}).`
          );
          setIsModalOpen(false);
          router.refresh();
        } else {
          setValidationError(res.error || "Failed to schedule assessment.");
        }
      }
    });
  };

  /**
   * CONTEXTUAL ACTION: PUBLISH / UNPUBLISH ACTION
   * Instantly synchronizes reactive local state with top notification banner
   */
  const handleTogglePublish = async (exam: ScheduledExamRecord) => {
    const isCurrentlyPublished = exam.status === "published";
    const nextStatus = isCurrentlyPublished ? "unpublished" : "published";

    // 1. Instant optimistic local update directly in examList
    setExamList((prev) =>
      prev.map((item) => (item.id === exam.id ? { ...item, status: nextStatus } : item))
    );

    // 2. Notification banner updates immediately in lockstep (zero latency / zero mismatch)
    setSuccessMessage(
      `Exam "${exam.title}" is now ${nextStatus === "published" ? "Published" : "Unpublished"}.`
    );
    setValidationError(null);

    startTransition(async () => {
      const res = await toggleExamPublishStatus(schoolId, schoolDomain, exam.id, exam.status);
      if (!res.success) {
        // Revert on failure
        setExamList((prev) =>
          prev.map((item) => (item.id === exam.id ? { ...item, status: exam.status } : item))
        );
        setSuccessMessage(null);
        setValidationError(res.error || "Failed to change publication status.");
      } else {
        router.refresh();
      }
    });
  };

  /**
   * CONTEXTUAL ACTION: DELETE CONFIRMATION ALERT GATE
   */
  const handleExecuteDelete = async () => {
    if (!deleteTargetExam) return;
    const targetId = deleteTargetExam.id;

    startTransition(async () => {
      const res = await deleteScheduledExam(schoolId, schoolDomain, targetId);
      if (res.success) {
        setExamList((prev) => prev.filter((item) => item.id !== targetId));
        setSuccessMessage(`Assessment "${deleteTargetExam.title}" deleted successfully.`);
        setDeleteTargetExam(null);
        router.refresh();
      } else {
        setValidationError(res.error || "Failed to delete exam.");
        setDeleteTargetExam(null);
      }
    });
  };

  // Helper badge color per assessment type
  const getTypeBadge = (type: string) => {
    switch (type) {
      case "CA1":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "CA2":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "CA3":
        return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800";
      case "EXAM":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card & Activation Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Scheduled Exams</h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {examList.length} {examList.length === 1 ? "Assessment" : "Assessments"}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage academic schedules, continuous assessment tests, and invigilation rosters.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-xl shadow-sm shadow-blue-500/20 transition-all cursor-pointer hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Exam</span>
        </button>
      </div>

      {/* Dismissible Success Notification Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-sm font-semibold shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 p-1 rounded-lg transition-colors cursor-pointer text-xs font-bold"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dismissible Validation Error Banner */}
      {validationError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between text-rose-800 dark:text-rose-300 text-sm font-semibold shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{validationError}</span>
          </div>
          <button
            onClick={() => setValidationError(null)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 p-1 rounded-lg transition-colors cursor-pointer text-xs font-bold"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. DATABASE DATA LISTING LAYER (Desktop Table vs Mobile Vertical Cards) */}
      {examList.length === 0 ? (
        /* Standard Default Empty State Card */
        <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-slate-500">
            <Calendar className="w-7 h-7" />
          </div>
          <h4 className="text-slate-800 dark:text-slate-200 font-bold text-lg">No exams scheduled yet</h4>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-sm mx-auto">
            Click &quot;Schedule Exam&quot; above to create your first assessment.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Assessment</span>
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP RESPONSIVE TABLE VIEW */}
          <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="py-3.5 px-4">
                      Title &amp; Type
                    </th>
                    <th scope="col" className="py-3.5 px-4">
                      Class &amp; Subject
                    </th>
                    <th scope="col" className="py-3.5 px-4">
                      Schedule
                    </th>
                    <th scope="col" className="py-3.5 px-4">
                      Venue &amp; Invigilator
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-center">
                      Max Score
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-center w-28 min-w-[7rem] max-w-[7rem] shrink-0">
                      Status
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-right w-40 min-w-[10rem] shrink-0">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {examList.map((exam) => (
                    <tr
                      key={exam.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Title & Type */}
                      <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-xs font-bold rounded-md border ${getTypeBadge(
                              exam.assessment_type
                            )}`}
                          >
                            {exam.assessment_type}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
                            {exam.title}
                          </span>
                        </div>
                      </td>

                      {/* Class & Subject */}
                      <td className="py-4 px-4">
                        <div className="text-slate-900 dark:text-white font-medium">
                          {exam.subject}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span>{exam.class_name}</span>
                        </div>
                      </td>

                      {/* Schedule: Date, Time & Duration */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {new Date(exam.exam_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {exam.start_time || "09:00"}
                          </span>
                          <span>&bull;</span>
                          <span>{exam.duration} mins</span>
                        </div>
                      </td>

                      {/* Venue & Invigilator */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 text-xs font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{exam.venue || "Exam Hall"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {exam.invigilator_name || "Unassigned"}
                          </span>
                        </div>
                      </td>

                      {/* Max Score */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          <Award className="w-3 h-3 text-blue-500" />
                          {exam.max_score} pts
                        </span>
                      </td>

                      {/* Administrative Status Badge Column */}
                      <td className="py-4 px-4 text-center w-28 min-w-[7rem] max-w-[7rem] shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(exam)}
                          disabled={isPending}
                          title={`Click to ${exam.status === "published" ? "unpublish" : "publish"} assessment`}
                          aria-label={`Current status: ${exam.status === "published" ? "Published" : "Unpublished"}. Click to toggle.`}
                          className={`inline-flex items-center justify-center w-[100px] h-7 px-2.5 py-1 text-xs font-semibold rounded-full border transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 hover:shadow-xs active:scale-95 ${
                            exam.status === "published"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/60"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 transition-colors ${
                              exam.status === "published" ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <span className="truncate">
                            {exam.status === "published" ? "Published" : "Unpublished"}
                          </span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right w-40 min-w-[10rem] shrink-0">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Publish / Unpublish Icon Action Button */}
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(exam)}
                            disabled={isPending}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              exam.status === "published"
                                ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            }`}
                            title={exam.status === "published" ? "Unpublish Assessment" : "Publish Assessment"}
                            aria-label={exam.status === "published" ? "Unpublish Assessment" : "Publish Assessment"}
                          >
                            {exam.status === "published" ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>

                          {/* View Grading Roster Link */}
                          <Link
                            href={`/${schoolDomain}/exams/${exam.id}/roster`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                            title="View Grading Roster"
                          >
                            <span>Roster</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEditModal(exam)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit Assessment"
                            aria-label="Edit Assessment"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Gate Button */}
                          <button
                            onClick={() => setDeleteTargetExam(exam)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete Assessment"
                            aria-label="Delete Assessment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE VIEWPORT SCREENS: VERTICAL CARD PANELS */}
          <div className="md:hidden space-y-4">
            {examList.map((exam) => (
              <div
                key={exam.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                {/* Header: Title, Type Badge & Publish Toggle */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded-md border ${getTypeBadge(
                          exam.assessment_type
                        )}`}
                      >
                        {exam.assessment_type}
                      </span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-base">
                        {exam.title}
                      </h4>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                      <span>{exam.subject}</span>
                      <span>&bull;</span>
                      <span>{exam.class_name}</span>
                    </div>
                  </div>

                  {/* Mobile Status Badge */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(exam)}
                      disabled={isPending}
                      title={`Click to ${exam.status === "published" ? "unpublish" : "publish"} assessment`}
                      aria-label={`Current status: ${exam.status === "published" ? "Published" : "Unpublished"}. Click to toggle.`}
                      className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-semibold rounded-full border transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${
                        exam.status === "published"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 transition-colors ${
                          exam.status === "published" ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                      <span>{exam.status === "published" ? "Published" : "Unpublished"}</span>
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 border-y border-slate-100 dark:border-slate-800/80 py-3">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {new Date(exam.exam_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {exam.start_time || "09:00"} ({exam.duration}m)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{exam.venue || "Exam Hall"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>Max: {exam.max_score} pts</span>
                  </div>
                </div>

                {/* Mobile Actions Footer */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Link
                    href={`/${schoolDomain}/exams/${exam.id}/roster`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <span>View Grading Roster</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(exam)}
                      className="p-1.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTargetExam(exam)}
                      className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-lg hover:bg-rose-100 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 1. MODAL COMPONENT ENTRY FORM GATEWAY (Clean Dialog/Modal Wrapper) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>{editingExamId ? "Edit Scheduled Assessment" : "Schedule New Assessment"}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure dynamic curriculum parameters, exam seating, and continuous assessment weights.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {/* Title Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Assessment Title <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. First Term Mathematics Examination or CA1 Test"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Class & Subject Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Class Selection Dropdown ('bonavee_classes' array state) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Class Selection <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  >
                    {bonavee_classes.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject Selection Dropdown ('bonavee_subjects' array state) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Subject Selection <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  >
                    {bonavee_subjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assessment Type & Max Score with Smart Dynamic Hook */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Assessment Type ENUM Mappings */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Assessment Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.assessmentType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        assessmentType: e.target.value as AssessmentTypeEnum,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  >
                    {ASSESSMENT_TYPES.map((typeOption) => (
                      <option key={typeOption.value} value={typeOption.value}>
                        {typeOption.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Max Score with Smart Locking Hook */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Max Score
                    </label>
                    {isMaxScoreLocked && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                        <Lock className="w-3 h-3" />
                        <span>Locked for {formData.assessmentType}</span>
                      </span>
                    )}
                  </div>
                  <input
                    required
                    type="number"
                    min="1"
                    max="1000"
                    readOnly={isMaxScoreLocked}
                    value={formData.maxScore}
                    onChange={(e) =>
                      !isMaxScoreLocked &&
                      setFormData({ ...formData, maxScore: Number(e.target.value) })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none transition-colors ${
                      isMaxScoreLocked
                        ? "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    }`}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {formData.assessmentType === "CA1" || formData.assessmentType === "CA2"
                      ? "Standardized Nigerian CA component capped at 20 marks."
                      : formData.assessmentType === "EXAM"
                      ? "Standardized Nigerian terminal examination capped at 60 marks."
                      : "Custom assessment score allocation."}
                  </p>
                </div>
              </div>

              {/* Exam Date & Start Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Exam Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={formData.examDate}
                    onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Start Time
                  </label>
                  <input
                    required
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Duration & Venue */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Duration (Minutes)
                  </label>
                  <input
                    required
                    type="number"
                    min="15"
                    max="360"
                    step="5"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Venue
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Examination Hall A, Science Lab"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Invigilator ID Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Invigilator Assignment
                </label>
                <select
                  value={formData.invigilatorId}
                  onChange={(e) => setFormData({ ...formData, invigilatorId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                >
                  <option value="">-- Assign Invigilator (Optional) --</option>
                  {staff.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.firstName} {st.lastName} ({st.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isPending}
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md transition cursor-pointer"
                >
                  {isPending
                    ? editingExamId
                      ? "Saving Changes..."
                      : "Scheduling..."
                    : editingExamId
                    ? "Update Assessment"
                    : "Confirm & Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION ALERT GATE MODAL */}
      {deleteTargetExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base">
                  Delete Scheduled Exam?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  This action will remove the assessment from the timetable and bonavee database.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {deleteTargetExam.title}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {deleteTargetExam.subject} &bull; {deleteTargetExam.class_name} (
                {deleteTargetExam.assessment_type})
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetExam(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isPending}
                onClick={handleExecuteDelete}
                className="px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
