import { toggleSchoolStatus } from "../actions";
import Link from "next/link";
import DeleteSchoolForm from "../DeleteSchoolForm";
import EditSchoolModal from "../EditSchoolModal";
import RegisterSchoolForm from "./RegisterSchoolForm";
import { Server, Users, ShieldCheck, Settings, Plus, Building2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { basePrisma } from "@/lib/tenant-prisma";

export const dynamic = "force-dynamic";

const BASE_PLATFORM_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.BASE_URL ||
  "https://bonaveeict.com.ng"
).replace(/\/$/, "");

const getTenantUrl = (subdomain: string) => {
  const cleanSlug = (subdomain || "").trim().toLowerCase();
  if (!cleanSlug) return "#";
  return `${BASE_PLATFORM_URL}/${cleanSlug}/dashboard`;
};

const getTenantLoginUrl = (subdomain: string) => {
  const cleanSlug = (subdomain || "").trim().toLowerCase();
  if (!cleanSlug) return "#";
  return `${BASE_PLATFORM_URL}/${cleanSlug}/login`;
};

function getTierBadge(tierName: string) {
  const norm = (tierName || "").trim();
  const upperName = norm.toUpperCase();

  // 13 Standalone Academic Tiers
  if (upperName === "CRECHE / DAYCARE" || upperName === "CRECHE" || upperName === "DAYCARE / CRECHE") {
    return {
      style: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
      label: "Creche / Daycare",
    };
  }
  if (upperName === "NURSERY / KINDERGARTEN" || upperName === "KINDERGARTEN") {
    return {
      style: "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20",
      label: "Nursery / Kindergarten",
    };
  }
  if (upperName.includes("JUNIOR SECONDARY") || upperName === "JSS") {
    return {
      style: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20",
      label: "Junior Secondary School",
    };
  }
  if (upperName.includes("SENIOR SECONDARY") || upperName === "SSS") {
    return {
      style: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
      label: "Senior Secondary School",
    };
  }
  if (upperName.includes("TECHNICAL") || upperName.includes("VOCATIONAL")) {
    return {
      style: "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20",
      label: "Technical / Vocational School",
    };
  }
  if (upperName.includes("ISLAMIYYA") || upperName.includes("QURANIC")) {
    return {
      style: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
      label: "Islamiyya / Quranic School",
    };
  }
  if (upperName.includes("MONOTECHNIC")) {
    return {
      style: "bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-500/20",
      label: "Monotechnic",
    };
  }
  if (upperName.includes("NURSING") || upperName.includes("HEALTH SCIENCES")) {
    return {
      style: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
      label: "College of Nursing / Health Sciences",
    };
  }
  if (upperName.includes("POSTGRADUATE") || upperName.includes("PROFESSIONAL / POSTGRADUATE")) {
    return {
      style: "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
      label: "Professional / Postgraduate Institute",
    };
  }
  if (upperName === "UNIVERSITY" || upperName === "HIGHER ED: UNIVERSITY") {
    return {
      style: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
      label: "University",
    };
  }
  if (upperName === "POLYTECHNIC" || upperName === "HIGHER ED: POLYTECHNIC") {
    return {
      style: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20",
      label: "Polytechnic",
    };
  }
  if (upperName === "COLLEGE OF EDUCATION" || upperName === "HIGHER ED: COLLEGE OF EDUCATION" || upperName === "COLLEGE_OF_EDUCATION") {
    return {
      style: "bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-500/20",
      label: "College of Education",
    };
  }
  if (upperName === "PRIMARY SCHOOL" || upperName === "PRIMARY") {
    return {
      style: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
      label: "Primary School",
    };
  }

  // Legacy mappings for existing tenant records
  if (
    upperName === "DAYCARE" ||
    upperName === "NURSERY" ||
    upperName === "DAYCARE / NURSERY" ||
    upperName === "DAY CARE / NURSERY" ||
    upperName === "NURSERY / EARLY CARE / DAYCARE" ||
    upperName === "NURSERY / DAYCARE"
  ) {
    return {
      style: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
      label: "Daycare / Nursery",
    };
  } else if (upperName.includes("PRIMARY & SECONDARY") || upperName === "PRIMARY_SECONDARY" || upperName === "COMBINED PRIMARY & SECONDARY SCHOOL") {
    return {
      style: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
      label: "Primary & Secondary School",
    };
  } else if (upperName.includes("COMBINED") && upperName.includes("NURSERY")) {
    return {
      style: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
      label: "Nursery, Primary & Secondary",
    };
  } else if (upperName.includes("UNIVERSITY")) {
    return {
      style: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
      label: upperName.includes("HIGHER ED") ? tierName : "Higher Ed: University",
    };
  } else if (upperName.includes("POLYTECHNIC")) {
    return {
      style: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
      label: upperName.includes("HIGHER ED") ? tierName : "Higher Ed: Polytechnic",
    };
  } else if (upperName.includes("COLLEGE")) {
    return {
      style: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
      label: upperName.includes("HIGHER ED") ? tierName : "Higher Ed: College of Education",
    };
  } else if (upperName.includes("PRIMARY")) {
    return {
      style: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
      label: "Primary School",
    };
  } else if (upperName.includes("SECONDARY")) {
    return {
      style: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
      label: "Secondary School",
    };
  }
  return {
    style: "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700",
    label: tierName,
  };
}

