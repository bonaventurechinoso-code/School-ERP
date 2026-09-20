"use client";

import React, { useState, useTransition } from "react";
import {
  ClipboardList,
  PlusCircle,
  Calendar,
  CheckCircle2,
  Clock,
  BookOpen,
  FileText,
  X,
  Users,
} from "lucide-react";
import { AssignmentItem, createTeacherAssignment } from "../actions";

interface TeacherAssignmentsClientProps {
  initialAssignments: AssignmentItem[];
  assignedClasses: string[];
  assignedSubjects: string[];
  schoolName: string;
}

export function TeacherAssignmentsClient({
  initialAssignments,
  assignedClasses,
  assignedSubjects,
  schoolName,
}: TeacherAssignmentsClientProps) {
  const [assignments, setAssignments] = useState<AssignmentItem[]>(initialAssignments);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    className: assignedClasses[0] || "JSS 1",
    subject: assignedSubjects[0] || "Mathematics",
    description: "",
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
    totalPoints: 20,
  });

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    startTransition(async () => {
      try {
        await createTeacherAssignment(formData);
        // Optimistic add
        const newAssignment: AssignmentItem = {
          id: `temp-${Date.now()}`,
          title: formData.title,
          className: formData.className,
          subject: formData.subject,
          description: formData.description,
          dueDate: formData.dueDate,
          totalPoints: formData.totalPoints,
          submissionCount: 0,
          totalStudents: 28,
          status: "ACTIVE",
          createdAt: new Date().toISOString().split("T")[0],
        };
        setAssignments([newAssignment, ...assignments]);
        setIsModalOpen(false);
        setFormData({
          title: "",
          className: assignedClasses[0] || "JSS 1",
          subject: assignedSubjects[0] || "Mathematics",
          description: "",
          dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
          totalPoints: 20,
        });
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-1">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Curriculum Task Manager</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Homework & Assignments Tracker
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Distribute class homework, project tasks, and track student submissions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition shadow-md shadow-emerald-600/20 cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Assignment</span>
        </button>
      </div>

      {/* Assignments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {assignments.length > 0 ? (
          assignments.map((item) => {
            const submissionRate = Math.round(
              ((item.submissionCount || 0) / (item.totalStudents || 1)) * 100
            );

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-500/50 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                      {item.className} • {item.subject}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      Max: {item.totalPoints} pts
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-2">
                    {item.title}
                  </h3>

                  {item.description && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-3">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Progress & Submission Stats */}
                <div className="pt-3 border-t border-slate-100 dark:divide-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>Submissions</span>
                    </span>
                    <span className="text-slate-900 dark:text-white font-bold">
                      {item.submissionCount} / {item.totalStudents} ({submissionRate}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, submissionRate)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Due: {item.dueDate}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Active</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-3">
            <ClipboardList className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto" />
            <p className="font-bold text-sm text-slate-600 dark:text-zinc-400">
              No assignments distributed yet.
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-sm mx-auto">
              Create your first homework task by clicking the button above to assign tasks to your classroom streams.
            </p>
          </div>
        )}
      </div>

      {/* New Assignment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Create Class Assignment
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Publish a new task for your students to submit
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Assignment Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quadratic Equations Practice Set A"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Target Class
                  </label>
                  <select
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500 cursor-pointer"
                  >
                    {assignedClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Subject
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500 cursor-pointer"
                  >
                    {assignedSubjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Max Points
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.totalPoints}
                    onChange={(e) => setFormData({ ...formData, totalPoints: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Task Instructions / Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail exercises, book pages, or submission guidelines..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Publishing..." : "Publish Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
