"use client";

import React, { useState, useTransition, useMemo } from "react";
import { createTimetableEntry, deleteTimetableEntry } from "./actions";
import { 
  Plus, 
  Trash2, 
  Calendar, 
  BookOpen, 
  MapPin, 
  User, 
  AlertCircle, 
  Printer, 
  Filter, 
  Clock, 
  Sparkles,
  CheckCircle2
} from "lucide-react";

type TimetableProps = {
  schoolId: string;
  schoolDomain?: string;
  activeTier?: string;
  timetable: any[];
  courses: any[];
  classrooms: any[];
  staff: any[];
  classes?: string[];
};

export default function TimetableView({ 
  schoolId, 
  schoolDomain,
  activeTier,
  timetable, 
  courses, 
  classrooms, 
  staff,
  classes = []
}: TimetableProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [filterRoom, setFilterRoom] = useState<string>("ALL");
  const [filterTeacher, setFilterTeacher] = useState<string>("ALL");
  const [selectedDayTab, setSelectedDayTab] = useState<string>("ALL");

  const [formData, setFormData] = useState({
    courseId: courses[0]?.id || "",
    classroomId: classrooms[0]?.id || "",
    staffId: staff[0]?.id || "",
    dayOfWeek: "MONDAY",
    startTime: "08:30",
    endTime: "09:30"
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hasPrerequisites = courses.length > 0 && classrooms.length > 0 && staff.length > 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (formData.startTime >= formData.endTime) {
      setErrorMsg("End time must be later than start time.");
      return;
    }

    startTransition(async () => {
      const res = await createTimetableEntry(
        schoolId, 
        formData, 
        schoolDomain, 
        activeTier
      );
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("Class period scheduled successfully!");
        setShowForm(false);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this timetable session?")) {
      setErrorMsg(null);
      startTransition(async () => {
        const res = await deleteTimetableEntry(schoolId, id, schoolDomain, activeTier);
        if (res?.error) {
          setErrorMsg(res.error);
        }
      });
    }
  };

  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

  const filteredTimetable = useMemo(() => {
    return timetable.filter((t) => {
      if (filterRoom !== "ALL" && t.classroomId !== filterRoom) return false;
      if (filterTeacher !== "ALL" && t.staffId !== filterTeacher) return false;
      if (selectedDayTab !== "ALL" && t.dayOfWeek !== selectedDayTab) return false;
      return true;
    });
  }, [timetable, filterRoom, filterTeacher, selectedDayTab]);

  const activeDaysToRender = selectedDayTab === "ALL" ? days : [selectedDayTab];

  // Quick Time Slots Presets
  const quickTimePresets = [
    { label: "Period 1 (08:00 - 08:45)", start: "08:00", end: "08:45" },
    { label: "Period 2 (08:45 - 09:30)", start: "08:45", end: "09:30" },
    { label: "Period 3 (09:45 - 10:30)", start: "09:45", end: "10:30" },
    { label: "Period 4 (10:30 - 11:15)", start: "10:30", end: "11:15" },
    { label: "Period 5 (11:45 - 12:30)", start: "11:45", end: "12:30" },
    { label: "Period 6 (12:30 - 13:15)", start: "12:30", end: "13:15" },
    { label: "Period 7 (14:00 - 14:45)", start: "14:00", end: "14:45" },
  ];

  return (
    <div className="space-y-6">
      {/* SUCCESS BANNER */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* FILTER & CONTROLS TOOLBAR */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Master Class Schedule</h3>
            <span className="text-xs bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-2.5 py-0.5 rounded-full font-bold">
              {filteredTimetable.length} scheduled session(s)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            View and manage classroom sessions across all weekdays with automated double-booking clash prevention.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Room / Classroom Filter */}
          <div className="flex items-center gap-1.5 min-w-[150px] flex-1 sm:flex-initial">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
              className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="ALL">All Classrooms ({classrooms.length})</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Teacher Filter */}
          <div className="flex items-center gap-1.5 min-w-[150px] flex-1 sm:flex-initial">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="ALL">All Teachers ({staff.length})</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="p-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-xs font-semibold transition shrink-0 inline-flex items-center gap-1.5"
            title="Print Weekly Timetable"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {/* Add Session Button */}
          <button 
            type="button"
            onClick={() => setShowForm(!showForm)}
            disabled={!hasPrerequisites}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition disabled:opacity-50 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{showForm ? "Cancel" : "Add Class Session"}</span>
          </button>
        </div>
      </div>

      {/* DAY PILLS FOR RAPID FILTERING */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedDayTab("ALL")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            selectedDayTab === "ALL"
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
              : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
          }`}
        >
          All Days
        </button>
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDayTab(day)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              selectedDayTab === day
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            {day.charAt(0) + day.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* PREREQUISITE WARNING IF MISSING DATA */}
      {!hasPrerequisites && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="font-bold">Setup Required:</span> To configure timetable periods, ensure you have registered at least one Course, one Classroom, and assigned staff members with the Teacher role.
          </div>
        </div>
      )}

      {/* NEW SESSION CREATION MODAL / PANEL */}
      {showForm && (
        <form 
          onSubmit={handleCreate} 
          className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-indigo-200 dark:border-indigo-900 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-200"
        >
          <div className="col-span-full border-b border-slate-100 dark:border-zinc-800 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">Schedule New Class Period</h4>
            </div>
            <span className="text-[11px] text-slate-400">Conflict-safe scheduling</span>
          </div>
          
          {errorMsg && (
            <div className="col-span-full p-3.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Subject / Course</label>
            <select 
              required 
              className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
              value={formData.courseId} 
              onChange={e => setFormData({...formData, courseId: e.target.value})}
            >
              <option value="">Select Subject...</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Assigned Teacher</label>
            <select 
              required 
              className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
              value={formData.staffId} 
              onChange={e => setFormData({...formData, staffId: e.target.value})}
            >
              <option value="">Select Teacher...</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.role || "Teacher"})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Assigned Classroom</label>
            <select 
              required 
              className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
              value={formData.classroomId} 
              onChange={e => setFormData({...formData, classroomId: e.target.value})}
            >
              <option value="">Select Room / Class...</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Day of Week</label>
            <select 
              className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold" 
              value={formData.dayOfWeek} 
              onChange={e => setFormData({...formData, dayOfWeek: e.target.value})}
            >
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Start Time (HH:MM)</label>
            <input 
              required 
              type="time" 
              className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
              value={formData.startTime} 
              onChange={e => setFormData({...formData, startTime: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">End Time (HH:MM)</label>
            <input 
              required 
              type="time" 
              className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
              value={formData.endTime} 
              onChange={e => setFormData({...formData, endTime: e.target.value})} 
            />
          </div>

          {/* Quick Presets */}
          <div className="col-span-full pt-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Standard Period Presets:</div>
            <div className="flex flex-wrap gap-2">
              {quickTimePresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setFormData({ ...formData, startTime: preset.start, endTime: preset.end })}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-zinc-700 transition text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-full flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <button 
              type="button" 
              onClick={() => setShowForm(false)} 
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button 
              disabled={isPending} 
              type="submit" 
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
            >
              {isPending ? "Checking Conflicts..." : "Save Class Session"}
            </button>
          </div>
        </form>
      )}

      {/* WEEKLY TIMETABLE GRID */}
      <div className={`grid grid-cols-1 ${activeDaysToRender.length === 1 ? "md:grid-cols-1" : "md:grid-cols-3 lg:grid-cols-5"} gap-4`}>
        {activeDaysToRender.map((day) => {
          const daySessions = filteredTimetable
            .filter((t) => t.dayOfWeek === day)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div 
              key={day} 
              className="bg-slate-50/80 dark:bg-zinc-900/50 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 flex flex-col transition hover:border-slate-300 dark:hover:border-zinc-700"
            >
              {/* Day Header */}
              <div className="border-b border-slate-200 dark:border-zinc-800 pb-2 mb-3 text-center flex items-center justify-between sm:flex-col">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                  {day}
                </h4>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold mt-0.5">
                  {daySessions.length} session(s)
                </span>
              </div>

              {/* Sessions List */}
              <div className="space-y-3 flex-1">
                {daySessions.length === 0 ? (
                  <div className="text-xs text-slate-400 dark:text-zinc-500 text-center py-10 italic">
                    No classes scheduled
                  </div>
                ) : (
                  daySessions.map((session) => (
                    <div 
                      key={session.id} 
                      className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl shadow-xs border border-slate-200 dark:border-zinc-800 text-xs relative group hover:border-indigo-400 dark:hover:border-indigo-600 transition"
                    >
                      <div className="flex items-start justify-between gap-2 pr-5">
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm line-clamp-1">
                          {session.course.name}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] mt-1 font-mono bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{session.startTime} – {session.endTime}</span>
                      </div>

                      <div className="text-slate-500 dark:text-zinc-400 mt-2.5 space-y-1.5 text-[11px]">
                        <div className="flex items-center gap-1.5 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-800 dark:text-zinc-200 font-semibold">{session.classroom.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-600 dark:text-zinc-300 truncate">
                            {session.staff.firstName} {session.staff.lastName}
                          </span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDelete(session.id)}
                        disabled={isPending}
                        className="absolute top-2.5 right-2.5 p-1 text-slate-300 hover:text-rose-600 dark:text-zinc-600 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition rounded"
                        title="Delete Session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
