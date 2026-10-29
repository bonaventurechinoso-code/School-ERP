"use client";

import React, { useState } from "react";
import { CheckCircle2, X } from "lucide-react";

export interface ReactivationBannerProps {
  notification: {
    id: string;
    title: string;
    message: string;
    createdAt?: any;
  };
  schoolDomain: string;
}

export default function ReactivationBanner({
  notification,
  schoolDomain,
}: ReactivationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await fetch(`/api/${schoolDomain}/notifications/${notification.id}/read`, {
        method: "POST",
      });
    } catch (e) {
      console.warn("Failed to mark notification as read:", e);
    }
  };

  return (
    <div className="bg-emerald-500/10 border-2 border-emerald-500 text-emerald-950 dark:text-emerald-100 dark:border-emerald-500/80 p-4 sm:p-5 rounded-2xl flex items-start justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <p className="font-black text-sm sm:text-base text-emerald-900 dark:text-emerald-200">
            {notification.title || "🎉 Subscription Reactivated!"}
          </p>
          <p className="text-xs sm:text-sm text-emerald-800/90 dark:text-emerald-300 leading-relaxed font-medium">
            {notification.message}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="p-1.5 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-lg transition shrink-0"
        title="Dismiss Notification"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

