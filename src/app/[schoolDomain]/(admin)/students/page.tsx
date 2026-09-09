import React from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import StudentTable from "./StudentTable";

export default async function StudentsPage({ params: paramsPromise }: { params: Promise<{ schoolDomain: string }> }) {
  const params = await paramsPromise;
  
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
  });

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
        <p>No school registered under domain: {params.schoolDomain}</p>
      </div>
    );
  }

  const tenantDb = getTenantClient(school.id);
  
  const students = await tenantDb.student.findMany({
    orderBy: { createdAt: "desc" },
    include: { tier: true },
  });

  const leads = await tenantDb.admissionLead.findMany({
    orderBy: { createdAt: "desc" },
    include: { tier: true },
  });

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

  const academicTiers = await tenantDb.academicTier.findMany({
    orderBy: { level: "asc" },
  });

  const totalEnrolled = students.filter(s => s.status === "ENROLLED").length;
  
  const suspendedStudents = students.filter(s => s.status === "SUSPENDED").length;
  
  const activeProspects = await tenantDb.admissionLead.count({
    where: { status: "INQUIRY" }
  });

  const totalApplicants = await tenantDb.admissionLead.count({
    where: { status: { in: ["APPLIED", "INTERVIEW", "APPROVED"] } }
  });

  const alumniCount = await tenantDb.student.count({
    where: { status: "ALUMNI" }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
          Student Roster
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          Manage all students, update statuses, and view complete records.
        </p>
      </header>
      
      {/* Student Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-green-500">
          <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider mb-2 truncate">Total Enrolled</h3>
          <p className="text-3xl font-black text-slate-800">{totalEnrolled}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-yellow-500">
          <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider mb-2 truncate">Active Prospects</h3>
          <p className="text-3xl font-black text-slate-800">{activeProspects}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-indigo-500">
          <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider mb-2 truncate">Total Applicants</h3>
          <p className="text-3xl font-black text-slate-800">{totalApplicants}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-red-500">
          <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider mb-2 truncate">Suspended</h3>
          <p className="text-3xl font-black text-slate-800">{suspendedStudents}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-blue-500">
          <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider mb-2 truncate">Alumni</h3>
          <p className="text-3xl font-black text-slate-800">{alumniCount}</p>
        </div>
      </div>

      <StudentTable students={allRecords as any} schoolId={school.id} tiers={academicTiers} />
      
    </div>
  );
}
