import React from "react";
import { cookies } from "next/headers";
import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";
import StudentTable from "./StudentTable";

export default async function StudentsPage({ 
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: { 
  params: Promise<{ schoolDomain: string }>;
  searchParams?: Promise<{ tier?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};
  
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: {
      academicTiers: {
        orderBy: { level: "asc" },
      },
    },
  });

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
        <p>No school registered under domain: {params.schoolDomain}</p>
      </div>
    );
  }

  // Resolve active tier from URL searchParams or cookie fallback
  const cookieStore = await cookies();
  const cookieTier = cookieStore.get("activeTier")?.value;
  const requestedTierParam = searchParams?.tier;

  const activeTierObj = school.academicTiers.find((t) => {
    if (requestedTierParam) {
      return (
        sanitizeTierSlug(t.name) === sanitizeTierSlug(requestedTierParam) ||
        t.name.toLowerCase().includes(requestedTierParam.toLowerCase())
      );
    }
    if (cookieTier) {
      return (
        t.name.toLowerCase() === cookieTier.toLowerCase() ||
        sanitizeTierSlug(t.name) === sanitizeTierSlug(cookieTier)
      );
    }
    return false;
  }) || school.academicTiers[0];

  const activeTierName = activeTierObj ? activeTierObj.name : "";

  // Dynamically resolve and query the isolated database client
  const tenantDb = await getPrismaClientForTier(school.id, activeTierName);
  
  const [students, leads, classrooms] = await Promise.all([
    tenantDb.student.findMany({
      orderBy: { createdAt: "desc" },
      include: { tier: true },
    }),
    basePrisma.admissionLead.findMany({
      where: {
        schoolId: school.id,
        ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
        status: { not: "ENROLLED" },
      },
      orderBy: { createdAt: "desc" },
      include: { tier: true },
    }).catch(async () => {
      return tenantDb.admissionLead.findMany({
        where: { status: { not: "ENROLLED" } },
        orderBy: { createdAt: "desc" },
        include: { tier: true },
      });
    }),
    tenantDb.classroom.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  const mappedLeads = leads.map(lead => {
    const nameParts = lead.applicantName.split(" ");
    let mappedStatus = "PROSPECT";
    if (["APPLIED", "INTERVIEW", "APPROVED"].includes(lead.status)) {
      mappedStatus = "APPLICANT";
    }
    
    return {
      id: lead.id,
      schoolId: lead.schoolId,
      tierId: lead.tierId,
      tier: lead.tier,
      firstName: nameParts[0] || "Unknown",
      lastName: nameParts.slice(1).join(" ") || "",
      email: null,
      status: mappedStatus,
      dynamicFields: {},
      admissionNumber: `APP/${new Date(lead.createdAt).getFullYear()}/${lead.id.substring(0,4).toUpperCase()}`,
      currentClass: lead.targetGrade,
      dateOfBirth: null,
      stateOfOrigin: null,
      parentName: lead.parentName,
      parentOccupation: null,
      parentEmail: null,
      parentPhone: lead.parentContact,
      parentWhatsApp: null,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      isLead: true,
    };
  });

  const allRecords = [...students, ...mappedLeads];

  const totalEnrolled = students.filter(s => s.status === "ENROLLED").length;
  const suspendedStudents = students.filter(s => s.status === "SUSPENDED").length;
  const activeProspects = leads.filter(l => l.status === "INQUIRY").length;
  const totalApplicants = leads.filter(l => ["APPLIED", "INTERVIEW", "APPROVED"].includes(l.status)).length;
  const alumniCount = students.filter(s => s.status === "ALUMNI").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-2 sm:gap-3">
          <span>Student Roster</span>
          {activeTierObj && (
            <span className="text-[11px] sm:text-xs uppercase tracking-wider px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-extrabold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {activeTierObj.name}
            </span>
          )}
        </h2>
      </header>
      
      {/* Student Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-green-500 min-w-0">
          <h3 className="text-slate-800 dark:text-zinc-200 font-extrabold text-[11px] sm:text-xs md:text-sm uppercase tracking-wider mb-1.5 truncate">Total Enrolled</h3>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-none truncate">{totalEnrolled}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-yellow-500 min-w-0">
          <h3 className="text-slate-800 dark:text-zinc-200 font-extrabold text-[11px] sm:text-xs md:text-sm uppercase tracking-wider mb-1.5 truncate">Active Prospects</h3>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-none truncate">{activeProspects}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-indigo-500 min-w-0">
          <h3 className="text-slate-800 dark:text-zinc-200 font-extrabold text-[11px] sm:text-xs md:text-sm uppercase tracking-wider mb-1.5 truncate">Total Applicants</h3>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-none truncate">{totalApplicants}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-red-500 min-w-0">
          <h3 className="text-slate-800 dark:text-zinc-200 font-extrabold text-[11px] sm:text-xs md:text-sm uppercase tracking-wider mb-1.5 truncate">Suspended</h3>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-none truncate">{suspendedStudents}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-blue-500 min-w-0 col-span-2 sm:col-span-1">
          <h3 className="text-slate-800 dark:text-zinc-200 font-extrabold text-[11px] sm:text-xs md:text-sm uppercase tracking-wider mb-1.5 truncate">Alumni</h3>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-none truncate">{alumniCount}</p>
        </div>
      </div>

      <StudentTable 
        students={allRecords as any} 
        schoolId={school.id} 
        tiers={school.academicTiers}
        activeTier={activeTierName}
        classrooms={classrooms}
      />
      
    </div>
  );
}
