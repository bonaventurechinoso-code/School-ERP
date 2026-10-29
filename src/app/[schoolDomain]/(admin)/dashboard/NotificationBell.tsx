"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bell, Check, Sparkles } from "lucide-react";

export interface TenantNotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string | null;
}

export default function NotificationBell({
  notifications: initialNotifications = [],
  schoolDomain,
}: {
  notifications: TenantNotificationItem[];
  schoolDomain: string;
}) {
  const [notifications, setNotifications] = useState<TenantNotificationItem[]>(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    try {
      await fetch(`/api/${schoolDomain}/notifications/${id}/read`, {
        method: "POST",
      });
    } catch (e) {
      console.warn("Failed to mark notification as read:", e);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700/80 transition shadow-2xs active:scale-95 cursor-pointer"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[9px] font-bold text-white items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  {unreadCount} new
                </span>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
                No notifications
              </div>
            ) : (
              notifications.map((n) => {
                const isReactivated = n.type === "SUBSCRIPTION_REACTIVATED";
                return (
                  <div
                    key={n.id}
                    className={`p-3.5 transition flex items-start gap-3 ${
                      !n.isRead
                        ? isReactivated
                          ? "bg-emerald-500/5 dark:bg-emerald-500/10"
                          : "bg-slate-50 dark:bg-zinc-800/40"
                        : "bg-white dark:bg-zinc-900 opacity-80"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isReactivated
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {n.title}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {new Date(n.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(n.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded transition shrink-0"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

