"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  Building2,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  Eye,
} from "lucide-react";
import { INITIAL_SCHOOLS } from "../mock-data";

export default function StudentsCrossTenantsPage() {
  const totalStudents = INITIAL_SCHOOLS.reduce((acc, curr) => acc + curr.studentsCount, 0);
  const avgStudents = Math.round(totalStudents / INITIAL_SCHOOLS.length);
  const largestSchool = [...INITIAL_SCHOOLS].sort((a, b) => b.studentsCount - a.studentsCount)[0];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Students Across All Tenant Campuses
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {totalStudents.toLocaleString()} Enrolled
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Aggregated census and student enrolment distribution across all registered Nigerian multi-tenant instances.
          </p>
        </div>

        <Link
          href="/dashboard/super-admin/tenants"
          className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors shadow-sm inline-flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Building2 className="w-4 h-4 text-slate-500" />
          <span>View All Campuses</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Enrolled Students
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {totalStudents.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">
            +12.4% MoM new admissions
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Average Campus Enrolment
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 mt-2">
            {avgStudents}
          </div>
          <div className="text-xs text-slate-500 mt-1">Students per institution</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Largest Enrolment
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-600 mt-2">
            {largestSchool.studentsCount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1 truncate">{largestSchool.name}</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Student Portal Engagement
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2">
            98.4%
          </div>
          <div className="text-xs text-slate-500 mt-1">Active report card & CBT logins</div>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Student Population by Institution
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live census breakdown per school tenant
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
            {INITIAL_SCHOOLS.length} Campuses
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">School Name & Code</th>
                <th className="py-3.5 px-4">Tier</th>
                <th className="py-3.5 px-4">Students Enrolled</th>
                <th className="py-3.5 px-4">Capacity Utilization</th>
                <th className="py-3.5 px-4">Subscription Status</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {INITIAL_SCHOOLS.map((school) => {
                const maxCapacity =
                  school.tier === "Enterprise"
                    ? 2000
                    : school.tier === "Premium"
                    ? 1000
                    : school.tier === "Basic"
                    ? 400
                    : 100;
                const percentage = Math.min(100, Math.round((school.studentsCount / maxCapacity) * 100));

                return (
                  <tr key={school.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <Link
                        href={`/dashboard/super-admin/tenants/${school.code.toLowerCase()}`}
                        className="font-bold text-slate-900 hover:text-blue-600 transition-colors block"
                      >
                        {school.name}
                      </Link>
                      <div className="text-xs text-slate-500 font-mono">
                        {school.code} • Subdomain: {school.subdomain}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {school.tier}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-bold text-slate-900 font-mono">
                      {school.studentsCount.toLocaleString()}
                    </td>

                    <td className="py-4 px-4 w-48">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span>{percentage}%</span>
                          <span className="text-[10px] text-slate-400">of {maxCapacity} cap</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              percentage > 80
                                ? "bg-amber-500"
                                : "bg-blue-600"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          school.subscriptionStatus === "Active"
                            ? "bg-emerald-50 text-emerald-700"
                            : school.subscriptionStatus === "Pending Verification"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {school.subscriptionStatus}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <Link
                        href={`/dashboard/super-admin/tenants/${school.code.toLowerCase()}`}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
