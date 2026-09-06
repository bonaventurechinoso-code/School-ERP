"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTenant } from "@/lib/tenant-context";
import { Users, GraduationCap, FileText, Plus } from "lucide-react";
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
      
      {/* Dashboard Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 
            className="text-3xl font-extrabold tracking-tight"
            style={{ color: tenant.branding.primaryColor }}
          >
            Welcome to {tenant.name}
          </h2>
          <p className="mt-2 text-lg text-slate-500 dark:text-zinc-400">
            Administrative overview for your institution.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-white rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>New Application</span>
        </button>
      </header>
      
      {/* Dashboard Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Enrolled Students Card */}
        <Link href={`/${tenant.subdomain}/students`} className="block">
          <div 
            className="p-6 rounded-2xl shadow-sm border border-t-4 hover:shadow-md transition-shadow h-full bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
            style={{ borderTopColor: tenant.branding.primaryColor }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-zinc-400">Total Enrolled</h3>
              <div 
                className="p-2 rounded-xl" 
                style={{ backgroundColor: `${tenant.branding.primaryColor}15`, color: tenant.branding.primaryColor }}
              >
                <GraduationCap className="w-6 h-6" />
              </div>
            </div>
            <p className="text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">{metrics.enrolledStudents}</p>
          </div>
        </Link>

        {/* Active Staff Card */}
        <div 
          className="p-6 rounded-2xl shadow-sm border border-t-4 hover:shadow-md transition-shadow h-full bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
          style={{ borderTopColor: tenant.branding.primaryColor }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-zinc-400">Active Staff</h3>
            <div 
              className="p-2 rounded-xl" 
              style={{ backgroundColor: `${tenant.branding.primaryColor}15`, color: tenant.branding.primaryColor }}
            >
              <Users className="w-6 h-6" />
            </div>
          </div>
          <p className="text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">{metrics.activeStaff}</p>
        </div>

        {/* Pending Admissions Card */}
        <Link href={`/${tenant.subdomain}/admissions`} className="block">
          <div 
            className="p-6 rounded-2xl shadow-sm border border-t-4 hover:shadow-md transition-shadow h-full bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
            style={{ borderTopColor: tenant.branding.primaryColor }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-zinc-400">Pending Admissions</h3>
              <div 
                className="p-2 rounded-xl" 
                style={{ backgroundColor: `${tenant.branding.primaryColor}15`, color: tenant.branding.primaryColor }}
              >
                <FileText className="w-6 h-6" />
              </div>
            </div>
            <p className="text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">{metrics.pendingApplications}</p>
          </div>
        </Link>

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
