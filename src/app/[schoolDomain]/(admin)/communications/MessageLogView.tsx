"use client";

import React, { useState, useTransition, useMemo } from "react";
import { logMessage } from "./actions";
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Search, 
  Filter, 
  Mail, 
  Smartphone, 
  MessageSquare, 
  User, 
  Users, 
  Briefcase, 
  Clock, 
  FileText, 
  Sparkles,
  ExternalLink,
  ChevronDown
} from "lucide-react";

type MessageLogViewProps = {
  schoolId: string;
  schoolDomain?: string;
  activeTier?: string;
  messageLogs: any[];
  students: any[];
  staff: any[];
};

export default function MessageLogView({ 
  schoolId, 
  schoolDomain, 
  activeTier, 
  messageLogs, 
  students, 
  staff 
}: MessageLogViewProps) {
  const [isPending, startTransition] = useTransition();
  const [showComposer, setShowComposer] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedLogForPreview, setSelectedLogForPreview] = useState<any | null>(null);

  // Filter states for message logs table
  const [filterChannel, setFilterChannel] = useState("ALL");
  const [filterRecipientType, setFilterRecipientType] = useState("ALL");
  const [searchLogQuery, setSearchLogQuery] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    recipientType: "STUDENT",
    messageType: "EMAIL",
    recipientEmail: "",
    recipientName: "",
    subject: "",
    body: ""
  });

  // Pre-configured Nigerian Educational Institutional Templates
  const templates = [
    {
      name: "Tuition & School Fees Reminder",
      subject: "[URGENT] Outstanding School Fees Payment Advisory",
      recipientType: "PARENT",
      body: "Dear Parent/Guardian,\n\nThis is an official reminder from the Bursary Desk regarding the outstanding tuition and school fees balance for your ward. We kindly request that all outstanding fees be settled promptly via our secure online portal before the commencement of continuous assessments.\n\nThank you for your valued partnership and continued support."
    },
    {
      name: "Term-End Resumption Notice",
      subject: "Official Notice: Resumption Date for Upcoming Academic Term",
      recipientType: "ALL",
      body: "Dear Parents, Students, and Staff,\n\nPlease be informed that academic activities for the upcoming term will officially resume on Monday at 07:45 AM prompt. All students are expected to report in complete, approved school uniforms with required learning materials.\n\nWe look forward to a successful and productive academic session."
    },
    {
      name: "PTA General Meeting Invitation",
      subject: "Invitation: Termly Parent-Teacher Association (PTA) General Meeting",
      recipientType: "PARENT",
      body: "Dear Respected Parents and Guardians,\n\nYou are cordially invited to the Termly Parent-Teacher Association (PTA) General Meeting scheduled for Saturday at 10:00 AM in the School Main Auditorium. Important deliberations concerning student academic welfare and school development projects will be discussed.\n\nYour punctual attendance is greatly appreciated."
    },
    {
      name: "Report Card Release Advisory",
      subject: "Advisory: Release of Termly Academic Report Cards & Results Broad-sheet",
      recipientType: "PARENT",
      body: "Dear Parent/Guardian,\n\nWe are pleased to announce that official terminal report sheets for the just-concluded academic term have been finalized and uploaded to the institutional portal. You may log in to the Parent/Student Portal to review and download certified PDF report sheets.\n\nBest regards,\nOffice of the Principal / Head of School."
    },
    {
      name: "Mid-Term Break & Academic Calendar Advisory",
      subject: "Notice: Upcoming Mid-Term Break & Project Submissions",
      recipientType: "STUDENT",
      body: "Dear Parents and Students,\n\nThis is to notify all stakeholders that our scheduled Mid-Term Break will commence this Thursday. Students have been assigned take-home revision projects due on the resumption date.\n\nHave a safe and restful break."
    }
  ];

  const handleApplyTemplate = (templateIndex: number) => {
    const t = templates[templateIndex];
    if (t) {
      setFormData((prev) => ({
        ...prev,
        subject: t.subject,
        body: t.body,
        recipientType: t.recipientType === "ALL" ? prev.recipientType : t.recipientType
      }));
    }
  };

  const handleSelectQuickRecipient = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;

    // Check students
    const student = students.find(s => s.id === val);
    if (student) {
      const email = student.email || student.parentEmail || "";
      setFormData(prev => ({
        ...prev,
        recipientEmail: email,
        recipientName: `${student.firstName} ${student.lastName} (${student.currentClass || "Student"})`,
        recipientType: student.email ? "STUDENT" : "PARENT"
      }));
      return;
    }

    // Check staff
    const faculty = staff.find(st => st.id === val);
    if (faculty) {
      setFormData(prev => ({
        ...prev,
        recipientEmail: faculty.email,
        recipientName: `${faculty.firstName} ${faculty.lastName} (${faculty.role})`,
        recipientType: "STAFF"
      }));
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!formData.recipientEmail.trim()) {
      setFeedback({ type: "error", text: "Please provide a valid recipient destination email or phone." });
      return;
    }

    startTransition(async () => {
      const res = await logMessage(schoolId, formData, schoolDomain, activeTier);
      if (res?.success) {
        setFeedback({ 
          type: "success", 
          text: `Message dispatched successfully to ${formData.recipientEmail} via ${formData.messageType}!` 
        });
        setShowComposer(false);
        setFormData({ 
          recipientType: "STUDENT", 
          messageType: "EMAIL", 
          recipientEmail: "", 
          recipientName: "", 
          subject: "", 
          body: "" 
        });
        setTimeout(() => setFeedback(null), 5000);
      } else {
        setFeedback({ type: "error", text: res?.error || "Failed to dispatch message." });
      }
    });
  };

  // Filtered Logs List
  const filteredLogs = useMemo(() => {
    return messageLogs.filter((log) => {
      if (filterChannel !== "ALL" && log.messageType !== filterChannel) return false;
      if (filterRecipientType !== "ALL" && log.recipientType !== filterRecipientType) return false;
      if (searchLogQuery.trim()) {
        const q = searchLogQuery.toLowerCase();
        const email = (log.recipientEmail || "").toLowerCase();
        const subject = (log.subject || "").toLowerCase();
        const body = (log.body || "").toLowerCase();
        if (!email.includes(q) && !subject.includes(q) && !body.includes(q)) return false;
      }
      return true;
    });
  }, [messageLogs, filterChannel, filterRecipientType, searchLogQuery]);

  const getChannelBadge = (type: string) => {
    const t = (type || "EMAIL").toUpperCase();
    if (t.includes("SMS")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <Smartphone className="w-3 h-3 text-emerald-500" />
          <span>SMS Alert</span>
        </span>
      );
    }
    if (t.includes("WHATSAPP")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800">
          <MessageSquare className="w-3 h-3 text-green-500" />
          <span>WhatsApp</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
        <Mail className="w-3 h-3 text-indigo-500" />
        <span>Branded Email</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* FEEDBACK BANNER */}
      {feedback && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in duration-200 ${
          feedback.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" 
            : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP CONTROLS & COMPOSER TRIGGER */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Direct Message & Audit Center</h3>
            <span className="text-xs bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-2.5 py-0.5 rounded-full font-bold">
              {filteredLogs.length} logged dispatch(es)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Dispatch personalized SMS, WhatsApp, and formatted email notices directly to individual pupils, guardians, or teachers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Channel Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              <option value="ALL">All Channels</option>
              <option value="EMAIL">Email Dispatches</option>
              <option value="SMS">SMS Alerts</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </div>

          {/* Recipient Type Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <select
              value={filterRecipientType}
              onChange={(e) => setFilterRecipientType(e.target.value)}
              className="border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              <option value="ALL">All Recipients</option>
              <option value="STUDENT">Students</option>
              <option value="PARENT">Parents / Guardians</option>
              <option value="STAFF">School Staff</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search dispatch logs..."
              value={searchLogQuery}
              onChange={(e) => setSearchLogQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Open Composer Button */}
          <button 
            type="button"
            onClick={() => setShowComposer(!showComposer)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>{showComposer ? "Close Composer" : "Compose Message"}</span>
          </button>
        </div>
      </div>

      {/* DIRECT MESSAGE COMPOSER */}
      {showComposer && (
        <form 
          onSubmit={handleDispatch}
          className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-indigo-200 dark:border-indigo-900 space-y-4 animate-in fade-in duration-200"
        >
          <div className="border-b border-slate-100 dark:border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">Direct Institutional Message Dispatcher</h4>
            </div>
            <span className="text-[11px] text-slate-400">Recorded into audit trail</span>
          </div>

          {/* Template Quick Loader */}
          <div className="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-slate-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Load Institutional Message Template:</span>
            </div>
            <select
              onChange={(e) => {
                if (e.target.value !== "") handleApplyTemplate(parseInt(e.target.value));
              }}
              defaultValue=""
              className="border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 rounded-lg p-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold max-w-sm"
            >
              <option value="">Select a Pre-Configured Template...</option>
              {templates.map((t, idx) => (
                <option key={t.name} value={idx}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Communication Channel */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Dispatch Channel</label>
              <select
                value={formData.messageType}
                onChange={(e) => setFormData({ ...formData, messageType: e.target.value })}
                className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                <option value="EMAIL">Branded Official Email</option>
                <option value="SMS">Direct SMS Alert</option>
                <option value="WHATSAPP">WhatsApp Message</option>
              </select>
            </div>

            {/* Recipient Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Recipient Classification</label>
              <select
                value={formData.recipientType}
                onChange={(e) => setFormData({ ...formData, recipientType: e.target.value })}
                className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                <option value="STUDENT">Student</option>
                <option value="PARENT">Parent / Guardian</option>
                <option value="STAFF">Staff Member</option>
              </select>
            </div>

            {/* Quick Registered Recipient Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Quick Recipient Picker ({students.length + staff.length} available)
              </label>
              <select
                onChange={handleSelectQuickRecipient}
                defaultValue=""
                className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="">Choose from Registered Directory...</option>
                <optgroup label="Enrolled Students">
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.currentClass || "Student"}) – {s.email || s.parentEmail || "No Email"}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="School Staff">
                  {staff.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.firstName} {st.lastName} ({st.role}) – {st.email}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Destination Email / Phone Number
              </label>
              <input
                required
                type="text"
                placeholder="e.g. parent@example.com or +2348012345678"
                value={formData.recipientEmail}
                onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Message Subject / Headline
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Termly Report Card Ready for Inspection"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              Message Content / Dispatch Body
            </label>
            <textarea
              required
              rows={5}
              placeholder="Type your official direct communication message here..."
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              className="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button 
              type="button" 
              onClick={() => setShowComposer(false)} 
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button 
              disabled={isPending} 
              type="submit" 
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isPending ? "Dispatching Message..." : "Dispatch Message"}</span>
            </button>
          </div>
        </form>
      )}

      {/* MESSAGE AUDIT LOGS TABLE */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Recipient Destination</th>
                <th className="px-6 py-4">Channel</th>
                <th className="px-6 py-4">Subject & Content Preview</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-zinc-500">
                    No communication dispatch logs found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white font-mono text-xs">
                        {log.recipientEmail}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 uppercase tracking-wide font-semibold">
                        {log.recipientType}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {getChannelBadge(log.messageType)}
                    </td>

                    <td className="px-6 py-4 max-w-md">
                      <div className="font-extrabold text-slate-800 dark:text-zinc-200 line-clamp-1 text-xs">
                        {log.subject}
                      </div>
                      <div className="text-slate-500 dark:text-zinc-400 text-xs line-clamp-1 mt-0.5">
                        {log.body}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-zinc-400">
                      <div className="font-medium">
                        {new Date(log.sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedLogForPreview(log)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
              No communication dispatch logs found.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate block">
                      {log.recipientEmail}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {log.recipientType}
                    </span>
                  </div>
                  {getChannelBadge(log.messageType)}
                </div>

                <div className="text-xs font-bold text-slate-800 dark:text-zinc-200 line-clamp-1">
                  {log.subject}
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">
                  {log.body}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                  <span>{new Date(log.sentAt).toLocaleDateString()}</span>
                  <button
                    onClick={() => setSelectedLogForPreview(log)}
                    className="text-indigo-600 dark:text-indigo-400 font-bold"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* INSPECTION PREVIEW MODAL */}
      {selectedLogForPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-extrabold text-slate-900 dark:text-white text-base">Communication Audit Record</h4>
              </div>
              <button
                onClick={() => setSelectedLogForPreview(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-700">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Recipient</div>
                  <div className="font-mono font-bold text-slate-800 dark:text-white mt-0.5 truncate">{selectedLogForPreview.recipientEmail}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Channel & Audience</div>
                  <div className="font-bold text-slate-800 dark:text-white mt-0.5">{selectedLogForPreview.messageType} • {selectedLogForPreview.recipientType}</div>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-zinc-700">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Timestamp</div>
                  <div className="text-slate-700 dark:text-zinc-300 mt-0.5">
                    {new Date(selectedLogForPreview.sentAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase font-bold text-slate-400 mb-1">Subject</div>
                <div className="p-2.5 bg-slate-100 dark:bg-zinc-800 rounded-xl font-bold text-slate-900 dark:text-white text-sm">
                  {selectedLogForPreview.subject}
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase font-bold text-slate-400 mb-1">Full Message Content</div>
                <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {selectedLogForPreview.body}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={() => setSelectedLogForPreview(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
