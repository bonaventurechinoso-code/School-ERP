"use client";

import React, { useState, useTransition, useMemo, useEffect, useCallback } from "react";
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
  Copy,
  ListPlus,
  Check,
  Grid,
  FileSpreadsheet,
  Filter,
  CheckSquare,
  Square,
  RefreshCw,
} from "lucide-react";
import {
  createScheduledExam,
  createBulkScheduledExams,
  updateScheduledExam,
  toggleExamPublishStatus,
  deleteScheduledExam,
  ScheduledExamPayload,
} from "./actions";

// Canonical Nigerian Educational Classes by Tier
export const BONAVEE_CLASSES_MAP: Record<string, string[]> = {
  NURSERY: [
    "Creche",
    "Creche / Nursery",
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

// Authentic Nigerian Educational Subjects & Curriculum by Class & Tier
import {
  NURSERY_SUBJECTS,
  PRIMARY_SUBJECTS,
  JSS_SUBJECTS,
  SSS_SUBJECTS,
  SECONDARY_SUBJECTS,
  HIGHER_ED_COURSES,
  getEducationalStageForClass,
  getSubjectsForClassAndTier,
} from "@/lib/curriculum-data";

export {
  NURSERY_SUBJECTS,
  PRIMARY_SUBJECTS,
  JSS_SUBJECTS,
  SSS_SUBJECTS,
  SECONDARY_SUBJECTS,
  HIGHER_ED_COURSES,
  getEducationalStageForClass,
  getSubjectsForClassAndTier,
};

export const ASSESSMENT_TYPES = [
  { value: "CA1", label: "CA1 (Continuous Assessment 1)", defaultMax: 20, locked: true },
  { value: "CA2", label: "CA2 (Continuous Assessment 2)", defaultMax: 20, locked: true },
  { value: "CA3", label: "CA3 (Continuous Assessment 3)", defaultMax: 20, locked: false },
  { value: "EXAM", label: "EXAM (Terminal Examination)", defaultMax: 60, locked: true },
] as const;

type AssessmentTypeEnum = "CA1" | "CA2" | "CA3" | "EXAM";

export type BulkExamRow = {
  id: string;
  className: string;
  subject: string;
  assessmentType: AssessmentTypeEnum;
  title: string;
  examDate: string;
  startTime: string;
  duration: number;
  venue: string;
  invigilatorId: string;
  maxScore: number;
};

export function generateExamTitle(
  subject: string,
  className: string,
  assessmentType: string,
  term = "1st Term"
): string {
  const cleanSub = (subject || "").trim();
  const cleanClass = (className || "").trim();
  if (assessmentType === "EXAM") {
    return `${term} ${cleanSub} Examination`;
  }
  return `${term} ${cleanSub} (${cleanClass} - ${assessmentType})`;
}

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
  classrooms?: any[];
  tierName?: string;
};

export default function ExamsList({
  schoolId,
  schoolDomain: propSchoolDomain,
  exams = [],
  scheduledExams = [],
  courses = [],
  staff = [],
  classrooms = [],
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

  // 1. Dynamic 'bonavee_classes' array state combining standard classes & school classrooms
  const bonavee_classes = useMemo<string[]>(() => {
    const standard = BONAVEE_CLASSES_MAP[tierCategory] || BONAVEE_CLASSES_MAP.PRIMARY;
    const classSet = new Set<string>(standard);
    if (Array.isArray(classrooms) && classrooms.length > 0) {
      classrooms.forEach((c) => {
        const cName = typeof c === "string" ? c : c?.name;
        if (cName && typeof cName === "string" && cName.trim()) {
          classSet.add(cName.trim());
        }
      });
    }
    return Array.from(classSet);
  }, [tierCategory, classrooms]);

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
  const initialClass = bonavee_classes[0] || (tierCategory === "SECONDARY" ? "JSS 1" : "Primary 1");
  const initialSubjects = getSubjectsForClassAndTier(initialClass, tierCategory);

  const defaultFormData = {
    title: "",
    className: initialClass,
    subject: initialSubjects[0] || "Mathematics",
    assessmentType: "CA1" as AssessmentTypeEnum,
    examDate: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    duration: 60,
    venue: "Examination Hall A",
    invigilatorId: staff[0]?.id || "",
    maxScore: 20,
  };

  const [formData, setFormData] = useState(defaultFormData);

  // 2. Dynamic 'bonavee_subjects' array state strictly filtered by selected class and tier
  const bonavee_subjects = useMemo<string[]>(() => {
    return getSubjectsForClassAndTier(formData.className, tierCategory);
  }, [formData.className, tierCategory]);

  // Auto-align class and subject selections with active tier
  useEffect(() => {
    if (!bonavee_classes.includes(formData.className) && bonavee_classes.length > 0) {
      const fallbackClass = bonavee_classes[0] || "Primary 1";
      const fallbackSubjects = getSubjectsForClassAndTier(fallbackClass, tierCategory);
      setFormData((prev) => ({
        ...prev,
        className: fallbackClass,
        subject: fallbackSubjects[0] || "",
      }));
    }
  }, [bonavee_classes, formData.className, tierCategory]);

  useEffect(() => {
    if (!bonavee_subjects.includes(formData.subject) && bonavee_subjects.length > 0) {
      setFormData((prev) => ({ ...prev, subject: bonavee_subjects[0] || "" }));
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

  // --- BULK EXAM SCHEDULING SYSTEM (Global for all schools) ---
  const [modalMode, setModalMode] = useState<"single" | "bulk">("single");
  const [bulkRows, setBulkRows] = useState<BulkExamRow[]>([]);
  const [bulkTargetClass, setBulkTargetClass] = useState<string>(bonavee_classes[0] || "JSS 1");
  const [bulkApplyValues, setBulkApplyValues] = useState<{
    examDate: string;
    startTime: string;
    duration: number;
    assessmentType: AssessmentTypeEnum;
    venue: string;
    invigilatorId: string;
    termPrefix: string;
  }>({
    examDate: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    duration: 60,
    assessmentType: "CA1",
    venue: "Main Examination Hall",
    invigilatorId: staff[0]?.id || "",
    termPrefix: "1st Term",
  });

  // Multi-Class Matrix Generator State
  const [showMatrixGenerator, setShowMatrixGenerator] = useState(false);
  const [matrixSelectedClasses, setMatrixSelectedClasses] = useState<string[]>([]);
  const [matrixSelectedSubjects, setMatrixSelectedSubjects] = useState<string[]>([]);

  // Create single empty bulk row
  const createEmptyBulkRow = useCallback((defaultClass?: string): BulkExamRow => {
    const targetClass = defaultClass || bulkTargetClass || bonavee_classes[0] || (tierCategory === "SECONDARY" ? "JSS 1" : "Primary 1");
    const validSubs = getSubjectsForClassAndTier(targetClass, tierCategory);
    const sub = validSubs[0] || "Mathematics";
    return {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      className: targetClass,
      subject: sub,
      assessmentType: bulkApplyValues.assessmentType || "CA1",
      title: generateExamTitle(sub, targetClass, bulkApplyValues.assessmentType || "CA1", bulkApplyValues.termPrefix),
      examDate: bulkApplyValues.examDate || new Date().toISOString().split("T")[0],
      startTime: bulkApplyValues.startTime || "09:00",
      duration: bulkApplyValues.duration || 60,
      venue: bulkApplyValues.venue || "Main Examination Hall",
      invigilatorId: bulkApplyValues.invigilatorId || (staff[0]?.id || ""),
      maxScore: bulkApplyValues.assessmentType === "EXAM" ? 60 : 20,
    };
  }, [bulkTargetClass, bonavee_classes, tierCategory, bulkApplyValues, staff]);

  // Bulk duplicate detector
  const bulkDuplicates = useMemo(() => {
    const seen = new Map<string, number>();
    bulkRows.forEach((r) => {
      const key = `${r.className.toLowerCase().trim()}__${r.subject.toLowerCase().trim()}__${r.assessmentType}__${r.examDate}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    });
    const dupKeys = new Set<string>();
    seen.forEach((count, key) => {
      if (count > 1) dupKeys.add(key);
    });
    return dupKeys;
  }, [bulkRows]);

  // Available subjects for matrix generator based on selected classes
  const matrixAvailableSubjects = useMemo(() => {
    if (matrixSelectedClasses.length === 0) return [];
    const set = new Set<string>();
    matrixSelectedClasses.forEach((cls) => {
      const subs = getSubjectsForClassAndTier(cls, tierCategory);
      subs.forEach((s: string) => set.add(s));
    });
    return Array.from(set);
  }, [matrixSelectedClasses, tierCategory]);

  // Bulk Row Actions
  const handleAddBulkRow = () => {
    setBulkRows((prev) => [...prev, createEmptyBulkRow()]);
  };

  const handleDuplicateBulkRow = (index: number) => {
    setBulkRows((prev) => {
      const target = prev[index];
      if (!target) return prev;
      const copy: BulkExamRow = {
        ...target,
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const handleDeleteBulkRow = (index: number) => {
    setBulkRows((prev) => {
      if (prev.length <= 1) {
        return [createEmptyBulkRow()];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleBulkRowFieldChange = <K extends keyof BulkExamRow>(
    index: number,
    field: K,
    value: BulkExamRow[K]
  ) => {
    setBulkRows((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      (row as any)[field] = value;

      // If class changes, ensure subject is valid for the new class
      if (field === "className") {
        const validSubs = getSubjectsForClassAndTier(value as string, tierCategory);
        if (!validSubs.includes(row.subject)) {
          row.subject = validSubs[0] || "Mathematics";
        }
        row.title = generateExamTitle(row.subject, row.className, row.assessmentType, bulkApplyValues.termPrefix);
      }

      // If subject changes, update title
      if (field === "subject") {
        row.title = generateExamTitle(value as string, row.className, row.assessmentType, bulkApplyValues.termPrefix);
      }

      // If assessment type changes, update title & maxScore
      if (field === "assessmentType") {
        const newType = value as AssessmentTypeEnum;
        row.maxScore = newType === "EXAM" ? 60 : 20;
        row.title = generateExamTitle(row.subject, row.className, newType, bulkApplyValues.termPrefix);
      }

      next[index] = row;
      return next;
    });
  };

  // Shortcut 1: Add all subjects for class
  const handleAddAllSubjectsForClass = (targetClassOverride?: string) => {
    const targetClass = targetClassOverride || bulkTargetClass || bonavee_classes[0] || "JSS 1";
    const subjects = getSubjectsForClassAndTier(targetClass, tierCategory);
    const newRows: BulkExamRow[] = subjects.map((sub: string, idx: number) => ({
      id: `bulk-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      className: targetClass,
      subject: sub,
      assessmentType: bulkApplyValues.assessmentType || "CA1",
      title: generateExamTitle(sub, targetClass, bulkApplyValues.assessmentType || "CA1", bulkApplyValues.termPrefix),
      examDate: bulkApplyValues.examDate || new Date().toISOString().split("T")[0],
      startTime: bulkApplyValues.startTime || "09:00",
      duration: bulkApplyValues.duration || 60,
      venue: bulkApplyValues.venue || "Main Examination Hall",
      invigilatorId: bulkApplyValues.invigilatorId || (staff[0]?.id || ""),
      maxScore: bulkApplyValues.assessmentType === "EXAM" ? 60 : 20,
    }));

    setBulkRows((prev) => {
      if (prev.length <= 1 && prev[0]?.subject === "Mathematics" && prev[0]?.title.includes("Mathematics")) {
        return newRows;
      }
      return [...prev, ...newRows];
    });
  };

  // Shortcut 2: Apply defaults to all rows
  const handleApplyToAllRows = () => {
    setBulkRows((prev) =>
      prev.map((r) => ({
        ...r,
        examDate: bulkApplyValues.examDate,
        startTime: bulkApplyValues.startTime,
        duration: bulkApplyValues.duration,
        assessmentType: bulkApplyValues.assessmentType,
        maxScore: bulkApplyValues.assessmentType === "EXAM" ? 60 : 20,
        venue: bulkApplyValues.venue,
        invigilatorId: bulkApplyValues.invigilatorId,
        title: generateExamTitle(r.subject, r.className, bulkApplyValues.assessmentType, bulkApplyValues.termPrefix),
      }))
    );
  };

  // Shortcut 3: Generate Multi-Class Matrix
  const handleGenerateMatrixExams = () => {
    if (matrixSelectedClasses.length === 0 || matrixSelectedSubjects.length === 0) return;
    const generated: BulkExamRow[] = [];
    matrixSelectedClasses.forEach((cls) => {
      const validSubsForClass = getSubjectsForClassAndTier(cls, tierCategory);
      matrixSelectedSubjects.forEach((sub) => {
        if (validSubsForClass.includes(sub)) {
          generated.push({
            id: `matrix-${Date.now()}-${cls}-${sub}-${Math.random().toString(36).substring(2, 6)}`,
            className: cls,
            subject: sub,
            assessmentType: bulkApplyValues.assessmentType,
            title: generateExamTitle(sub, cls, bulkApplyValues.assessmentType, bulkApplyValues.termPrefix),
            examDate: bulkApplyValues.examDate,
            startTime: bulkApplyValues.startTime,
            duration: bulkApplyValues.duration,
            venue: bulkApplyValues.venue,
            invigilatorId: bulkApplyValues.invigilatorId,
            maxScore: bulkApplyValues.assessmentType === "EXAM" ? 60 : 20,
          });
        }
      });
    });

    if (generated.length > 0) {
      setBulkRows((prev) => {
        if (prev.length <= 1 && prev[0]?.subject === "Mathematics" && prev[0]?.title.includes("Mathematics")) {
          return generated;
        }
        return [...prev, ...generated];
      });
    }
    setShowMatrixGenerator(false);
  };

  // Bulk Submit Handler
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);

    if (bulkRows.length === 0) {
      setValidationError("Please add at least one exam row to schedule.");
      return;
    }

    for (let i = 0; i < bulkRows.length; i++) {
      const r = bulkRows[i];
      if (!r.title.trim()) {
        setValidationError(`Row #${i + 1} (${r.className} - ${r.subject}) has an empty title.`);
        return;
      }
      if (!r.className) {
        setValidationError(`Row #${i + 1} has no class selected.`);
        return;
      }
      if (!r.subject) {
        setValidationError(`Row #${i + 1} has no subject selected.`);
        return;
      }
      if (!r.examDate) {
        setValidationError(`Row #${i + 1} (${r.title}) has no exam date.`);
        return;
      }
    }

    if (bulkDuplicates.size > 0) {
      setValidationError("Duplicate assessments detected. Same Class + Subject + Type + Date cannot be scheduled multiple times.");
      return;
    }

    const payload: ScheduledExamPayload[] = bulkRows.map((r) => ({
      title: r.title.trim(),
      className: r.className,
      subject: r.subject,
      assessmentType: r.assessmentType,
      examDate: r.examDate,
      startTime: r.startTime || "09:00",
      duration: Number(r.duration) || 60,
      venue: r.venue?.trim() || "Main Examination Hall",
      invigilatorId: r.invigilatorId || undefined,
      maxScore: Number(r.maxScore) || (r.assessmentType === "EXAM" ? 60 : 20),
    }));

    startTransition(async () => {
      const res = await createBulkScheduledExams(schoolId, schoolDomain, payload);
      if (res.success && res.exams) {
        setExamList((prev) => [...res.exams, ...prev]);
        setSuccessMessage(`Successfully scheduled ${res.count} exams!`);
        setIsModalOpen(false);
        router.refresh();
      } else {
        setValidationError(res.error || "Failed to schedule bulk exams.");
      }
    });
  };

  // Open modal in create mode
  const handleOpenCreateModal = () => {
    const targetClass = bonavee_classes[0] || (tierCategory === "SECONDARY" ? "JSS 1" : "Primary 1");
    const targetSubjects = getSubjectsForClassAndTier(targetClass, tierCategory);
    setEditingExamId(null);
    setFormData({
      title: "",
      className: targetClass,
      subject: targetSubjects[0] || "Mathematics",
      assessmentType: "CA1",
      examDate: new Date().toISOString().split("T")[0],
      startTime: "09:00",
      duration: 60,
      venue: "Examination Hall A",
      invigilatorId: staff[0]?.id || "",
      maxScore: 20,
    });
    setBulkTargetClass(targetClass);
    if (bulkRows.length === 0) {
      setBulkRows([
        {
          id: `row-${Date.now()}-1`,
          className: targetClass,
          subject: targetSubjects[0] || "Mathematics",
          assessmentType: "CA1",
          title: generateExamTitle(targetSubjects[0] || "Mathematics", targetClass, "CA1"),
          examDate: new Date().toISOString().split("T")[0],
          startTime: "09:00",
          duration: 60,
          venue: "Main Examination Hall",
          invigilatorId: staff[0]?.id || "",
          maxScore: 20,
        },
      ]);
    }
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Open modal in edit mode
  const handleOpenEditModal = (exam: ScheduledExamRecord) => {
    setModalMode("single");
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
                className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 overflow-hidden"
              >
                {/* Header: Title, Type Badge & Publish Toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold rounded-md border shrink-0 ${getTypeBadge(
                          exam.assessment_type
                        )}`}
                      >
                        {exam.assessment_type}
                      </span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base break-words">
                        {exam.title}
                      </h4>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 font-medium truncate">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{exam.subject}</span>
                      <span className="shrink-0">&bull;</span>
                      <span className="shrink-0">{exam.class_name}</span>
                    </div>
                  </div>

                  {/* Mobile Status Badge */}
                  <div className="shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(exam)}
                      disabled={isPending}
                      title={`Click to ${exam.status === "published" ? "unpublish" : "publish"} assessment`}
                      aria-label={`Current status: ${exam.status === "published" ? "Published" : "Unpublished"}. Click to toggle.`}
                      className={`inline-flex items-center justify-center px-2 py-1 text-[11px] font-semibold rounded-full border transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${
                        exam.status === "published"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1 shrink-0 transition-colors ${
                          exam.status === "published" ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                      <span>{exam.status === "published" ? "Published" : "Draft"}</span>
                    </button>
                  </div>
                </div>

                {/* Responsive Card Metrics Tiles (Protected against text collision/overwriting) */}
                <div className="grid grid-cols-2 gap-2 py-3 border-y border-slate-100 dark:border-slate-800/80 text-xs">
                  {/* Metric 1: Date */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 min-w-0 overflow-hidden">
                    <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider leading-none">Date</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block mt-0.5">
                        {new Date(exam.exam_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Metric 2: Time & Duration */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 min-w-0 overflow-hidden">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider leading-none">Time</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block mt-0.5">
                        {exam.start_time || "09:00"} ({exam.duration}m)
                      </span>
                    </div>
                  </div>

                  {/* Metric 3: Venue */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 min-w-0 overflow-hidden">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider leading-none">Venue</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block mt-0.5" title={exam.venue}>
                        {exam.venue || "Exam Hall"}
                      </span>
                    </div>
                  </div>

                  {/* Metric 4: Max Score */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 min-w-0 overflow-hidden">
                    <Award className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider leading-none">Score</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block mt-0.5">
                        Max {exam.max_score} pts
                      </span>
                    </div>
                  </div>

                  {/* Metric 5: Invigilator */}
                  <div className="col-span-2 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 min-w-0 overflow-hidden">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Invigilator: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{exam.invigilator_name || "Unassigned"}</strong>
                    </span>
                  </div>
                </div>

                {/* Mobile Actions Footer */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Link
                    href={`/${schoolDomain}/exams/${exam.id}/roster`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 rounded-lg hover:bg-blue-100 transition-colors truncate"
                  >
                    <span className="truncate">Grading Roster</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  </Link>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleOpenEditModal(exam)}
                      className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Edit Assessment"
                      aria-label="Edit assessment"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTargetExam(exam)}
                      className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                      title="Delete Assessment"
                      aria-label="Delete assessment"
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

      {/* 1. MODAL COMPONENT ENTRY FORM GATEWAY (Clean Dialog/Modal Wrapper with Single & Bulk Modes) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full ${
              modalMode === "bulk" && !editingExamId
                ? "max-w-7xl max-h-[94vh]"
                : "max-w-2xl max-h-[90vh]"
            } overflow-hidden flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>
                    {editingExamId
                      ? "Edit Scheduled Assessment"
                      : modalMode === "bulk"
                      ? "Bulk / Multiple Exam Scheduling"
                      : "Schedule New Assessment"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {modalMode === "bulk" && !editingExamId
                    ? "Schedule exams across all subjects and classes at once with automatic curriculum filtering."
                    : "Configure dynamic curriculum parameters, exam seating, and continuous assessment weights."}
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

            {/* Validation Error Banner */}
            {validationError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Mode Switcher Toggle (Visible when scheduling new exams) */}
            {!editingExamId && (
              <div className="px-5 sm:px-6 pt-4 shrink-0">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-sm">
                  <button
                    type="button"
                    onClick={() => setModalMode("single")}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      modalMode === "single"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Single Exam Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode("bulk");
                      if (bulkRows.length === 0) {
                        handleAddAllSubjectsForClass();
                      }
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      modalMode === "bulk"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Bulk / Multiple Exams</span>
                  </button>
                </div>
              </div>
            )}

            {/* Body */}
            {modalMode === "single" || editingExamId ? (
              /* SINGLE EXAM FORM */
              <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto">
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
                  {/* Class Selection Dropdown */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Class Selection <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.className}
                      onChange={(e) => {
                        const newClass = e.target.value;
                        const subjectsForClass = getSubjectsForClassAndTier(newClass, tierCategory);
                        setFormData((prev) => ({
                          ...prev,
                          className: newClass,
                          subject: subjectsForClass.includes(prev.subject) ? prev.subject : (subjectsForClass[0] || ""),
                        }));
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    >
                      {bonavee_classes.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject Selection Dropdown */}
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

                {/* Assessment Type & Max Score */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            ) : (
              /* BULK / MULTIPLE EXAMS FORM */
              <form onSubmit={handleBulkSubmit} className="p-5 sm:p-6 flex-1 flex flex-col overflow-hidden space-y-4">
                {/* Top Shortcuts Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                  {/* Left: Quick Class Load */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Quick Populate:</span>
                    <select
                      value={bulkTargetClass}
                      onChange={(e) => setBulkTargetClass(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      {bonavee_classes.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAddAllSubjectsForClass()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                      title={`Add all subjects for ${bulkTargetClass}`}
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      <span>+ Add All Subjects for {bulkTargetClass}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMatrixGenerator(!showMatrixGenerator)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>Multi-Class Matrix...</span>
                    </button>
                  </div>

                  {/* Right: Row Operations */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddBulkRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkRows([createEmptyBulkRow()])}
                      className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold transition cursor-pointer"
                      title="Reset table"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Multi-Class Matrix Helper (Collapsible) */}
                {showMatrixGenerator && (
                  <div className="p-4 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-xl space-y-3 animate-in fade-in duration-150 shrink-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                        <Grid className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>Multi-Class × Subjects Matrix Generator</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowMatrixGenerator(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-purple-800 dark:text-purple-300">
                      Select target classes and shared subjects to schedule at once (e.g. 3 classes × 2 subjects = 6 exam rows).
                    </p>

                    {/* Class Selection Badges */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Target Classes:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {bonavee_classes.map((cls) => {
                          const isSelected = matrixSelectedClasses.includes(cls);
                          return (
                            <button
                              key={cls}
                              type="button"
                              onClick={() => {
                                setMatrixSelectedClasses((prev) =>
                                  isSelected ? prev.filter((c) => c !== cls) : [...prev, cls]
                                );
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                isSelected
                                  ? "bg-purple-600 text-white border-purple-600"
                                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-purple-400"
                              }`}
                            >
                              {isSelected ? "✓ " : "+ "} {cls}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Subject Selection Badges (Filtered by Selected Classes) */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Subjects to Schedule:
                      </label>
                      {matrixAvailableSubjects.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">Select at least one class above to view available subjects.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                          {matrixAvailableSubjects.map((sub) => {
                            const isSelected = matrixSelectedSubjects.includes(sub);
                            return (
                              <button
                                key={sub}
                                type="button"
                                onClick={() => {
                                  setMatrixSelectedSubjects((prev) =>
                                    isSelected ? prev.filter((s) => s !== sub) : [...prev, sub]
                                  );
                                }}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition cursor-pointer ${
                                  isSelected
                                    ? "bg-purple-100 text-purple-900 border-purple-400 dark:bg-purple-900/60 dark:text-purple-200 font-bold"
                                    : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                }`}
                              >
                                {isSelected ? "✓ " : ""} {sub}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Generator Action */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMatrixSelectedSubjects(matrixAvailableSubjects)}
                          className="text-xs text-purple-700 dark:text-purple-300 underline font-semibold cursor-pointer"
                        >
                          Select All Subjects
                        </button>
                        <span>&bull;</span>
                        <button
                          type="button"
                          onClick={() => setMatrixSelectedSubjects([])}
                          className="text-xs text-slate-500 underline cursor-pointer"
                        >
                          Clear Subjects
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={matrixSelectedClasses.length === 0 || matrixSelectedSubjects.length === 0}
                        onClick={handleGenerateMatrixExams}
                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        Generate Matrix ({matrixSelectedClasses.length} Classes × {matrixSelectedSubjects.length} Subjects = {matrixSelectedClasses.length * matrixSelectedSubjects.length} Exams)
                      </button>
                    </div>
                  </div>
                )}

                {/* Apply To All Rows Toolbar */}
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-100/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs shrink-0">
                  <span className="font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] shrink-0">
                    Quick Set All Rows:
                  </span>
                  <input
                    type="date"
                    value={bulkApplyValues.examDate}
                    onChange={(e) => setBulkApplyValues({ ...bulkApplyValues, examDate: e.target.value })}
                    className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                    title="Shared Date"
                  />
                  <input
                    type="time"
                    value={bulkApplyValues.startTime}
                    onChange={(e) => setBulkApplyValues({ ...bulkApplyValues, startTime: e.target.value })}
                    className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                    title="Shared Start Time"
                  />
                  <select
                    value={bulkApplyValues.assessmentType}
                    onChange={(e) => setBulkApplyValues({ ...bulkApplyValues, assessmentType: e.target.value as AssessmentTypeEnum })}
                    className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                    title="Shared Assessment Type"
                  >
                    {ASSESSMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.value}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="15"
                      max="360"
                      step="5"
                      value={bulkApplyValues.duration}
                      onChange={(e) => setBulkApplyValues({ ...bulkApplyValues, duration: Number(e.target.value) })}
                      className="w-16 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                      title="Shared Duration in minutes"
                    />
                    <span className="text-[11px] text-slate-400">min</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Shared Venue (e.g. Hall A)"
                    value={bulkApplyValues.venue}
                    onChange={(e) => setBulkApplyValues({ ...bulkApplyValues, venue: e.target.value })}
                    className="w-36 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                    title="Shared Venue"
                  />
                  <select
                    value={bulkApplyValues.invigilatorId}
                    onChange={(e) => setBulkApplyValues({ ...bulkApplyValues, invigilatorId: e.target.value })}
                    className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white max-w-[150px] truncate focus:outline-none"
                    title="Shared Invigilator"
                  >
                    <option value="">No Invigilator</option>
                    {staff.map((st) => (
                      <option key={st.id} value={st.id}>{st.firstName} {st.lastName}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleApplyToAllRows}
                    className="w-full sm:w-auto sm:ml-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer shrink-0 mt-1 sm:mt-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Apply to All Rows</span>
                  </button>
                </div>

                {/* Bulk Rows Table */}
                <div className="overflow-x-auto overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl flex-1 max-h-[420px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-extrabold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                      <tr>
                        <th className="py-2.5 px-2.5 w-8 text-center">#</th>
                        <th className="py-2.5 px-2.5 min-w-[110px]">Class</th>
                        <th className="py-2.5 px-2.5 min-w-[150px]">Subject (Filtered)</th>
                        <th className="py-2.5 px-2.5 min-w-[85px]">Type</th>
                        <th className="py-2.5 px-2.5 min-w-[170px]">Assessment Title</th>
                        <th className="py-2.5 px-2.5 min-w-[125px]">Exam Date</th>
                        <th className="py-2.5 px-2.5 min-w-[105px]">Time</th>
                        <th className="py-2.5 px-2.5 min-w-[85px]">Duration</th>
                        <th className="py-2.5 px-2.5 min-w-[130px]">Venue</th>
                        <th className="py-2.5 px-2.5 min-w-[130px]">Invigilator</th>
                        <th className="py-2.5 px-2.5 w-16 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                      {bulkRows.map((row, idx) => {
                        const subjectsForClass = getSubjectsForClassAndTier(row.className, tierCategory);
                        const rowKey = `${row.className.toLowerCase().trim()}__${row.subject.toLowerCase().trim()}__${row.assessmentType}__${row.examDate}`;
                        const isDuplicate = bulkDuplicates.has(rowKey);

                        return (
                          <tr
                            key={row.id}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                              isDuplicate ? "bg-amber-50/60 dark:bg-amber-950/20" : ""
                            }`}
                          >
                            {/* Row Number */}
                            <td className="py-2 px-2.5 text-center font-bold text-slate-400">
                              {idx + 1}
                            </td>

                            {/* Class Dropdown */}
                            <td className="py-2 px-2.5">
                              <select
                                value={row.className}
                                onChange={(e) => handleBulkRowFieldChange(idx, "className", e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-xs focus:ring-1 focus:ring-blue-500"
                              >
                                {bonavee_classes.map((cls) => (
                                  <option key={cls} value={cls}>{cls}</option>
                                ))}
                              </select>
                            </td>

                            {/* Subject Dropdown (Filtered strictly by row.className) */}
                            <td className="py-2 px-2.5">
                              <select
                                value={row.subject}
                                onChange={(e) => handleBulkRowFieldChange(idx, "subject", e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                              >
                                {subjectsForClass.map((sub: string) => (
                                  <option key={sub} value={sub}>{sub}</option>
                                ))}
                              </select>
                            </td>

                            {/* Assessment Type */}
                            <td className="py-2 px-2.5">
                              <select
                                value={row.assessmentType}
                                onChange={(e) => handleBulkRowFieldChange(idx, "assessmentType", e.target.value as AssessmentTypeEnum)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-xs focus:ring-1 focus:ring-blue-500"
                              >
                                {ASSESSMENT_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>{t.value}</option>
                                ))}
                              </select>
                            </td>

                            {/* Title Input */}
                            <td className="py-2 px-2.5">
                              <input
                                type="text"
                                value={row.title}
                                onChange={(e) => handleBulkRowFieldChange(idx, "title", e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                                placeholder="Exam Title"
                              />
                            </td>

                            {/* Date Input */}
                            <td className="py-2 px-2.5">
                              <input
                                type="date"
                                value={row.examDate}
                                onChange={(e) => handleBulkRowFieldChange(idx, "examDate", e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                              />
                            </td>

                            {/* Time Input */}
                            <td className="py-2 px-2.5">
                              <input
                                type="time"
                                value={row.startTime || "09:00"}
                                onChange={(e) => handleBulkRowFieldChange(idx, "startTime", e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 font-medium"
                              />
                            </td>

                            {/* Duration Input */}
                            <td className="py-2 px-2.5">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="15"
                                  max="360"
                                  step="5"
                                  value={row.duration}
                                  onChange={(e) => handleBulkRowFieldChange(idx, "duration", Number(e.target.value))}
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 text-center font-medium"
                                />
                                <span className="text-[10px] text-slate-400">m</span>
                              </div>
                            </td>

                            {/* Venue Input */}
                            <td className="py-2 px-2.5">
                              <input
                                type="text"
                                placeholder="e.g. Exam Hall A"
                                value={row.venue}
                                onChange={(e) => handleBulkRowFieldChange(idx, "venue", e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                              />
                            </td>

                            {/* Invigilator Dropdown */}
                            <td className="py-2 px-2.5">
                              <select
                                value={row.invigilatorId}
                                onChange={(e) => handleBulkRowFieldChange(idx, "invigilatorId", e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">None Assigned</option>
                                {staff.map((st) => (
                                  <option key={st.id} value={st.id}>{st.firstName} {st.lastName}</option>
                                ))}
                              </select>
                            </td>

                            {/* Row Actions */}
                            <td className="py-2 px-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateBulkRow(idx)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                  title="Duplicate Row"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBulkRow(idx)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title="Delete Row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Modal Footer with Counter and Confirm */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      You are about to schedule <strong className="text-blue-600 dark:text-blue-400 font-extrabold">{bulkRows.length}</strong> exams across <strong className="text-slate-900 dark:text-white font-extrabold">{new Set(bulkRows.map(r => r.className)).size}</strong> class(es).
                    </span>
                    {bulkDuplicates.size > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Duplicates detected ({bulkDuplicates.size})</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={isPending || bulkRows.length === 0 || bulkDuplicates.size > 0}
                      type="submit"
                      className="flex-1 sm:flex-initial px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isPending ? "Scheduling Exams..." : `Confirm & Schedule ${bulkRows.length} Exams`}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            )}
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
