import React from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import StaffTable from "./StaffTable";

export default async function StaffPage({ params: paramsPromise }: { params: Promise<{ schoolDomain: string }> }) {
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
  
  const staffList = await tenantDb.staff.findMany({
    orderBy: { createdAt: "desc" },
  });

  const totalActive = staffList.filter(s => s.status === "ACTIVE").length;
  const totalOnboarding = staffList.filter(s => s.status === "ONBOARDING").length;
  const teachersCount = staffList.filter(s => s.role === "TEACHER" && s.status === "ACTIVE").length;
  const adminsCount = staffList.filter(s => s.role === "ADMIN" && s.status === "ACTIVE").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
          Staff Directory
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          Manage teachers, administrators, and support staff.
        </p>
      </header>

      {/* Staff Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-green-500">
          <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-4">Total Active</h3>
          <p className="text-4xl font-black text-slate-800">{totalActive}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-yellow-500">
          <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-4">Onboarding</h3>
          <p className="text-4xl font-black text-slate-800">{totalOnboarding}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-blue-500">
          <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-4">Teachers</h3>
          <p className="text-4xl font-black text-slate-800">{teachersCount}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-purple-500">
          <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-4">Admins</h3>
          <p className="text-4xl font-black text-slate-800">{adminsCount}</p>
        </div>
      </div>
      
      <StaffTable staffList={staffList} schoolId={school.id} />
      
    </div>
  );
}
