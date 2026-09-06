"use client";

import React, { useState, useTransition } from "react";
import { createExam, deleteExam } from "./actions";

type ExamsListProps = {
  schoolId: string;
  exams: any[];
  courses: any[];
};

export default function ExamsList({ schoolId, exams, courses }: ExamsListProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    courseId: courses[0]?.id || "",
    name: "",
    semester: "Fall 2026",
    date: new Date().toISOString().split("T")[0],
    maxScore: 100
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createExam(schoolId, formData);
      if (res?.success) {
        setShowForm(false);
        setFormData({ ...formData, name: "" });
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
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-slate-800">Scheduled Exams</h3>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm transition hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "Schedule Exam"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-full">
            <h4 className="font-semibold text-slate-700">New Exam</h4>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Course</label>
            <select required className="w-full border border-slate-300 rounded-lg p-2" value={formData.courseId} onChange={e => setFormData({...formData, courseId: e.target.value})}>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Exam Name</label>
            <input required type="text" placeholder="e.g., Midterm" className="w-full border border-slate-300 rounded-lg p-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Semester</label>
            <select required className="w-full border border-slate-300 rounded-lg p-2" value={formData.semester} onChange={e => setFormData({...formData, semester: e.target.value})}>
              <option value="Fall 2026">Fall 2026</option>
              <option value="Spring 2027">Spring 2027</option>
              <option value="Fall 2027">Fall 2027</option>
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
