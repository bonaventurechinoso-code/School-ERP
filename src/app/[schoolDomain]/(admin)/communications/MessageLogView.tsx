"use client";

import { useState, useTransition } from "react";
import { logMessage } from "./actions";
import { useTenant } from "@/lib/tenant-context";
import { ChevronDown, Send, CheckCircle2, AlertCircle, X } from "lucide-react";

type MessageLogViewProps = {
  schoolId: string;
  messageLogs: any[];
  students: any[];
  staff: any[];
};

export default function MessageLogView({ schoolId, messageLogs, students, staff }: MessageLogViewProps) {
  const tenant = useTenant();
  const isHigherEd = tenant.institutionType === "HIGHER_ED";
  
  const [isPending, startTransition] = useTransition();
  const [showSimulate, setShowSimulate] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formData, setFormData] = useState({
    recipientType: "STUDENT",
    messageType: "EMAIL",
    recipientEmail: "",
    subject: "",
    body: ""
  });

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await logMessage(schoolId, formData);
      if (res?.success) {
        setFeedback({ type: "success", text: `Message dispatched successfully to ${formData.recipientEmail}!` });
        setShowSimulate(false);
        setFormData({ recipientType: "STUDENT", messageType: "EMAIL", recipientEmail: "", subject: "", body: "" });
      } else {
        setFeedback({ type: "error", text: res?.error || "Failed to dispatch message." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-xs animate-in fade-in duration-200 ${
          feedback.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" 
            : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            aria-label="Dismiss feedback"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Direct Message & Notification Center</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Dispatch direct emails and SMS alerts to students, parents, and staff.</p>
        </div>
        <button 
          onClick={() => setShowSimulate(!showSimulate)}
          className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl transition font-medium text-sm shadow-sm cursor-pointer"
        >
          {showSimulate ? "Close Composer" : "+ Dispatch New Message"}
        </button>
      </div>

      {showSimulate && (
        <form onSubmit={handleSimulate} className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 gap-4 shadow-sm animate-in fade-in duration-200">
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
            Compose an official communication to be dispatched directly to the recipient and recorded in the audit logs below.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Channel Selection Field */}
            <div>
              <label htmlFor="channel-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Channel
              </label>
              <div className="relative">
                <select
                  id="channel-select"
                  name="channel"
                  aria-label="Communication Channel"
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-sm font-medium text-slate-800 shadow-xs transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 cursor-pointer"
                  value={formData.messageType}
                  onChange={(e) => setFormData({ ...formData, messageType: e.target.value })}
                >
                  <option value="EMAIL">Official Email</option>
                  <option value="SMS">SMS Notification</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Target Group */}
            <div>
              <label htmlFor="target-group-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Target Group
              </label>
              <div className="relative">
                <select
                  id="target-group-select"
                  name="recipientType"
                  aria-label="Target Group"
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-sm font-medium text-slate-800 shadow-xs transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 cursor-pointer"
                  value={formData.recipientType}
                  onChange={(e) => setFormData({ ...formData, recipientType: e.target.value, recipientEmail: "" })}
                >
                  <option value="STUDENT">Student</option>
                  <option value="STAFF">{isHigherEd ? "Faculty & Staff" : "Staff Member"}</option>
                  <option value="PARENT">{isHigherEd ? "Sponsor / Next of Kin" : "Parent / Guardian"}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Recipient Selection */}
            <div className="lg:col-span-2">
              <label htmlFor="recipient-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Select or Enter Recipient Email
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <select
                    id="recipient-select"
                    aria-label="Choose Recipient from Directory"
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-sm font-medium text-slate-800 shadow-xs transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 cursor-pointer"
                    value={formData.recipientEmail}
                    onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                  >
                    <option value="">-- Choose from Directory --</option>
                    {formData.recipientType === "STUDENT" && students.filter((s) => s.email).map((s) => (
                      <option key={s.id} value={s.email!}>{s.firstName} {s.lastName} ({s.email})</option>
                    ))}
                    {formData.recipientType === "STAFF" && staff.filter((s) => s.email).map((s) => (
                      <option key={s.id} value={s.email}>{s.firstName} {s.lastName} ({s.email})</option>
                    ))}
                    {formData.recipientType === "PARENT" && students.filter((s) => s.parentEmail).map((s) => (
                      <option key={s.id} value={s.parentEmail!}>
                        {isHigherEd ? "Sponsor" : "Parent"} of {s.firstName} {s.lastName} ({s.parentEmail})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
                <input 
                  type="email" 
                  placeholder="Or enter custom email address..." 
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" 
                  value={formData.recipientEmail} 
                  onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })} 
                  required 
                />
              </div>
            </div>

            {/* Subject */}
            <div className="md:col-span-2 lg:col-span-4">
              <label htmlFor="subject-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Subject / Header
              </label>
              <input
                id="subject-input"
                required
                type="text"
                placeholder="e.g. Important Notice Regarding Academic Schedule"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
          </div>
          
          {/* Message Content */}
          <div>
            <label htmlFor="body-textarea" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Message Content
            </label>
            <textarea
              id="body-textarea"
              required
              rows={4}
              placeholder="Type your message content here..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end mt-2">
            <button
              disabled={isPending}
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl transition font-semibold text-sm disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isPending ? "Dispatching..." : "Send Message"}</span>
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">Timestamp</th>
              <th className="px-6 py-4 font-semibold">Channel</th>
              <th className="px-6 py-4 font-semibold">Recipient Group</th>
              <th className="px-6 py-4 font-semibold">Contact Email</th>
              <th className="px-6 py-4 font-semibold">Subject &amp; Body Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {messageLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                  No outbound messages logged yet.
                </td>
              </tr>
            ) : (
              messageLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">
                    {new Date(log.sentAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      log.messageType === 'SMS' 
                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' 
                        : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                    }`}>
                      {log.messageType === "EMAIL" ? "Official Email" : log.messageType === "SMS" ? "SMS Notification" : log.messageType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                      {log.recipientType}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                    {log.recipientEmail}
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-xs">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{log.subject}</div>
                    <div className="truncate text-xs text-slate-400">{log.body}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
