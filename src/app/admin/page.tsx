import { createSchool, toggleSchoolStatus } from "./actions";
import Link from "next/link";
import DeleteSchoolForm from "./DeleteSchoolForm";
import { PhoneInput } from "@/components/PhoneInput";
import { Server, Users, ShieldCheck, Power, Settings } from "lucide-react";

const ACADEMIC_TIERS_OPTIONS = [
  { id: "DAYCARE", label: "Nursery / Early Care / Daycare" },
  { id: "PRIMARY", label: "Primary School" },
  { id: "SECONDARY", label: "Secondary School" },
  { id: "PRIMARY_SECONDARY", label: "Combined Primary & Secondary School" },
  { id: "COMBINED_NURSERY_PRIMARY_SECONDARY", label: "Combined Nursery, Primary & Secondary" },
  { id: "UNIVERSITY", label: "Higher Ed: University" },
  { id: "POLYTECHNIC", label: "Higher Ed: Polytechnic" },
  { id: "COLLEGE_OF_EDUCATION", label: "Higher Ed: College of Education" }
];

const API_URL = process.env.NEXT_PUBLIC_DJANGO_API_URL || "http://localhost:8000/api/v1";

const getTenantUrl = (subdomain: string) => {
  if (process.env.NODE_ENV === "development") {
    return `/dashboard?mockTenant=${subdomain}`;
  }
  return `https://${subdomain}.schoolerp.com/dashboard`;
};

import { basePrisma } from "@/lib/tenant-prisma";

