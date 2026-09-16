"use client";

import React, { useState, useTransition } from "react";
import { createTimetableEntry, deleteTimetableEntry } from "./actions";
import { Plus, Trash2, Calendar, BookOpen, MapPin, User, AlertCircle } from "lucide-react";

type TimetableProps = {
  schoolId: string;
  timetable: any[];
  courses: any[];
  classrooms: any[];
  staff: any[];
};

export default function TimetableView({ schoolId, timetable, courses, classrooms, staff }: TimetableProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [filterRoom, setFilterRoom] = useState<string>("ALL");
  const [formData, setFormData] = useState({
    courseId: courses[0]?.id || "",
    classroomId: classrooms[0]?.id || "",
    staffId: staff[0]?.id || "",
    dayOfWeek: "MONDAY",
    startTime: "08:30",
    endTime: "09:30"
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasPrerequisites = courses.length > 0 && classrooms.length > 0 && staff.length > 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      const res = await createTimetableEntry(schoolId, formData);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setShowForm(false);
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this timetable session entry?")) {
      startTransition(async () => {
        const res = await deleteTimetableEntry(schoolId, id);
        if (res?.error) {
          alert(res.error);
        }
      });
    }
  };

  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

  const filteredTimetable = timetable.filter(t => {
    if (filterRoom !== "ALL" && t.classroomId !== filterRoom) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Weekly Master Schedule</h3>
          <p className="text-xs text-slate-500">Visual timetable across classroom periods and active faculty.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {classrooms.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">Filter Room:</label>
              <select
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className="border border-slate-300 rounded-lg p-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Rooms ({classrooms.length})</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <button 
            onClick={() => setShowForm(!showForm)}
            disabled={!hasPrerequisites}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{showForm ? "Close Form" : "Add Class Session"}</span>
          </button>
        </div>
      </div>

      {/* PREREQUISITE WARNING IF MISSING DATA */}
      {!hasPrerequisites && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <span className="font-bold">Setup Required:</span> To configure timetable periods, ensure you have registered at least one Course, one Classroom, and assigned staff with the Teacher role.
          </div>
        </div>
      )}

      {/* NEW SESSION FORM */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200">
          <div className="col-span-full border-b border-slate-100 pb-2">
            <h4 className="font-bold text-slate-800 text-sm">Schedule New Class Period</h4>
          </div>
          
          {errorMsg && (
            <div className="col-span-full p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold">
              {errorMsg}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Subject / Course</label>
            <select required className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.courseId} onChange={e => setFormData({...formData, courseId: e.target.value})}>
              <option value="">Select Subject...</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Teacher</label>
            <select required className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.staffId} onChange={e => setFormData({...formData, staffId: e.target.value})}>
              <option value="">Select Teacher...</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Classroom</label>
            <select required className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.classroomId} onChange={e => setFormData({...formData, classroomId: e.target.value})}>
              <option value="">Select Room...</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Day of Week</label>
            <select className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.dayOfWeek} onChange={e => setFormData({...formData, dayOfWeek: e.target.value})}>
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time (HH:MM)</label>
            <input required type="time" className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">End Time (HH:MM)</label>
            <input required type="time" className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
          </div>

          <div className="col-span-full flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition">
              Cancel
            </button>
            <button disabled={isPending} type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 shadow-sm">
              {isPending ? "Validating Schedule..." : "Save Class Session"}
            </button>
          </div>
        </form>
      )}

      {/* 5-DAY TIMETABLE GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {days.map(day => {
          const daySessions = filteredTimetable
            .filter(t => t.dayOfWeek === day)
            .sort((a,b) => a.startTime.localeCompare(b.startTime));

          return (
            <div key={day} className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200 flex flex-col">
              <div className="border-b border-slate-200 pb-2 mb-3 text-center">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">{day}</h4>
                <span className="text-[10px] text-slate-500 font-medium">{daySessions.length} session(s)</span>
              </div>

              <div className="space-y-2.5 flex-1">
                {daySessions.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-8 italic">
                    No classes scheduled
                  </div>
                ) : (
                  daySessions.map(session => (
                    <div 
                      key={session.id} 
                      className="bg-white p-3 rounded-xl shadow-xs border border-slate-200 text-xs relative group hover:border-indigo-300 transition"
                    >
                      <div className="font-bold text-slate-900 text-sm">{session.course.name}</div>
                      <div className="text-indigo-600 font-semibold text-[11px] mt-0.5 font-mono">
                        {session.startTime} - {session.endTime}
                      </div>

                      <div className="text-slate-500 mt-2 space-y-1 text-[11px]">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{session.classroom.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="font-medium text-slate-700">{session.staff.firstName} {session.staff.lastName}</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDelete(session.id)}
                        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition rounded"
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
