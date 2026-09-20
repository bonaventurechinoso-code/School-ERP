import { createSchool, toggleSchoolStatus } from "../actions";
import Link from "next/link";
import DeleteSchoolForm from "../DeleteSchoolForm";
import EditSchoolModal from "../EditSchoolModal";
import { PhoneInput } from "@/components/PhoneInput";
import { Server, Users, ShieldCheck, Settings, Plus, Building2, CheckCircle2, AlertCircle } from "lucide-react";
import { basePrisma } from "@/lib/tenant-prisma";

export const dynamic = "force-dynamic";

const ACADEMIC_TIERS_OPTIONS = [
  { id: "DAYCARE", label: "Daycare / Nursery" },
  { id: "PRIMARY", label: "Primary School" },
  { id: "SECONDARY", label: "Secondary School" },
  { id: "PRIMARY_SECONDARY", label: "Combined Primary & Secondary School" },
  { id: "COMBINED_NURSERY_PRIMARY_SECONDARY", label: "Combined Nursery, Primary & Secondary" },
  { id: "UNIVERSITY", label: "Higher Ed: University" },
  { id: "POLYTECHNIC", label: "Higher Ed: Polytechnic" },
  { id: "COLLEGE_OF_EDUCATION", label: "Higher Ed: College of Education" }
];

const getTenantUrl = (subdomain: string) => {
  if (process.env.NODE_ENV === "development") {
    return `/dashboard?mockTenant=${subdomain}`;
  }
  return `https://${subdomain}.schoolerp.com/dashboard`;
};

function getTierBadge(tierName: string) {
  const upperName = (tierName || "").toUpperCase();
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
  } else if (upperName.includes("UNIVERSITY") || upperName === "UNIVERSITY") {
    return {
      style: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
      label: upperName.includes("HIGHER ED") ? tierName : "Higher Ed: University",
    };
  } else if (upperName.includes("POLYTECHNIC") || upperName === "POLYTECHNIC") {
    return {
      style: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
      label: upperName.includes("HIGHER ED") ? tierName : "Higher Ed: Polytechnic",
    };
  } else if (upperName.includes("COLLEGE")) {
    return {
      style: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
      label: upperName.includes("HIGHER ED") ? tierName : "Higher Ed: College of Education",
    };
  } else if (upperName.includes("PRIMARY") || upperName === "PRIMARY SCHOOL") {
    return {
      style: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
      label: "Primary School",
    };
  } else if (upperName.includes("SECONDARY") || upperName === "SECONDARY SCHOOL") {
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
        {/* NEW TENANT FORM */}
        <section className="p-5 md:p-6 rounded-2xl shadow-sm border xl:col-span-4 2xl:col-span-3 relative bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 transition-colors duration-200">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 rounded-t-2xl"></div>
          <h3 className="text-lg font-bold mb-5 tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-500" />
            Register New School
          </h3>
          <form action={createSchool} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">School Name *</label>
              <input type="text" name="name" className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-2.5 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none placeholder-slate-400 dark:placeholder-zinc-600" placeholder="e.g., Riverside High" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Subdomain *</label>
              <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-shadow">
                <input type="text" name="subdomain" className="w-full bg-slate-50/50 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 p-2.5 text-xs outline-none placeholder-slate-400 dark:placeholder-zinc-600" placeholder="riverside" required />
                <span className="bg-slate-100 dark:bg-zinc-800 px-2.5 py-2.5 text-slate-500 dark:text-zinc-400 text-xs font-medium border-l border-slate-200 dark:border-zinc-800">.schoolerp.com</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Admin Email *</label>
              <input type="email" name="adminEmail" className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-2.5 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none placeholder-slate-400 dark:placeholder-zinc-600" placeholder="admin@riverside.edu" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Contact Phone</label>
              <PhoneInput name="contactPhone" maxLength={14} className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-2.5 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none placeholder-slate-400 dark:placeholder-zinc-600" placeholder="+155500000000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Academic Tiers *</label>
              <div className="space-y-2 p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-800/30 border border-slate-200/80 dark:border-zinc-800/80 max-h-44 overflow-y-auto">
                {ACADEMIC_TIERS_OPTIONS.map(tier => (
                  <label key={tier.id} className="flex items-start space-x-2.5 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <div className="pt-0.5">
                      <input type="checkbox" name="tiers" value={tier.id} className="rounded border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                    </div>
                    <span className="font-medium">{tier.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 text-xs transition-all mt-3 flex justify-center items-center gap-2">
              Provision Workspace
            </button>
          </form>
        </section>

        {/* TENANTS DIRECTORY */}
        <section className="p-4 sm:p-5 md:p-6 rounded-2xl shadow-sm border xl:col-span-8 2xl:col-span-9 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 transition-colors duration-200 flex flex-col">
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
                        <a href={getTenantUrl(school.subdomain)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline transition-colors font-mono font-medium">
                          {school.subdomain}
                        </a>
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
                      <a 
                        href={getTenantUrl(school.subdomain)} 
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-mono inline-block mt-0.5"
                      >
                        {school.subdomain}.schoolerp.com
                      </a>
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
      </div>
    </div>
  );
}
