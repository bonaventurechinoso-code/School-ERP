"use client";

import React, { useState, useTransition, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTenant } from "@/lib/tenant-context";
import { resolveStaffTierCategory, StaffTierCategory } from "@/lib/staff-roles-config";
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
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const searchParams = useSearchParams();
  const tenant = useTenant();
  const paramTier = searchParams.get("tier");

  const tierCategory: StaffTierCategory = useMemo(() => {
    return resolveStaffTierCategory(
      paramTier || (tenant as any)?.activeTier || tenant.preciseTier || (tenant.institutionType === "HIGHER_ED" ? "TERTIARY" : "PRIMARY")
    );
  }, [paramTier, (tenant as any)?.activeTier, tenant.preciseTier, tenant.institutionType]);

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
    maxScore: 100
  });

  useEffect(() => {
    if (!sessionOptions.includes(formData.semester)) {
      setFormData(prev => ({ ...prev, semester: sessionOptions[0] }));
    }
  }, [sessionOptions, formData.semester]);

  useEffect(() => {
    if (!activeSubjectsList.includes(formData.courseId)) {
      setFormData(prev => ({ ...prev, courseId: activeSubjectsList[0] || "" }));
    }
  }, [activeSubjectsList, formData.courseId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createExam(schoolId, formData);
      if (res?.success) {
        setShowForm(false);
        setFormData({ 
          ...formData, 
          name: "", 
          courseId: activeSubjectsList[0] || "",
          semester: sessionOptions[0] 
        });
      } else {
        alert(res?.error);
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this exam? All student results will also be deleted.")) {
      startTransition(async () => {
        const res = await deleteExam(schoolId, id);
        if (res?.error) alert(res.error);
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="text-xl font-bold text-slate-800 w-full text-center sm:text-left">Scheduled Exams</h3>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm transition hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "Schedule Exam"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-full">
            <h4 className="font-semibold text-slate-700">Assessments</h4>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{subjectLabel}</label>
            <select 
              required 
              className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              value={formData.courseId} 
              onChange={e => setFormData({...formData, courseId: e.target.value})}
            >
              <option value="" disabled>Select {subjectLabel}...</option>
              {activeSubjectsList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Exam Name</label>
            <input required type="text" placeholder="e.g., Midterm" className="w-full border border-slate-300 rounded-lg p-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{termLabel}</label>
            <select 
              required 
              className="w-full border border-slate-300 rounded-lg p-2" 
              value={formData.semester} 
              onChange={e => setFormData({...formData, semester: e.target.value})}
            >
              {sessionOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input required type="date" className="w-full border border-slate-300 rounded-lg p-2" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Score</label>
            <input required type="number" min="1" className="w-full border border-slate-300 rounded-lg p-2" value={formData.maxScore} onChange={e => setFormData({...formData, maxScore: Number(e.target.value)})} />
          </div>

          <div className="col-span-full flex justify-end">
            <button disabled={isPending} type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50">
              {isPending ? "Saving..." : "Save Exam"}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exams.length === 0 ? (
          <p className="text-slate-500">No exams scheduled yet.</p>
        ) : (
          exams.map(exam => (
            <div key={exam.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative group">
              <div className="font-bold text-slate-800 text-lg">{exam.name}</div>
              <div className="text-slate-500 text-sm font-medium mb-3">{exam.course.name} &bull; {exam.semester}</div>
              
              <div className="flex justify-between items-center text-sm text-slate-600">
                <span>📅 {new Date(exam.date).toLocaleDateString()}</span>
                <span>Max: {exam.maxScore}</span>
              </div>
              
              <button 
                onClick={() => handleDelete(exam.id)}
                className="absolute top-3 right-3 text-red-500 opacity-0 group-hover:opacity-100 transition"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