export default async function TenantsPage() {
  let schools: any[] = [];
  try {
    const dbSchools = await basePrisma.school.findMany({
      include: {
        academicTiers: true,
        _count: {
          select: { students: true, staff: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    
    schools = dbSchools.map((s) => ({
      ...s,
      students_count: s._count.students,
      staff_count: s._count.staff,
      academic_tiers: s.academicTiers.map(t => ({ name: t.name, id: t.id }))
    }));
  } catch (e) {
    console.error("[TenantsPage] Fetch error:", e);
  }

  const totalStudents = schools.reduce((acc, school) => acc + (school.students_count || 0), 0);
  const totalStaff = schools.reduce((acc, school) => acc + (school.staff_count || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Module 1
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Multi-Tenant Institutional Operations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Tenants Directory & Provisioning
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Provision and configure academic institutions, assign tiers, and manage workspace active states
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/saas"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-semibold shadow-xs transition"
          >
            <Building2 className="w-3.5 h-3.5" />
            Open SaaS Console
          </Link>
        </div>
      </div>

      {/* Quick Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registered Schools</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{schools.length}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Enrolled Students</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalStudents}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Institutional Staff</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalStaff}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* TENANTS DIRECTORY (MAIN PANEL) */}
        <section className="p-4 sm:p-5 md:p-6 rounded-2xl shadow-sm border xl:col-span-8 2xl:col-span-9 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 transition-colors duration-200 flex flex-col order-2 xl:order-1">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-500" />
              Registered Institutional Tenants
            </h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              {schools.length} {schools.length === 1 ? 'School' : 'Schools'}
            </span>
          </div>

          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800/80 shadow-xs flex-1">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">School Name</th>
                  <th className="px-3 py-3 font-semibold">Subdomain</th>
                  <th className="px-3 py-3 font-semibold">Academic Tiers</th>
                  <th className="px-3 py-3 font-semibold text-center">Students</th>
                  <th className="px-3 py-3 font-semibold text-center">Staff</th>
                  <th className="px-3 py-3 font-semibold text-center">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
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
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{school.name}</td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Link 
                            href={getTenantUrl(school.subdomain)} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline transition-colors font-medium inline-flex items-center gap-1 group/sublink"
                            title={`Navigate to ${BASE_PLATFORM_URL}/${school.subdomain}/dashboard`}
                          >
                            <span>/{school.subdomain}</span>
                            <ExternalLink className="w-3 h-3 opacity-60 group-hover/sublink:opacity-100 transition-opacity" />
                          </Link>
                          <Link 
                            href={getTenantLoginUrl(school.subdomain)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800"
                            title={`Open ${BASE_PLATFORM_URL}/${school.subdomain}/login`}
                          >
                            login
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {school.academic_tiers?.map((tier: any) => {
                            const badge = getTierBadge(tier.name);
                            return (
                              <span key={tier.id} className={`${badge.style} text-[10px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider border shadow-xs`}>
                                {badge.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center font-mono text-slate-600 dark:text-zinc-400">{school.students_count || 0}</td>
                      <td className="px-3 py-3.5 text-center font-mono text-slate-600 dark:text-zinc-400">{school.staff_count || 0}</td>
                      <td className="px-3 py-3.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-xs ${school.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'}`}>
                          {school.isActive ? (
                            <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span> ACTIVE</>
                          ) : (
                            <><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1"></span> SUSPENDED</>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <EditSchoolModal 
                            school={{ 
                              id: school.id, 
                              name: school.name, 
                              contactPhone: school.contactPhone, 
                              subdomain: school.subdomain,
                              academicTiers: school.academic_tiers || []
                            }} 
                          />
                          <form action={toggleSchoolStatus.bind(null, school.id, school.isActive)} className="inline-block">
                            <button 
                              type="submit" 
                              title={school.isActive ? "Suspend Tenant" : "Activate Tenant"}
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-xs transition-all duration-150 outline-none focus:ring-2 cursor-pointer ${
                                school.isActive 
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/20 focus:ring-amber-400' 
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/20 focus:ring-emerald-400'
                              }`}
                            >
                              {school.isActive ? "SUSPEND" : "ACTIVATE"}
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

          {/* MOBILE CARDS VIEW */}
          <div className="md:hidden space-y-3">
            {schools.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-zinc-500 italic bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs">
                No tenants registered yet.
              </div>
            ) : (
              schools.map(school => (
                <div 
                  key={school.id} 
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        {school.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Link 
                          href={getTenantUrl(school.subdomain)} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-mono inline-flex items-center gap-1 font-medium"
                          title={`Navigate to ${BASE_PLATFORM_URL}/${school.subdomain}/dashboard`}
                        >
                          <span>/{school.subdomain}</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                        <Link 
                          href={getTenantLoginUrl(school.subdomain)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800"
                          title={`Open ${BASE_PLATFORM_URL}/${school.subdomain}/login`}
                        >
                          login
                        </Link>
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-xs ${school.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'}`}>
                      {school.isActive ? "ACTIVE" : "SUSPENDED"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-100 dark:border-zinc-800">
                    <span>Students: <strong className="text-slate-800 dark:text-zinc-200">{school.students_count || 0}</strong></span>
                    <span>Staff: <strong className="text-slate-800 dark:text-zinc-200">{school.staff_count || 0}</strong></span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <EditSchoolModal 
                      school={{ 
                        id: school.id, 
                        name: school.name, 
                        contactPhone: school.contactPhone, 
                        subdomain: school.subdomain,
                        academicTiers: school.academic_tiers || []
                      }} 
                    />
                    <DeleteSchoolForm schoolId={school.id} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* REGISTER NEW SCHOOL (CONTAINER ON THE RIGHT SIDE) */}
        <section className="p-5 md:p-6 rounded-2xl shadow-sm border xl:col-span-4 2xl:col-span-3 relative bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 transition-colors duration-200 order-1 xl:order-2 h-fit">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 rounded-t-2xl"></div>
          <h3 className="text-lg font-bold mb-5 tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-500" />
            + Register New School
          </h3>
          <RegisterSchoolForm />
        </section>
      </div>
    </div>
  );
}
