"use client";

import React, { useState, useTransition } from "react";
import {
  MessageSquare,
  Send,
  Bell,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { sendTeacherMessage } from "../actions";

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  priority: string;
  date: string;
}

interface DirectMessageItem {
  id: string;
  recipient: string;
  recipientType: string;
  subject: string;
  body: string;
  sentAt: string;
}

interface TeacherMessagesClientProps {
  notices: NoticeItem[];
  directMessages: DirectMessageItem[];
  schoolName: string;
}

export function TeacherMessagesClient({
  notices,
  directMessages: initialDirectMessages,
  schoolName,
}: TeacherMessagesClientProps) {
  const [directMessages, setDirectMessages] = useState<DirectMessageItem[]>(initialDirectMessages);
  const [activeTab, setActiveTab] = useState<"BULLETINS" | "DIRECT">("BULLETINS");
  const [isPending, startTransition] = useTransition();
  const [sentMessageAlert, setSentMessageAlert] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    recipientEmail: "",
    recipientType: "PARENT" as "PARENT" | "STUDENT" | "STAFF",
    subject: "",
    body: "",
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.recipientEmail || !formData.subject || !formData.body) return;

    startTransition(async () => {
      try {
        await sendTeacherMessage(formData);
        const newMsg: DirectMessageItem = {
          id: `temp-${Date.now()}`,
          recipient: formData.recipientEmail,
          recipientType: formData.recipientType,
          subject: formData.subject,
          body: formData.body,
          sentAt: new Date().toISOString().replace("T", " ").slice(0, 16),
        };
        setDirectMessages([newMsg, ...directMessages]);
        setSentMessageAlert("Message successfully dispatched.");
        setTimeout(() => setSentMessageAlert(null), 4000);
        setFormData({
          recipientEmail: "",
          recipientType: "PARENT",
          subject: "",
          body: "",
        });
      } catch (err: any) {
        setSentMessageAlert(`Failed to send: ${err.message}`);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-1">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Communications Hub</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Messages & Institutional Alerts
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Official school announcements and direct teacher-to-parent conversations.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setActiveTab("BULLETINS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "BULLETINS"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-slate-600 dark:text-zinc-400"
            }`}
          >
            School Bulletins ({notices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("DIRECT")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "DIRECT"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-slate-600 dark:text-zinc-400"
            }`}
          >
            Direct Messages ({directMessages.length})
          </button>
        </div>
      </div>

      {sentMessageAlert && (
        <div className="p-3.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{sentMessageAlert}</span>
        </div>
      )}

      {/* View 1: School Bulletins & Alerts */}
      {activeTab === "BULLETINS" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {notices.length > 0 ? (
            notices.map((n) => (
              <div
                key={n.id}
                className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-3 hover:border-emerald-500/50 transition"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      n.priority === "HIGH"
                        ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/60"
                        : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60"
                    }`}
                  >
                    {n.priority === "HIGH" ? "Urgent Priority" : "Official Notice"}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{n.date}</span>
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {n.title}
                </h3>

                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                  {n.content}
                </p>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-2">
              <Bell className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
              <p className="font-bold text-sm text-slate-600 dark:text-zinc-400">
                No school bulletins broadcasted yet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* View 2: Direct Messages & Composer */}
      {activeTab === "DIRECT" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Message History */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              Sent Direct Dispatches
            </h2>

            <div className="space-y-3">
              {directMessages.length > 0 ? (
                directMessages.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60">
                        {m.recipientType}: {m.recipient}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {m.sentAt}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {m.subject}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-zinc-300">
                      {m.body}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-2">
                  <Mail className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
                  <p className="font-bold text-xs text-slate-500">
                    No direct messages logged yet. Use the form to compose one.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right 1 Col: Compose Form */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Direct Dispatch
              </h3>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Recipient Type
                </label>
                <select
                  value={formData.recipientType}
                  onChange={(e) =>
                    setFormData({ ...formData, recipientType: e.target.value as any })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                >
                  <option value="PARENT">Parent / Guardian</option>
                  <option value="STUDENT">Student</option>
                  <option value="STAFF">Colleague Faculty</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="parent@example.com"
                  value={formData.recipientEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, recipientEmail: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mid-term Academic Progress Check"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Message Content
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Write clear operational notes or attendance alerts..."
                  value={formData.body}
                  onChange={(e) =>
                    setFormData({ ...formData, body: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isPending ? "Sending..." : "Dispatch Message"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
