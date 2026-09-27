"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, Building2, ExternalLink, ShieldAlert, CheckCircle2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  link: string;
  type: string;
  read: boolean;
  metadata?: any;
  createdAt: string;
}

function computeTimeAgo(dateStr: string): string {
  if (!dateStr) return "Just now";
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 45) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function AdminNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/admin/notifications?limit=25", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(Number(data.unreadCount || 0));
      }
    } catch (err) {
      console.error("[NOTIFICATION_FETCH_ERROR]:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, link: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error("[MARK_AS_READ_ERROR]:", err);
    }

    setIsOpen(false);
    if (link) {
      router.push(link);
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch (err) {
      console.error("[MARK_ALL_READ_ERROR]:", err);
    } finally {
      setLoading(false);
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "TENANT_REGISTERED":
        return <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "TENANT_SUSPENDED":
        return <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "TENANT_ACTIVATED":
        return <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "TENANT_DELETED":
        return <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      default:
        return <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Icon Trigger */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        aria-label="Platform Notifications"
        className="relative p-2 rounded-full text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-rose-600 rounded-full border-2 border-white dark:border-zinc-900 animate-in zoom-in-50 duration-150">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-zinc-100">
                Platform Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Mark all as read
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  No notifications yet
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Platform events and new tenant registrations will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const timeAgoStr = computeTimeAgo(item.createdAt);
                // Extract school name if available
                const schoolName =
                  item.metadata?.schoolName ||
                  item.title.replace(/^New tenant registered:\s*/i, "");

                // Requirement 2 exact text: "New tenant registered: [School Name] - [time ago]"
                const displayTitle = item.type === "TENANT_REGISTERED"
                  ? `New tenant registered: ${schoolName} - ${timeAgoStr}`
                  : `${item.title} - ${timeAgoStr}`;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleMarkAsRead(item.id, item.link || "/admin/tenants")}
                    className={`px-4 py-3 cursor-pointer transition-colors flex items-start gap-3 text-left ${
                      !item.read
                        ? "bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5 border border-slate-200/60 dark:border-zinc-700/60">
                      {getItemIcon(item.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p
                          className={`text-xs leading-snug line-clamp-2 ${
                            !item.read
                              ? "font-bold text-slate-900 dark:text-white"
                              : "font-medium text-slate-700 dark:text-zinc-300"
                          }`}
                        >
                          {displayTitle}
                        </p>
                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0 ml-1.5" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {timeAgoStr}
                        </span>
                        {item.metadata?.subdomain && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                            {item.metadata.subdomain}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/50 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/admin/tenants");
              }}
              className="w-full py-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              View All Tenants <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
