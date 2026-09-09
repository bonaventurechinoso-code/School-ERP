import React from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import AnnouncementsBoard from "./AnnouncementsBoard";
import MessageLogView from "./MessageLogView";

export default async function CommunicationsPage({ params: paramsPromise, searchParams: searchParamsPromise }: { params: Promise<{ schoolDomain: string }>, searchParams: Promise<{ tab?: string }> }) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  
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
  
  const [notices, messageLogs, students, staff] = await Promise.all([
    tenantDb.notice.findMany({
      orderBy: { createdAt: 'desc' }
    }),
    tenantDb.messageLog.findMany({
      orderBy: { sentAt: 'desc' }
    }),
    tenantDb.student.findMany(),
    tenantDb.staff.findMany()
  ]);

  const activeTab = searchParams.tab || "notices";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
          Communications Hub
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          Broadcast announcements and monitor message logs.
        </p>
      </header>
      
      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <a
            href={`/${params.schoolDomain}/communications?tab=notices`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "notices"
                ? "border-slate-800 text-slate-800"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Announcements Board
          </a>
          <a
            href={`/${params.schoolDomain}/communications?tab=logs`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "logs"
                ? "border-slate-800 text-slate-800"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Message Logs
          </a>
        </nav>
      </div>

      <div className="mt-8">
        {activeTab === "notices" ? (
          <AnnouncementsBoard 
            schoolId={school.id} 
            notices={notices} 
          />
        ) : (
          <MessageLogView 
            schoolId={school.id} 
            messageLogs={messageLogs} 
            students={students}
            staff={staff}
          />
        )}
      </div>
      
    </div>
  );
}
