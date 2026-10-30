"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { AcademicTier } from "@prisma/client";
import NewApplicationModal from "./NewApplicationModal";
import { createAdmissionLead, getClassroomsForTenant } from "./actions";

import NotificationBell, { TenantNotificationItem } from "./NotificationBell";

interface DashboardClientHeaderProps {
  schoolName: string;
  primaryColor?: string;
  schoolId: string;
  activeTier?: string;
  tiers: AcademicTier[];
  classrooms?: any[];
  notifications?: TenantNotificationItem[];
  schoolDomain?: string;
}

export default function DashboardClientHeader({
  schoolName,
  primaryColor = "#0f172a",
  schoolId,
  activeTier,
  tiers,
  classrooms: initialClassrooms = [],
  notifications = [],
  schoolDomain = "",
}: DashboardClientHeaderProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [classrooms, setClassrooms] = useState<any[]>(initialClassrooms);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    if (classrooms.length === 0 && schoolId) {
      getClassroomsForTenant(schoolId, activeTier).then((data) => {
        if (data && data.length > 0) setClassrooms(data);
      });
    }
  };

  const handleOpenAiChat = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-institutional-ai"));
    }
  };

  const handleCreateLead = async (data: any) => {
    if (schoolId) {
      await createAdmissionLead(schoolId, data);
      // Trigger background re-render of Server Components without full page refresh
      router.refresh();
    }
  };

  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-2xs w-full max-w-full overflow-hidden">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 dark:text-indigo-400">
              Institutional Command Center
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50 break-words line-clamp-2">
            Welcome to {schoolName}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Real-time administrative metrics, academic tracking, and institutional actions.
          </p>
        </div>

        {/* Unified Top Utility Actions Toolbar */}
        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 flex-wrap">
          {/* Notification Bell */}
          <NotificationBell
            notifications={notifications}
            schoolDomain={schoolDomain}
          />

          {/* Ask Institutional AI Trigger */}
          <button
            type="button"
            onClick={handleOpenAiChat}
            className="flex-1 sm:flex-none min-w-[130px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700/80 font-bold text-xs transition-all active:scale-95 shadow-2xs group cursor-pointer"
            title="Open Institutional AI Assistant"
          >
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>Ask Institutional AI</span>
          </button>

          {/* New Application Trigger */}
          <button 
            type="button"
            onClick={handleOpenModal}
            className="flex-1 sm:flex-none min-w-[130px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-xs shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Application</span>
          </button>
        </div>
      </header>

      <NewApplicationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        tiers={tiers} 
        classrooms={classrooms}
        onSubmit={handleCreateLead}
      />
    </>
  );
}
