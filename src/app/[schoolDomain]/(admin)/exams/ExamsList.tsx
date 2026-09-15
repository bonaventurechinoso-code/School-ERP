"use client";

import React, { useState, useTransition, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTenant } from "@/lib/tenant-context";
import { resolveStaffTierCategory, StaffTierCategory } from "@/lib/staff-roles-config";
import { CheckCircle2, AlertCircle, Calendar, Award, Trash2 } from "lucide-react";
import { createExam, deleteExam } from "./actions";

type ExamsListProps = {
  schoolId: string;
  exams: any[];
  courses: any[];
};

export const SCHOOL_TERMS: readonly string[] = [
  "1st Term",
  "2nd Term",
  "3rd Term",
];

export const HIGHER_ED_SEMESTERS: readonly string[] = [
  "1st Semester",
  "2nd Semester",
];

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

export default function ExamsList({ schoolId, exams, courses }: ExamsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Dynamic local state array tracking scheduled exams for instant UI updates
  const [examList, setExamList] = useState<any[]>(exams || []);

  useEffect(() => {
    setExamList(exams || []);
  }, [exams]);

  const searchParams = useSearchParams();
  const tenant = useTenant();
  const paramTier = searchParams.get("tier");

  const tenantActiveTier = (tenant as any)?.activeTier;
  const tenantPreciseTier = tenant.preciseTier;
  const tenantType = tenant.institutionType;

  const tierCategory: StaffTierCategory = useMemo(() => {
    return resolveStaffTierCategory(
      paramTier || tenantActiveTier || tenantPreciseTier || (tenantType === "HIGHER_ED" ? "TERTIARY" : "PRIMARY")
    );
  }, [paramTier, tenantActiveTier, tenantPreciseTier, tenantType]);

  const isHigherEd = tierCategory === "TERTIARY" || tenant.institutionType === "HIGHER_ED";
  const subjectLabel = isHigherEd ? "Course" : "Subject";
  const termLabel = isHigherEd ? "Semester" : "Term";
  const sessionOptions: readonly string[] = isHigherEd ? HIGHER_ED_SEMESTERS : SCHOOL_TERMS;

  const activeSubjectsList: readonly string[] = useMemo(() => {
    switch (tierCategory) {
      case "NURSERY":
        return NURSERY_SUBJECTS;
      case "PRIMARY":
        return PRIMARY_SUBJECTS;
      case "SECONDARY":
        return SECONDARY_SUBJECTS;
      case "TERTIARY":
        return HIGHER_ED_COURSES;
      default:
        return PRIMARY_SUBJECTS;
    }
  }, [tierCategory]);

  const [formData, setFormData] = useState<{
    courseId: string;
    name: string;
    semester: string;
    date: string;
    maxScore: number;
  }>({
    courseId: activeSubjectsList[0] || "",
    name: "",
    semester: sessionOptions[0],
    date: new Date().toISOString().split("T")[0],
    maxScore: 100,
  });

  useEffect(() => {
    if (!sessionOptions.includes(formData.semester)) {
      setFormData((prev) => ({ ...prev, semester: sessionOptions[0] }));
    }
  }, [sessionOptions, formData.semester]);

  useEffect(() => {
    if (!activeSubjectsList.includes(formData.courseId)) {
      setFormData((prev) => ({ ...prev, courseId: activeSubjectsList[0] || "" }));
    }
  }, [activeSubjectsList, formData.courseId]);

  /**
   * FORM SUBMISSION & DATA SERIALIZATION:
   * Captures all input states (Exam Name, Term, Subject, Max Score, Date),
   * sanitizes values, validates constraints, and executes the server action.
   * On success: clears form state, renders success notification, and immediately
   * prepends the new entry into the local examList grid.
   */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);

    // 1. Validation & Input Sanitization
    const trimmedName = formData.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setValidationError("Please enter a valid assessment/exam name (at least 2 characters).");
      return;
    }

    const trimmedCourse = formData.courseId.trim();
    if (!trimmedCourse) {
      setValidationError(`Please select a valid ${subjectLabel}.`);
      return;
    }

    if (!formData.semester) {
      setValidationError(`Please select a valid ${termLabel}.`);
      return;
    }

    if (!formData.date) {
      setValidationError("Please select a scheduled date.");
      return;
    }

    const numericMaxScore = Number(formData.maxScore);
    if (isNaN(numericMaxScore) || numericMaxScore <= 0) {
      setValidationError("Max Score must be a positive number greater than zero.");
      return;
    }

    // 2. Data Serialization
    const serializedPayload = {
      courseId: trimmedCourse,
      name: trimmedName,
      semester: formData.semester.trim(),
      date: formData.date,
      maxScore: Math.round(numericMaxScore),
    };

    startTransition(async () => {
      const res = await createExam(schoolId, serializedPayload);
      if (res?.success) {
        // 3. Clear Input States to Fresh Defaults
        setFormData({
          name: "",
          courseId: activeSubjectsList[0] || "",
          semester: sessionOptions[0] || "1st Term",
          date: new Date().toISOString().split("T")[0],
          maxScore: 100,
        });

        // 4. Set Clean Validation Success Notification Banner
        setSuccessMessage(
          `Assessment "${serializedPayload.name}" successfully scheduled for ${serializedPayload.courseId} (${serializedPayload.semester}).`
        );
        setShowForm(false);

        // 5. Dynamically update 'Scheduled Exams' list grid underneath
        const newEntry = (res as any)?.exam || {
          id: `exam-${Date.now()}`,
          name: serializedPayload.name,
          course: { name: serializedPayload.courseId },
          semester: serializedPayload.semester,
          date: new Date(serializedPayload.date).toISOString(),
          maxScore: serializedPayload.maxScore,
        };

        setExamList((prev) => [newEntry, ...prev]);
        router.refresh();
      } else {
        setValidationError(res?.error || "Failed to schedule assessment. Please try again.");
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this exam? All student results will also be deleted.")) {
      setSuccessMessage(null);
      setValidationError(null);
      startTransition(async () => {
        const res = await deleteExam(schoolId, id);
        if (res?.success) {
          setExamList((prev) => prev.filter((item) => item.id !== id));
          setSuccessMessage("Assessment removed successfully.");
          router.refresh();
        } else {
          setValidationError(res?.error || "Failed to delete exam.");
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Toggle Button */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="text-xl font-bold text-slate-800 w-full text-center sm:text-left">Scheduled Exams</h3>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setValidationError(null);
          }}
          className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm transition hover:bg-indigo-700 cursor-pointer"
        >
          {showForm ? "Cancel" : "Schedule Exam"}
        </button>
      </div>

      {/* Validation Success Notification Banner */}
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

      {/* Validation Error Notification Banner */}
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

      {/* New Exam Creation Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
          <div className="col-span-full">
            <h4 className="font-semibold text-slate-700">New Exam / Assessment Details</h4>
            <p className="text-xs text-slate-500 mt-0.5">Capture scheduling criteria and grade allocation parameters.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{subjectLabel}</label>
            <select
              required
              className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 bg-white"
              value={formData.courseId}
              onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
            >
              <option value="" disabled>
                Select {subjectLabel}...
              </option>
              {activeSubjectsList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Exam Name</label>
            <input
              required
              type="text"
              placeholder="e.g., Midterm Assessment"
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{termLabel}</label>
            <select
              required
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 bg-white"
              value={formData.semester}
              onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
            >
              {sessionOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              required
              type="date"
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Score</label>
            <input
              required
              type="number"
              min="1"
              max="1000"
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
              value={formData.maxScore}
              onChange={(e) => setFormData({ ...formData, maxScore: Number(e.target.value) })}
            />
          </div>

          <div className="col-span-full flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition text-sm font-medium"
            >
              Cancel
            </button>
            <button
              disabled={isPending}
              type="submit"
              className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50 font-medium text-sm shadow-sm cursor-pointer"
            >
              {isPending ? "Saving Exam..." : "Save Exam"}
            </button>
          </div>
        </form>
      )}

      {/* Scheduled Exams List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {examList.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-slate-50 border border-slate-200 rounded-2xl">
            <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 font-semibold text-base">No exams scheduled yet</p>
            <p className="text-slate-400 text-sm mt-1">Click &quot;Schedule Exam&quot; above to create your first assessment.</p>
          </div>
        ) : (
          examList.map((exam) => (
            <div key={exam.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group hover:border-slate-300 transition-all">
              <div className="font-bold text-slate-800 text-lg">{exam.name}</div>
              <div className="text-slate-500 text-sm font-medium mb-3">
                {exam.course?.name || "General Course"} &bull; {exam.semester}
              </div>

              <div className="flex justify-between items-center text-xs font-semibold text-slate-600 border-t border-slate-100 pt-3">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(exam.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                  <Award className="w-3.5 h-3.5 text-blue-500" />
                  Max: {exam.maxScore} pts
                </span>
              </div>

              <button
                onClick={() => handleDelete(exam.id)}
                className="absolute top-3 right-3 text-slate-400 hover:text-red-600 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition cursor-pointer"
                title="Delete Assessment"
                aria-label="Delete Assessment"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
