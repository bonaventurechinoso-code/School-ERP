"use client";

import React, { useState, useTransition, useMemo } from "react";
import { createNotice, deleteNotice, broadcastNotice } from "./actions";
import { 
  Plus, 
  Trash2, 
  Radio, 
  Bell, 
  Mail, 
  Send, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Users, 
  Briefcase, 
  Globe, 
  Sparkles,
  AlertCircle
} from "lucide-react";

type AnnouncementsBoardProps = {
  schoolId: string;
  schoolDomain?: string;
  activeTier?: string;
  notices: any[];
};

export default function AnnouncementsBoard({ 
  schoolId, 
  schoolDomain, 
  activeTier, 
  notices 
}: AnnouncementsBoardProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<{ id: string; text: string; success: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAudience, setFilterAudience] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetAudience: "ALL",
    priority: "NORMAL",
    autoBroadcast: false
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createNotice(schoolId, formData, schoolDomain, activeTier);
      if (res?.success) {
        if (formData.autoBroadcast && res.noticeId) {
          await broadcastNotice(schoolId, res.noticeId, schoolDomain, activeTier);
        }
        setShowForm(false);
        setFormData({ title: "", content: "", targetAudience: "ALL", priority: "NORMAL", autoBroadcast: false });
        setBroadcastStatus({
          id: res.noticeId || "new",
          text: formData.autoBroadcast 
            ? "Announcement posted and broadcasted successfully!" 
            : "Announcement posted successfully to the notice board!",
          success: true
        });
        setTimeout(() => setBroadcastStatus(null), 5000);
      } else {
        alert(res?.error || "Failed to create announcement.");
      }
    });
  };

  const handleBroadcast = async (noticeId: string, title: string) => {
    setBroadcastStatus(null);
    startTransition(async () => {
      const res = await broadcastNotice(schoolId, noticeId, schoolDomain, activeTier);
      if (res?.success) {
        setBroadcastStatus({
          id: noticeId,
          text: `Successfully broadcasted "${title}" to ${res.recipientsCount || 0} recipient(s)!`,
          success: true
        });
        setTimeout(() => setBroadcastStatus(null), 6000);
      } else {
        setBroadcastStatus({
          id: noticeId,
          text: res?.error || "Broadcast delivery failed.",
          success: false
        });
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this notice?")) {
      startTransition(async () => {
        const res = await deleteNotice(schoolId, id, schoolDomain, activeTier);
        if (res?.error) alert(res.error);
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || "NORMAL").toUpperCase();
    switch (p) {
      case "URGENT":
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
            <span>{p === "URGENT" ? "Urgent Priority" : "High Priority"}</span>
          </span>
        );
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
            <span>Low Priority</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <span>Normal Priority</span>
          </span>
        );
    }
  };

  const getAudienceBadge = (audience: string) => {
    const a = (audience || "ALL").toUpperCase();
    switch (a) {
      case "STAFF":
        return (
          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-zinc-300 text-xs font-semibold">
            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>School Staff Only</span>
          </span>
        );
      case "STUDENTS":
        return (
          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-zinc-300 text-xs font-semibold">
            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Students & Parents</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-zinc-300 text-xs font-semibold">
            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>All Institution</span>
          </span>
        );
    }
  };

  // Filtered list of notices
  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      if (filterAudience !== "ALL" && n.targetAudience !== filterAudience) return false;
      if (filterPriority !== "ALL" && n.priority !== filterPriority) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t = (n.title || "").toLowerCase();
        const c = (n.content || "").toLowerCase();
        if (!t.includes(q) && !c.includes(q)) return false;
      }
      return true;
    });
  }, [notices, filterAudience, filterPriority, searchQuery]);

  return (
    <div className="space-y-6">
      {/* BROADCAST STATUS BANNER */}
      {broadcastStatus && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in duration-200 ${
          broadcastStatus.success 
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" 
            : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
        }`}>
          <div className="flex items-center gap-2">
            {broadcastStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{broadcastStatus.text}</span>
          </div>
          <button 
            onClick={() => setBroadcastStatus(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* HEADER CONTROLS TOOLBAR */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Announcements & Bulletins</h3>
            <span className="text-xs bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-2.5 py-0.5 rounded-full font-bold">
              {filteredNotices.length} active bulletin(s)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Publish public bulletins across portals or trigger instant email broadcast dispatch to registered stakeholders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Audience Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filterAudience}
              onChange={(e) => setFilterAudience(e.target.value)}
              className="border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              <option value="ALL">All Audiences</option>
              <option value="STAFF">School Staff Only</option>
              <option value="STUDENTS">Students & Parents</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High / Urgent</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search bulletins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Post Notice Trigger */}
          <button 
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{showForm ? "Cancel" : "Post Notice"}</span>
          </button>
        </div>
      </div>

      {/* NEW ANNOUNCEMENT COMPOSER */}
      {showForm && (
        <form 
          onSubmit={handleCreate} 
          className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-indigo-200 dark:border-indigo-900 space-y-4 animate-in fade-in duration-200"
        >
          <div className="border-b border-slate-100 dark:border-zinc-800 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">Compose Institutional Bulletin</h4>
            </div>
            <span className="text-[11px] text-slate-400">Broadcast-enabled</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Bulletin Title</label>
              <input 
                required 
                type="text" 
                placeholder="e.g., Resumption Date for Second Term 2026/2027 Academic Session" 
                className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Priority Level</label>
              <select 
                className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold" 
                value={formData.priority} 
                onChange={e => setFormData({...formData, priority: e.target.value})}
              >
                <option value="NORMAL">Normal Priority</option>
                <option value="HIGH">High / Important</option>
                <option value="URGENT">Urgent Advisory</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Target Audience</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: "ALL", label: "All Institution", desc: "Visible to staff, students & portal visitors", icon: Globe },
                { id: "STUDENTS", label: "Students & Parents", desc: "Enrolled pupils, students, and guardians", icon: Users },
                { id: "STAFF", label: "School Staff Only", desc: "Internal personnel, teachers, and admins", icon: Briefcase },
              ].map((aud) => {
                const Icon = aud.icon;
                const isSelected = formData.targetAudience === aud.id;
                return (
                  <div
                    key={aud.id}
                    onClick={() => setFormData({ ...formData, targetAudience: aud.id })}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500"
                        : "border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{aud.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">{aud.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Notice Body Content</label>
            <textarea 
              required 
              rows={4} 
              placeholder="Write the full announcement text, key instructions, dates, and official institutional directives..." 
              className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
              value={formData.content} 
              onChange={e => setFormData({...formData, content: e.target.value})} 
            />
          </div>

          {/* Instant Broadcast Checkbox */}
          <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Trigger Instant Email Broadcast</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Automatically dispatch this notice via email to all verified recipients in the chosen audience upon publishing.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              id="autoBroadcast"
              checked={formData.autoBroadcast}
              onChange={(e) => setFormData({ ...formData, autoBroadcast: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
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
              {isPending ? "Publishing Bulletin..." : "Publish Announcement"}
            </button>
          </div>
        </form>
      )}

      {/* NOTICES LIST */}
      <div className="space-y-4">
        {filteredNotices.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 text-xs">
            No published bulletins found matching your filter criteria.
          </div>
        ) : (
          filteredNotices.map((notice) => (
            <div 
              key={notice.id} 
              className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition"
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  {getPriorityBadge(notice.priority)}
                  {getAudienceBadge(notice.targetAudience)}
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(notice.createdAt).toLocaleDateString(undefined, { 
                      month: "short", 
                      day: "numeric", 
                      year: "numeric" 
                    })}
                  </span>
                </div>

                <h4 className="text-base font-extrabold text-slate-900 dark:text-white line-clamp-1">
                  {notice.title}
                </h4>

                <p className="text-slate-600 dark:text-zinc-300 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap line-clamp-3">
                  {notice.content}
                </p>

                {notice.author && (
                  <div className="text-[11px] text-slate-400 font-medium pt-1">
                    Posted by: <span className="text-slate-700 dark:text-zinc-300 font-bold">{notice.author.firstName} {notice.author.lastName}</span> ({notice.author.role})
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-zinc-800">
                <button
                  disabled={isPending}
                  onClick={() => handleBroadcast(notice.id, notice.title)}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 disabled:opacity-50"
                  title="Broadcast email to all audience recipients"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast Email</span>
                </button>

                <button 
                  disabled={isPending}
                  onClick={() => handleDelete(notice.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition hover:bg-slate-100 dark:hover:bg-zinc-800"
                  title="Delete Bulletin"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
