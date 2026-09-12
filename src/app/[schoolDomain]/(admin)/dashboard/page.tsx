"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTenant } from "@/lib/tenant-context";
import { Users, BookOpen, FileText, Plus, Wallet, Calendar } from "lucide-react";
import { getDashboardMetrics, createAdmissionLead } from "./actions";
import NewApplicationModal from "./NewApplicationModal";

export default function TenantDashboard() {
  const tenant = useTenant();
  const searchParams = useSearchParams();
  const activeTier = searchParams.get("tier") || undefined;

  const [metrics, setMetrics] = useState({
    enrolledStudents: 0,
    activeStaff: 0,
    pendingApplications: 0,
    tiers: [] as any[],
    classrooms: [] as any[],
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchMetrics = useCallback(() => {
    if (tenant?.id) {
      getDashboardMetrics(tenant.id, activeTier).then((data) => {
        setMetrics(data);
      });
    }
  }, [tenant?.id, activeTier]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleCreateLead = async (data: any) => {
    if (tenant?.id) {
      await createAdmissionLead(tenant.id, data);
      fetchMetrics(); // Refresh data real-time
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-200">
      
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0">
          <h2 
            className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight truncate"
            style={{ color: tenant.branding.primaryColor }}
          >
            Welcome to {tenant.name}
          </h2>
          <p className="mt-1 text-xs sm:text-sm md:text-base text-slate-500 dark:text-zinc-400">
            Administrative overview for your institution.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center w-full sm:w-auto gap-2 px-4 py-2.5 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-white rounded-xl font-medium transition-all active:scale-95 shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-xs sm:text-sm font-bold">New Application</span>
        </button>
      </header>
      
      {/* Dashboard Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        
        {/* Enrolled Students Card */}
        <Link href={`/${tenant.subdomain}/students`} className="block col-span-1 active:scale-[0.98] transition-transform">
          <div 
            className="p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md transition-all h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 border-t-4 text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
            style={{ borderTopColor: tenant.branding.primaryColor || "#4f46e5" }}
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
              <BookOpen className="w-32 h-32" />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10 gap-2">
              <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate pr-1">
                Pupils / Students Enrolled
              </h3>
              <div 
                className="p-2 sm:p-2.5 rounded-xl shadow-xs shrink-0" 
                style={{ backgroundColor: `${tenant.branding.primaryColor || "#4f46e5"}18`, color: tenant.branding.primaryColor || "#4f46e5" }}
              >
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white relative z-10 leading-none truncate">
              {metrics.enrolledStudents}
            </p>
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 mt-3 block relative z-10">
              Active Enrolled Roster
            </span>
          </div>
        </Link>

        {/* Active Staff Card */}
        <div 
          className="col-span-1 active:scale-[0.98] transition-transform p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 border-t-4 text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
          style={{ borderTopColor: tenant.branding.primaryColor || "#4f46e5" }}
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Users className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10 gap-2">
            <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate pr-1">
              Teachers & Staff
            </h3>
            <div 
              className="p-2 sm:p-2.5 rounded-xl shadow-xs shrink-0" 
              style={{ backgroundColor: `${tenant.branding.primaryColor || "#4f46e5"}18`, color: tenant.branding.primaryColor || "#4f46e5" }}
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white relative z-10 leading-none truncate">
            {metrics.activeStaff}
          </p>
          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 mt-3 block relative z-10">
            Active Academic & Support Staff
          </span>
        </div>

        {/* Pending Admissions Card */}
        <Link href={`/${tenant.subdomain}/admissions`} className="block col-span-1 active:scale-[0.98] transition-transform">
          <div 
            className="p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md transition-all h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 border-t-4 text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
            style={{ borderTopColor: tenant.branding.primaryColor || "#4f46e5" }}
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
              <FileText className="w-32 h-32" />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10 gap-2">
              <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate pr-1">
                Pending Admissions
              </h3>
              <div 
                className="p-2 sm:p-2.5 rounded-xl shadow-xs shrink-0" 
                style={{ backgroundColor: `${tenant.branding.primaryColor || "#4f46e5"}18`, color: tenant.branding.primaryColor || "#4f46e5" }}
              >
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white relative z-10 leading-none truncate">
              {metrics.pendingApplications}
            </p>
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 mt-3 block relative z-10">
              Awaiting Review & Placement
            </span>
          </div>
        </Link>

        {/* Termly Revenue Card */}
        {(tenant.userRole === "ADMIN" || tenant.userRole === "BURSAR") && (
          <div 
            className="col-span-1 active:scale-[0.98] transition-transform p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 border-t-4 text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
            style={{ borderTopColor: tenant.branding.primaryColor || "#4f46e5" }}
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
              <Wallet className="w-32 h-32" />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10 gap-2">
              <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate pr-1">
                Termly Revenue
              </h3>
              <div 
                className="p-2 sm:p-2.5 rounded-xl shadow-xs shrink-0" 
                style={{ backgroundColor: `${tenant.branding.primaryColor || "#4f46e5"}18`, color: tenant.branding.primaryColor || "#4f46e5" }}
              >
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white relative z-10 leading-none truncate">
              ₦{((metrics as any).termlyRevenue || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-3 block relative z-10">
              Verified Fee Payments
            </span>
          </div>
        )}

        {/* Events This Week Card */}
        <div 
          className="col-span-1 active:scale-[0.98] transition-transform p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 border-t-4 text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
          style={{ borderTopColor: tenant.branding.primaryColor || "#4f46e5" }}
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Calendar className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10 gap-2">
            <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate pr-1">
              Events This Week
            </h3>
            <div 
              className="p-2 sm:p-2.5 rounded-xl shadow-xs shrink-0" 
              style={{ backgroundColor: `${tenant.branding.primaryColor || "#4f46e5"}18`, color: tenant.branding.primaryColor || "#4f46e5" }}
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white relative z-10 leading-none truncate">
            8
          </p>
          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 mt-3 block relative z-10">
            Scheduled on Timetable
          </span>
        </div>

      </div>
      
      <NewApplicationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        tiers={metrics.tiers} 
        classrooms={metrics.classrooms}
        onSubmit={handleCreateLead}
      />
    </div>
  );
}
