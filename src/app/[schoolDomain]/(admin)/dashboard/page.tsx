"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTenant } from "@/lib/tenant-context";
import { Users, BookOpen, FileText, Plus, Wallet, Calendar } from "lucide-react";
import { getDashboardMetrics, createAdmissionLead } from "./actions";
import NewApplicationModal from "./NewApplicationModal";

export default function TenantDashboard() {
  const tenant = useTenant();

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
      getDashboardMetrics(tenant.id).then((data) => {
        setMetrics(data);
      });
    }
  }, [tenant?.id]);

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
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 
            className="text-2xl md:text-3xl font-extrabold tracking-tight"
            style={{ color: tenant.branding.primaryColor }}
          >
            Welcome to {tenant.name}
          </h2>
          <p className="mt-1 md:mt-2 text-sm md:text-lg text-slate-500 dark:text-zinc-400">
            Administrative overview for your institution.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center w-full md:w-auto gap-2 px-4 py-3 md:py-2.5 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-white rounded-xl font-medium transition-all active:scale-95 shadow-md shadow-slate-200 dark:shadow-none"
        >
          <Plus className="w-5 h-5" />
          <span>New Application</span>
        </button>
      </header>
      
      {/* Dashboard Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* Enrolled Students Card */}
        <Link href={`/${tenant.subdomain}/students`} className="block col-span-2 md:col-span-1 active:scale-[0.98] transition-transform">
          <div 
            className="p-5 md:p-6 rounded-2xl shadow-sm hover:shadow-md transition-all h-full bg-gradient-to-br from-white to-slate-50/50 border border-t-4 border-zinc-200 dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-900/50 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 relative overflow-hidden group"
            style={{ borderTopColor: tenant.branding.primaryColor }}
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
              <BookOpen className="w-32 h-32" />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="font-bold text-xs md:text-sm uppercase tracking-widest text-slate-500 dark:text-zinc-400 truncate pr-2">Pupils/Students Enrolled</h3>
              <div 
                className="p-2 md:p-2.5 rounded-xl shadow-sm" 
                style={{ backgroundColor: `${tenant.branding.primaryColor}15`, color: tenant.branding.primaryColor }}
              >
                <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
              </div>
            </div>
            <p className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 relative z-10">{metrics.enrolledStudents}</p>
          </div>
        </Link>

        {/* Active Staff Card */}
        <div 
          className="col-span-1 active:scale-[0.98] transition-transform p-5 md:p-6 rounded-2xl shadow-sm hover:shadow-md h-full bg-gradient-to-br from-white to-slate-50/50 border border-t-4 border-zinc-200 dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-900/50 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 relative overflow-hidden group"
          style={{ borderTopColor: tenant.branding.primaryColor }}
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Users className="w-32 h-32" />
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 md:mb-4 relative z-10 gap-2 md:gap-0">
            <div 
              className="p-2 rounded-xl shadow-sm w-fit md:order-last" 
              style={{ backgroundColor: `${tenant.branding.primaryColor}15`, color: tenant.branding.primaryColor }}
            >
              <Users className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h3 className="font-bold text-[10px] md:text-sm uppercase tracking-widest text-slate-500 dark:text-zinc-400 leading-tight">Teachers &<br className="md:hidden" /> Staff</h3>
          </div>
          <p className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 relative z-10">{metrics.activeStaff}</p>
        </div>

        {/* Pending Admissions Card */}
        <Link href={`/${tenant.subdomain}/admissions`} className="block col-span-1 active:scale-[0.98] transition-transform">
          <div 
            className="p-5 md:p-6 rounded-2xl shadow-sm hover:shadow-md transition-all h-full bg-gradient-to-br from-white to-slate-50/50 border border-t-4 border-zinc-200 dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-900/50 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 relative overflow-hidden group"
            style={{ borderTopColor: tenant.branding.primaryColor }}
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
              <FileText className="w-32 h-32" />
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 md:mb-4 relative z-10 gap-2 md:gap-0">
              <div 
                className="p-2 rounded-xl shadow-sm w-fit md:order-last" 
                style={{ backgroundColor: `${tenant.branding.primaryColor}15`, color: tenant.branding.primaryColor }}
              >
                <FileText className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <h3 className="font-bold text-[10px] md:text-sm uppercase tracking-widest text-slate-500 dark:text-zinc-400 leading-tight">Pending<br className="md:hidden" /> Registrations</h3>
            </div>
            <p className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 relative z-10">{metrics.pendingApplications}</p>
          </div>
        </Link>

        {/* Termly Revenue Card */}
        {(tenant.userRole === "ADMIN" || tenant.userRole === "BURSAR") && (
          <div 
            className="col-span-2 md:col-span-1 active:scale-[0.98] transition-transform p-5 md:p-6 rounded-2xl shadow-sm hover:shadow-md h-full bg-gradient-to-br from-white to-slate-50/50 border border-t-4 border-zinc-200 dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-900/50 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 relative overflow-hidden group"
            style={{ borderTopColor: tenant.branding.primaryColor }}
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
              <Wallet className="w-32 h-32" />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="font-bold text-xs md:text-sm uppercase tracking-widest text-slate-500 dark:text-zinc-400 truncate pr-2">TERMLY REVENUE</h3>
              <div 
                className="p-2 md:p-2.5 rounded-xl shadow-sm" 
                style={{ backgroundColor: `${tenant.branding.primaryColor}15`, color: tenant.branding.primaryColor }}
              >
                <Wallet className="w-5 h-5 md:w-6 md:h-6" />
              </div>
            </div>
            <p className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 relative z-10">
              ₦{((metrics as any).termlyRevenue || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] md:text-xs font-semibold text-green-600 mt-2 block relative z-10">Verified Payments</span>
          </div>
        )}

        {/* Events This Week Card */}
        <div 
          className="col-span-2 md:col-span-1 active:scale-[0.98] transition-transform p-5 md:p-6 rounded-2xl shadow-sm hover:shadow-md h-full bg-gradient-to-br from-white to-slate-50/50 border border-t-4 border-zinc-200 dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-900/50 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 relative overflow-hidden group"
          style={{ borderTopColor: tenant.branding.primaryColor }}
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Calendar className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="font-bold text-xs md:text-sm uppercase tracking-widest text-slate-500 dark:text-zinc-400 truncate pr-2">Events This Week</h3>
            <div 
              className="p-2 md:p-2.5 rounded-xl shadow-sm" 
              style={{ backgroundColor: `${tenant.branding.primaryColor}15`, color: tenant.branding.primaryColor }}
            >
              <Calendar className="w-5 h-5 md:w-6 md:h-6" />
            </div>
          </div>
          <p className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 relative z-10">8</p>
          <span className="text-[10px] md:text-xs font-semibold text-slate-500 mt-2 block relative z-10">-1 from last week</span>
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
