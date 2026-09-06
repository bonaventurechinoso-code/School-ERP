import React from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import AdmissionsTable from "./AdmissionsTable";

export default async function AdmissionsPage({ params }: { params: { schoolDomain: string } }) {
  
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
  
  const applicants = await tenantDb.student.findMany({
    where: {
      status: {
        in: ["PROSPECT", "APPLICANT", "SCREENED"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
          Admissions Pipeline
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          Review prospects, manage applications, and enroll cleared candidates.
        </p>
      </header>
      
      <AdmissionsTable students={applicants} schoolId={school.id} />
      
    </div>
  );
}
