"use client";

import React, { useState, useTransition } from "react";
import {
  LifeBuoy,
  Send,
  HelpCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  PhoneCall,
  ExternalLink,
} from "lucide-react";
import { submitTeacherSupportTicket } from "../actions";

interface TicketItem {
  id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
}

interface TeacherSupportClientProps {
  initialTickets: TicketItem[];
  schoolName: string;
  teacherEmail: string;
}

export function TeacherSupportClient({
  initialTickets,
  schoolName,
  teacherEmail,
}: TeacherSupportClientProps) {
  const [tickets, setTickets] = useState<TicketItem[]>(initialTickets);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Portal & Gradebook");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [ticketAlert, setTicketAlert] = useState<string | null>(null);

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) return;

    startTransition(async () => {
      try {
        await submitTeacherSupportTicket({ subject, category, description });
        const newTicket: TicketItem = {
          id: `temp-${Date.now()}`,
          subject,
          category,
          description,
          status: "IN_PROGRESS",
          createdAt: new Date().toISOString().split("T")[0],
        };
        setTickets([newTicket, ...tickets]);
        setTicketAlert("Support ticket successfully logged. IT Support has been notified.");
        setTimeout(() => setTicketAlert(null), 4000);
        setSubject("");
        setDescription("");
      } catch (err: any) {
        setTicketAlert(`Failed to log ticket: ${err.message}`);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-1">
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Platform Helpdesk</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Teacher Support & Help Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Submit IT tickets, report timetable clashes, or review portal operating guides.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-zinc-400">
          <PhoneCall className="w-4 h-4 text-emerald-600" />
          <span>Internal Ext: #404 (Admin Desk)</span>
        </div>
      </div>

      {ticketAlert && (
        <div className="p-3.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{ticketAlert}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Submit Form & Ticket History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submit New Ticket */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              Log an IT or Academic Support Ticket
            </h3>

            <form onSubmit={handleSubmitTicket} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Inquiry Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                  >
                    <option value="Portal & Gradebook">Portal & Gradebook Entry</option>
                    <option value="Timetable Clash">Timetable or Room Allocation</option>
                    <option value="Attendance Register">Attendance Correction</option>
                    <option value="Hardware / Projector">Classroom Audio/Visual Tech</option>
                    <option value="General Inquiry">General Administrative Query</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Subject Summary
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Discrepancy in JSS 1 Mathematics Gradebook"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Detailed Issue Description
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide classroom name, student details, or error messages encountered..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isPending ? "Logging Ticket..." : "Submit Support Ticket"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Ticket History */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              My Support Inquiries ({tickets.length})
            </h3>

            <div className="space-y-3">
              {tickets.length > 0 ? (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700/60 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded-md bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200">
                        {t.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          t.status === "RESOLVED"
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700"
                            : "bg-amber-100 dark:bg-amber-950 text-amber-700"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 dark:text-white">
                      {t.subject}
                    </h4>

                    <p className="text-slate-600 dark:text-zinc-400">
                      {t.description}
                    </p>

                    <div className="text-[10px] text-slate-400 font-mono pt-1">
                      Logged on: {t.createdAt}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  You have no active support tickets.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: FAQs & Quick Links */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                Teacher Help & FAQs
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700/60 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">
                  How does grading score compilation work?
                </p>
                <p className="text-slate-500 dark:text-zinc-400">
                  Continuous Assessment is calculated as CA1 (20 pts) + CA2 (20 pts) + Terminal Exam (60 pts) for a total score out of 100.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700/60 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">
                  How do I export class attendance?
                </p>
                <p className="text-slate-500 dark:text-zinc-400">
                  Navigate to Attendance, pick the desired class and date, and click the &quot;Export CSV&quot; button in the header.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700/60 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">
                  What if my timetable has a room clash?
                </p>
                <p className="text-slate-500 dark:text-zinc-400">
                  Log a ticket under &quot;Timetable Clash&quot; category with the period start time and room name so Academic Admin can reallocate.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
