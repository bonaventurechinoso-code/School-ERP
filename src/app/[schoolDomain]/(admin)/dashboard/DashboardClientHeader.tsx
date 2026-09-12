"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { AcademicTier } from "@prisma/client";
import NewApplicationModal from "./NewApplicationModal";
import { createAdmissionLead, getClassroomsForTenant } from "./actions";

interface DashboardClientHeaderProps {
  schoolName: string;
  primaryColor?: string;
  schoolId: string;
  activeTier?: string;
  tiers: AcademicTier[];
  classrooms?: any[];
}

export default function DashboardClientHeader({
  schoolName,
  primaryColor = "#0f172a",
  schoolId,
  activeTier,
  tiers,
  classrooms: initialClassrooms = [],
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

  const handleCreateLead = async (data: any) => {
    if (schoolId) {
      await createAdmissionLead(schoolId, data);
      // Trigger background re-render of Server Components without full page refresh
      router.refresh();
    }
  };

  return (
    <>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0">
          <h2 
            className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight truncate"
            style={{ color: primaryColor }}
          >
            Welcome to {schoolName}
          </h2>
          <p className="mt-1 text-xs sm:text-sm md:text-base text-slate-500 dark:text-zinc-400">
            Administrative overview for your institution.
          </p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="flex items-center justify-center w-full sm:w-auto gap-2 px-4 py-2.5 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-white rounded-xl font-medium transition-all active:scale-95 shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-xs sm:text-sm font-bold">New Application</span>
        </button>
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
