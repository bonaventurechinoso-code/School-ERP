"use client";

import React, { useState } from "react";
import { CommunicationsData, TierPresentationConfig } from "../types";
import { 
  Bell, 
  Megaphone, 
  Mail, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  ArrowRight,
  Info,
  AlertTriangle,
  Send,
  MessageSquare
} from "lucide-react";

interface CommunicationsModuleProps {
  communications: CommunicationsData;
  tierConfig: TierPresentationConfig;
}

type FeedFilter = "ALL" | "ANNOUNCEMENTS" | "NOTIFICATIONS" | "MESSAGES";

export function CommunicationsModule({ communications, tierConfig }: CommunicationsModuleProps) {
  const [activeTab, setActiveTab] = useState<FeedFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const { notices, messages, systemNotifications } = communications;

  // Filter items based on active tab & query
  const filteredNotices = notices.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMessages = messages.filter(m => 
    m.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSys = systemNotifications.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = notices.length + messages.length + systemNotifications.length;

  return (
    <div className="space-y-5 w-full">
      {/* Feed Controls Header: Elevated SaaS White Card with Gradient Accent */}
      <div className="bg-gradient-to-r from-purple-50/50 via-white to-white dark:from-purple-950/20 dark:via-zinc-900 dark:to-zinc-900 rounded-xl p-4 sm:p-6 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/80 dark:border-zinc-800 space-y-4 relative overflow-hidden before:absolute before:top-0 before:inset-x-0 before:h-1 before:bg-gradient-to-r before:from-purple-500 before:to-indigo-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Communications & Live Feed
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  {totalUnread} Updates
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Audience focus: <strong className="text-slate-700 dark:text-zinc-300 font-semibold">{tierConfig.audienceFocus}</strong>
              </p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notices & messages..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800/80 border-0 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        {/* Feed Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-slate-100 dark:border-zinc-800 pt-3 scrollbar-none">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
              activeTab === "ALL"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            All Updates ({totalUnread})
          </button>
          <button
            onClick={() => setActiveTab("ANNOUNCEMENTS")}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
              activeTab === "ANNOUNCEMENTS"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            School Announcements ({notices.length})
          </button>
          <button
            onClick={() => setActiveTab("NOTIFICATIONS")}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
              activeTab === "NOTIFICATIONS"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            System Alerts ({systemNotifications.length})
          </button>
          <button
            onClick={() => setActiveTab("MESSAGES")}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
              activeTab === "MESSAGES"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            Messaging Logs ({messages.length})
          </button>
        </div>
      </div>

      {/* Feed Stream Content */}
      <div className="space-y-3.5">
        {/* 1. School Announcement Alerts */}
        {(activeTab === "ALL" || activeTab === "ANNOUNCEMENTS") && (
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5 px-1">
              <Megaphone className="w-3.5 h-3.5 text-indigo-600" />
              <span>Institutional Announcements & Notices</span>
            </h4>

            {filteredNotices.length === 0 ? (
              <p className="text-xs text-slate-400 p-4 bg-white dark:bg-zinc-900 rounded-xl shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/60 dark:border-zinc-800">
                No school announcements match your filter.
              </p>
            ) : (
              filteredNotices.map((notice) => (
                <div
                  key={notice.id}
                  className="bg-white dark:bg-zinc-900 rounded-xl p-4 sm:p-5 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/60 dark:border-zinc-800 hover:shadow-md transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          notice.priority === "HIGH"
                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                            : notice.priority === "NORMAL"
                            ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                            : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                        }`}
                      >
                        {notice.priority} Priority
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                        Target: {notice.targetAudience}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {notice.publishedAt}
                    </span>
                  </div>

                  <h5 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                    {notice.title}
                  </h5>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {notice.content}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. System Notifications */}
        {(activeTab === "ALL" || activeTab === "NOTIFICATIONS") && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5 px-1">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
              <span>System Security & Database Notifications</span>
            </h4>

            {filteredSys.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/60 dark:border-zinc-800 flex items-start gap-3.5"
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    item.level === "SUCCESS"
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                      : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                  }`}
                >
                  {item.level === "SUCCESS" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Info className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                      {item.title}
                    </h5>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                    {item.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. Individual Messaging Logs */}
        {(activeTab === "ALL" || activeTab === "MESSAGES") && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5 px-1">
              <Mail className="w-3.5 h-3.5 text-emerald-600" />
              <span>Individual Messaging Logs (Email & SMS Dispatches)</span>
            </h4>

            {filteredMessages.length === 0 ? (
              <p className="text-xs text-slate-400 p-4 bg-white dark:bg-zinc-900 rounded-xl shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/60 dark:border-zinc-800">
                No direct messages logged for this profile.
              </p>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-white dark:bg-zinc-900 rounded-xl p-4 sm:p-5 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/60 dark:border-zinc-800 hover:shadow-md transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        {msg.messageType} Channel
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                        To: {msg.recipientEmail} ({msg.recipientType})
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                      {msg.sentAt}
                    </span>
                  </div>

                  <h5 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                    {msg.subject}
                  </h5>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-lg">
                    {msg.body}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
