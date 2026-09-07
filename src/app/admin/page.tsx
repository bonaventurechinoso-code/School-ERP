import { basePrisma } from "@/lib/tenant-prisma";
import { createSchool, toggleSchoolStatus } from "./actions";
import Link from "next/link";
import DeleteSchoolForm from "./DeleteSchoolForm";
import { PhoneInput } from "@/components/PhoneInput";

const ACADEMIC_TIERS_OPTIONS = [
  { id: "DAYCARE", label: "Nursery / Early Care / Daycare" },
  { id: "PRIMARY", label: "Primary School" },
  { id: "SECONDARY", label: "Secondary School" },
  { id: "PRIMARY_SECONDARY", label: "Combined Primary & Secondary School" },
  { id: "UNIVERSITY", label: "Higher Ed: University" },
  { id: "POLYTECHNIC", label: "Higher Ed: Polytechnic" },
  { id: "COLLEGE_OF_EDUCATION", label: "Higher Ed: College of Education" }
];

export default async function AdminDashboardPage() {
  const schools = await basePrisma.school.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      academicTiers: true,
      _count: {
        select: { students: true, staff: true }
      }
    }
  });

  const totalStudents = schools.reduce((acc, school) => acc + school._count.students, 0);

  return (
    <div className="space-y-8 bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-200 min-h-screen p-8">
      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl shadow-lg border relative overflow-hidden bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-1 tracking-wider uppercase relative z-10">Total Tenants</h3>
          <p className="text-4xl font-black text-zinc-900 dark:text-zinc-100 relative z-10">{schools.length}</p>
        </div>
        <div className="p-6 rounded-xl shadow-lg border relative overflow-hidden bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-1 tracking-wider uppercase relative z-10">Active Students</h3>
          <p className="text-4xl font-black text-zinc-900 dark:text-zinc-100 relative z-10">{totalStudents}</p>
        </div>
        <div className="p-6 rounded-xl shadow-lg border relative overflow-hidden bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-green-500" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-1 tracking-wider uppercase relative z-10">Platform Status</h3>
          <div className="flex items-center space-x-2 mt-1 relative z-10">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.7)]"></div>
            <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100">Online</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* NEW TENANT FORM */}
        <section className="p-6 rounded-xl shadow-xl border lg:col-span-1 relative bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-t-xl"></div>
          <h3 className="text-xl font-bold mb-6 tracking-tight">Register New School</h3>
          <form action={createSchool} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">School Name *</label>
              <input type="text" name="name" className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none shadow-inner placeholder-slate-400" placeholder="e.g., Riverside High" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Subdomain *</label>
              <div className="flex items-center shadow-inner rounded-lg overflow-hidden">
                <input type="text" name="subdomain" className="w-full bg-slate-50 dark:bg-zinc-800 border-y border-l border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 p-3 focus:ring-2 focus:ring-blue-500 outline-none transition placeholder-slate-400" placeholder="riverside" required />
                <span className="bg-slate-100 dark:bg-zinc-700 border-y border-r border-slate-200 dark:border-zinc-700 p-3 text-slate-600 dark:text-zinc-300 text-sm font-medium">.schoolerp.com</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Admin Email *</label>
              <input type="email" name="adminEmail" className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none shadow-inner placeholder-slate-400" placeholder="admin@riverside.edu" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Contact Phone</label>
              <PhoneInput name="contactPhone" maxLength={14} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none shadow-inner placeholder-slate-400" placeholder="+155500000000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Institution Subtype / Tiers *</label>
              <div className="space-y-3 p-4 rounded-lg bg-slate-50/50 dark:bg-zinc-800/50 border border-slate-200/50 dark:border-zinc-700/50 shadow-inner">
                {ACADEMIC_TIERS_OPTIONS.map(tier => (
                  <label key={tier.id} className="flex items-start space-x-3 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer group hover:text-slate-900 dark:hover:text-white transition-colors">
                    <div className="pt-0.5">
                      <input type="checkbox" name="tiers" value={tier.id} className="rounded border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-white dark:focus:ring-offset-zinc-900 transition-shadow" />
                    </div>
                    <span className="font-medium">{tier.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 italic">Select at least one standardized tier.</p>
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-3.5 rounded-lg font-bold hover:from-blue-500 hover:to-blue-400 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] mt-4">
              Provision Tenant Workspace
            </button>
          </form>
        </section>

        {/* TENANTS DIRECTORY */}
        <section className="p-6 rounded-xl shadow-sm border lg:col-span-2 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 transition-colors duration-200">
          <h3 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Registered Tenants</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-300">
              <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                <tr>
                  <th className="p-3 font-semibold rounded-tl-lg">School Name</th>
                  <th className="p-3 font-semibold">Subdomain</th>
                  <th className="p-3 font-semibold">Metadata Types</th>
                  <th className="p-3 font-semibold">Students</th>
                  <th className="p-3 font-semibold">Staff</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map(school => (
                  <tr key={school.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                    <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">{school.name}</td>
                    <td className="p-3">
                      <Link href={`/${school.subdomain}/dashboard`} className="text-blue-600 dark:text-blue-400 hover:underline">
                        {school.subdomain}
                      </Link>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {school.academicTiers.map(tier => {
                          let bgColor = "bg-slate-100 dark:bg-zinc-800";
                          let textColor = "text-slate-700 dark:text-zinc-300";
                          let displayLabel = tier.name;
                          
                          if (tier.name === "DAYCARE") {
                            bgColor = "bg-orange-100 dark:bg-orange-900/30";
                            textColor = "text-orange-700 dark:text-orange-300";
                            displayLabel = "Daycare";
                          } else if (tier.name === "PRIMARY_SECONDARY") {
                            bgColor = "bg-green-100 dark:bg-green-900/30";
                            textColor = "text-green-700 dark:text-green-300";
                            displayLabel = "K-12";
                          } else if (tier.name === "UNIVERSITY") {
                            bgColor = "bg-blue-100 dark:bg-blue-900/30";
                            textColor = "text-blue-700 dark:text-blue-300";
                            displayLabel = "University";
                          } else if (tier.name === "POLYTECHNIC") {
                            bgColor = "bg-indigo-100 dark:bg-indigo-900/30";
                            textColor = "text-indigo-700 dark:text-indigo-300";
                            displayLabel = "Polytechnic";
                          } else if (tier.name === "COLLEGE_OF_EDUCATION") {
                            bgColor = "bg-purple-100 dark:bg-purple-900/30";
                            textColor = "text-purple-700 dark:text-purple-300";
                            displayLabel = "College of Ed";
                          }

                          return (
                            <span key={tier.id} className={`${bgColor} ${textColor} text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap shadow-sm border border-black/5 dark:border-white/5`}>
                              {displayLabel}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-3 text-zinc-900 dark:text-zinc-100">{school._count.students}</td>
                    <td className="p-3 text-zinc-900 dark:text-zinc-100">{school._count.staff}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${school.isActive ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'}`}>
                        {school.isActive ? 'ACTIVE' : 'SUSPENDED'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <form action={toggleSchoolStatus.bind(null, school.id, school.isActive)}>
                          <button type="submit" className={`text-xs px-3 py-1 rounded border ${school.isActive ? 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                            {school.isActive ? 'Suspend' : 'Activate'}
                          </button>
                        </form>
                        <DeleteSchoolForm schoolId={school.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Clean Padded Footer Container */}
      <div className="mt-6 flex justify-end px-4">
        <Link 
          href="/" 
          className="bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 px-6 py-2.5 rounded-full shadow-sm text-sm font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all border border-slate-300 dark:border-zinc-700 flex items-center gap-2 outline-none focus:ring-2 focus:ring-slate-400"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
