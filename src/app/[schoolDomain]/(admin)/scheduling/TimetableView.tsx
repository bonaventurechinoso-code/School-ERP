"use client";

import React, { useState, useTransition } from "react";
import { createTimetableEntry, deleteTimetableEntry } from "./actions";

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
  const [formData, setFormData] = useState({
    courseId: courses[0]?.id || "",
    classroomId: classrooms[0]?.id || "",
    staffId: staff[0]?.id || "",
    dayOfWeek: "MONDAY",
    startTime: "09:00",
    endTime: "10:00"
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    if (confirm("Delete this timetable entry?")) {
      startTransition(async () => {
        const res = await deleteTimetableEntry(schoolId, id);
        if (res?.error) {
          alert(res.error);
        }
      });
    }
  };

  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="text-xl font-bold text-slate-800 w-full text-center sm:text-left">Weekly Timetable</h3>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-sm transition hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "Add Class Session"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="col-span-full">
            <h4 className="font-semibold text-slate-700">New Timetable Entry</h4>
          </div>
          {errorMsg && (
            <div className="col-span-full p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
              {errorMsg}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Course</label>
            <select required className="w-full border border-slate-300 rounded-lg p-2" value={formData.courseId} onChange={e => setFormData({...formData, courseId: e.target.value})}>
              <option value="">Select Course...</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teacher</label>
            <select required className="w-full border border-slate-300 rounded-lg p-2" value={formData.staffId} onChange={e => setFormData({...formData, staffId: e.target.value})}>
              <option value="">Select Teacher...</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Classroom</label>
            <select required className="w-full border border-slate-300 rounded-lg p-2" value={formData.classroomId} onChange={e => setFormData({...formData, classroomId: e.target.value})}>
              <option value="">Select Room...</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Day of Week</label>
            <select className="w-full border border-slate-300 rounded-lg p-2" value={formData.dayOfWeek} onChange={e => setFormData({...formData, dayOfWeek: e.target.value})}>
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Time (HH:MM)</label>
            <input required type="time" className="w-full border border-slate-300 rounded-lg p-2" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Time (HH:MM)</label>
            <input required type="time" className="w-full border border-slate-300 rounded-lg p-2" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
          </div>

          <div className="col-span-full flex justify-end">
            <button disabled={isPending} type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50">
              Save Session
            </button>
          </div>
        </form>
      )}

      {/* Timetable Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {days.map(day => {
          const daySessions = timetable.filter(t => t.dayOfWeek === day).sort((a,b) => a.startTime.localeCompare(b.startTime));
          return (
            <div key={day} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h4 className="font-bold text-slate-700 border-b border-slate-200 pb-2 mb-4 text-center">{day}</h4>
              <div className="space-y-3">
                {daySessions.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No classes</p>
                ) : (
                  daySessions.map(session => (
                    <div key={session.id} className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 text-sm relative group">
                      <div className="font-semibold text-slate-800">{session.course.name}</div>
                      <div className="text-slate-500 text-xs mt-1">{session.startTime} - {session.endTime}</div>
                      <div className="text-slate-600 mt-1 flex justify-between">
                        <span>{session.classroom.name}</span>
                        <span className="font-medium">{session.staff.lastName}</span>
                      </div>
                      <button 
                        onClick={() => handleDelete(session.id)}
                        className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