export default async function AdminDashboardPage() {
  let schools: any[] = [];
  try {
    const dbSchools = await basePrisma.school.findMany({
      include: {
        academicTiers: true,
        _count: {
          select: { students: true, staff: true }
        }
      }
    });
    
    schools = dbSchools.map((s) => ({
      ...s,
      students_count: s._count.students,
      staff_count: s._count.staff,
      academic_tiers: s.academicTiers.map(t => ({ name: t.name, id: t.id }))
    }));
  } catch (e) {
    console.error("Fetch error:", e);
  }

  const totalStudents = schools.reduce((acc, school) => acc + (school.students_count || 0), 0);

  return (
    <div className="space-y-8 bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-200 min-h-screen p-4 md:p-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-zinc-500 bg-clip-text text-transparent">
            Platform Administration
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Manage institutional tenants and global settings
          </p>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <Server className="w-32 h-32 text-indigo-600" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Total Tenants</h3>
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white mt-4 relative z-10">{schools.length}</p>
        </div>

        <div className="p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <Users className="w-32 h-32 text-blue-600" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Active Students</h3>
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white mt-4 relative z-10">{totalStudents}</p>
        </div>

        <div className="p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <ShieldCheck className="w-32 h-32 text-emerald-600" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Platform Status</h3>
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-4 relative z-10">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)]"></div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">Online</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* NEW TENANT FORM */}
        <section className="p-6 md:p-8 rounded-2xl shadow-sm border xl:col-span-1 relative bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 transition-colors duration-200">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 rounded-t-2xl"></div>
          <h3 className="text-xl font-bold mb-6 tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-500" />
            Register New School
          </h3>
          <form action={createSchool} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">School Name *</label>
              <input type="text" name="name" className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none placeholder-slate-400 dark:placeholder-zinc-600" placeholder="e.g., Riverside High" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Subdomain *</label>
              <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-shadow">
                <input type="text" name="subdomain" className="w-full bg-slate-50/50 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 p-3 outline-none placeholder-slate-400 dark:placeholder-zinc-600" placeholder="riverside" required />
                <span className="bg-slate-100 dark:bg-zinc-800 p-3 text-slate-500 dark:text-zinc-400 text-sm font-medium border-l border-slate-200 dark:border-zinc-800">.schoolerp.com</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Admin Email *</label>
              <input type="email" name="adminEmail" className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none placeholder-slate-400 dark:placeholder-zinc-600" placeholder="admin@riverside.edu" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Contact Phone</label>
              <PhoneInput name="contactPhone" maxLength={14} className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none placeholder-slate-400 dark:placeholder-zinc-600" placeholder="+155500000000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Institution Subtype / Tiers *</label>
              <div className="space-y-2.5 p-4 rounded-xl bg-slate-50/80 dark:bg-zinc-800/30 border border-slate-200/80 dark:border-zinc-800/80">
                {ACADEMIC_TIERS_OPTIONS.map(tier => (
                  <label key={tier.id} className="flex items-start space-x-3 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <div className="pt-0.5">
                      <input type="checkbox" name="tiers" value={tier.id} className="rounded border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                    </div>
                    <span className="font-medium">{tier.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3.5 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all mt-4 flex justify-center items-center gap-2">
              Provision Tenant Workspace
            </button>
          </form>
        </section>

        {/* TENANTS DIRECTORY */}
        <section className="p-6 md:p-8 rounded-2xl shadow-sm border xl:col-span-2 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 transition-colors duration-200 flex flex-col">
          <h3 className="text-xl font-bold mb-6 tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-500" />
            Registered Tenants
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800/80 shadow-sm flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">School Name</th>
                  <th className="px-5 py-4 font-semibold">Subdomain</th>
                  <th className="px-5 py-4 font-semibold">Metadata Types</th>
                  <th className="px-5 py-4 font-semibold text-center">Students</th>
                  <th className="px-5 py-4 font-semibold text-center">Staff</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {schools.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500 dark:text-zinc-500 italic">
                      No tenants registered yet. Use the form to provision one.
                    </td>
                  </tr>
                ) : (
                  schools.map(school => (
                    <tr key={school.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors bg-white dark:bg-zinc-900 group">
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{school.name}</td>
                      <td className="px-5 py-4">
                        <a href={getTenantUrl(school.subdomain)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline transition-colors font-medium">
                          {school.subdomain}
                        </a>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {school.academic_tiers?.map((tier: any) => {
                            let badgeStyle = "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700";
                            let displayLabel = tier.name;
                            
                            if (tier.name === "DAYCARE") {
                              badgeStyle = "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20";
                              displayLabel = "Daycare";
                            } else if (tier.name === "PRIMARY_SECONDARY") {
                              badgeStyle = "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";
                              displayLabel = "K-12";
                            } else if (tier.name === "COMBINED_NURSERY_PRIMARY_SECONDARY") {
                              badgeStyle = "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20";
                              displayLabel = "Nursery + K-12";
                            } else if (tier.name === "UNIVERSITY" || tier.name === "POLYTECHNIC" || tier.name === "COLLEGE_OF_EDUCATION") {
                              badgeStyle = "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20";
                              if (tier.name === "UNIVERSITY") displayLabel = "University";
                              if (tier.name === "POLYTECHNIC") displayLabel = "Polytechnic";
                              if (tier.name === "COLLEGE_OF_EDUCATION") displayLabel = "College of Ed";
                            } else if (tier.name === "PRIMARY") {
                              badgeStyle = "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20";
                              displayLabel = "Primary";
                            } else if (tier.name === "SECONDARY") {
                              badgeStyle = "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20";
                              displayLabel = "Secondary";
                            }

                            return (
                              <span key={tier.id} className={`${badgeStyle} text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border shadow-sm`}>
                                {displayLabel}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center font-mono text-slate-600 dark:text-zinc-400">{school.students_count || 0}</td>
                      <td className="px-5 py-4 text-center font-mono text-slate-600 dark:text-zinc-400">{school.staff_count || 0}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border shadow-sm ${school.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'}`}>
                          {school.is_active ? (
                            <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span> ACTIVE</>
                          ) : (
                            <><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span> SUSPENDED</>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <form action={toggleSchoolStatus.bind(null, school.id, school.is_active)}>
                            <button 
                              type="submit" 
                              title={school.is_active ? "Suspend Tenant" : "Activate Tenant"}
                              className={`p-1.5 rounded-md transition-colors focus:ring-2 outline-none ${school.is_active ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 focus:ring-slate-400' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-500 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/20 focus:ring-emerald-500'}`}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </form>
                          <DeleteSchoolForm schoolId={school.id} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Clean Padded Footer Container */}
      <div className="mt-8 flex justify-end">
        <Link 
          href="/" 
          className="bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 px-6 py-2.5 rounded-xl shadow-sm text-sm font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all border border-slate-200 dark:border-zinc-800 flex items-center gap-2 outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
