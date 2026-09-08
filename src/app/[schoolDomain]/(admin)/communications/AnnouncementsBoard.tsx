"use client";

import React, { useState, useTransition } from "react";
import { createNotice, deleteNotice } from "./actions";

type AnnouncementsBoardProps = {
  schoolId: string;
  notices: any[];
};

export default function AnnouncementsBoard({ schoolId, notices }: AnnouncementsBoardProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetAudience: "ALL",
    priority: "NORMAL"
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createNotice(schoolId, formData);
      if (res?.success) {
        setShowForm(false);
        setFormData({ title: "", content: "", targetAudience: "ALL", priority: "NORMAL" });
      } else {
        alert(res?.error);
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this notice?")) {
      startTransition(async () => {
        const res = await deleteNotice(schoolId, id);
        if (res?.error) alert(res.error);
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH": return "bg-red-100 text-red-800 border-red-200";
      case "LOW": return "bg-slate-100 text-slate-800 border-slate-200";
      default: return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="text-xl font-bold text-slate-800 w-full text-center sm:text-left">Announcements Board</h3>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm transition hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "Post Notice"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-full">
            <h4 className="font-semibold text-slate-700">New Announcement</h4>
          </div>
          
          <div className="col-span-full md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input required type="text" placeholder="e.g., School Closed Tomorrow" className="w-full border border-slate-300 rounded-lg p-2" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Target Audience</label>
            <select className="w-full border border-slate-300 rounded-lg p-2" value={formData.targetAudience} onChange={e => setFormData({...formData, targetAudience: e.target.value})}>
              <option value="ALL">All (Staff & Students)</option>
              <option value="STAFF">Staff Only</option>
              <option value="STUDENTS">Students Only</option>
            </select>
          </div>

          <div className="col-span-full md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
            <select className="w-full border border-slate-300 rounded-lg p-2" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          
          <div className="col-span-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">Message Content</label>
            <textarea required rows={4} className="w-full border border-slate-300 rounded-lg p-2" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}></textarea>
          </div>

          <div className="col-span-full flex justify-end mt-2">
            <button disabled={isPending} type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50">
              {isPending ? "Posting..." : "Post Announcement"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {notices.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No announcements posted yet.</p>
        ) : (
          notices.map(notice => (
            <div key={notice.id} className={`p-5 rounded-xl border relative group ${getPriorityColor(notice.priority)}`}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-lg">{notice.title}</h4>
                <div className="flex space-x-2 items-center">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                    {notice.targetAudience}
                  </span>
                  <button 
                    onClick={() => handleDelete(notice.id)}
                    className="text-red-500 opacity-0 group-hover:opacity-100 transition hover:text-red-700"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <p className="whitespace-pre-wrap opacity-90">{notice.content}</p>
              
              <div className="mt-4 text-xs font-medium opacity-75">
                Posted: {new Date(notice.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
