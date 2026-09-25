import React from "react";
import { cookies } from "next/headers";
import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";
import AnnouncementsBoard from "./AnnouncementsBoard";
import MessageLogView from "./MessageLogView";
import { Bell, Send, MessageSquare, Radio, ShieldCheck, Users } from "lucide-react";

export default async function CommunicationsPage({ 
  params: paramsPromise, 
  searchParams: searchParamsPromise 
}: { 
  params: Promise<{ schoolDomain: string }> | { schoolDomain: string }; 
  searchParams?: Promise<{ tab?: string; tier?: string }>; 
}) {
  const params = await Promise.resolve(paramsPromise);
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};
  
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: {
      academicTiers: {
        orderBy: { level: "asc" }
      }
    }
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
  }) || (school.academicTiers.length > 0 ? school.academicTiers[0] : null);

  const activeTierName = activeTierObj ? activeTierObj.name : "";

  // Dynamic tier-isolated database client
  const tenantDb = await getPrismaClientForTier(school.id, activeTierName);
  
  const [notices, messageLogs, students, rawStaff] = await Promise.all([
    tenantDb.notice.findMany({
      where: { schoolId: school.id },
      include: {
        author: {
          select: { firstName: true, lastName: true, user: { select: { role: true } } }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    tenantDb.messageLog.findMany({
      where: { schoolId: school.id },
      orderBy: { sentAt: "desc" },
      take: 500,
    }),
    tenantDb.student.findMany({
      where: { 
        schoolId: school.id, 
        status: { in: ["ENROLLED", "ACTIVE"] },
        ...(activeTierObj ? { tierId: activeTierObj.id } : {})
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        parentName: true,
        parentEmail: true,
        parentPhone: true,
        parentWhatsApp: true,
        currentClass: true,
        admissionNumber: true,
      },
      orderBy: { firstName: "asc" }
    }),
    tenantDb.staff.findMany({
      where: { 
        schoolId: school.id, 
        status: { not: "TERMINATED" } 
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        user: {
          select: { role: true }
        },
        department: {
          select: { name: true }
        }
      },
      orderBy: { firstName: "asc" }
    })
  ]);

  const staff = rawStaff.map((s: any) => ({
    ...s,
    role: s.user?.role || "STAFF"
  }));

  const activeTab = searchParams?.tab || "notices";
  const urgentNoticesCount = notices.filter(n => n.priority === "HIGH" || n.priority === "URGENT").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {activeTierName || "Institutional Hub"}
            </span>
            <span className="text-xs text-slate-400 font-medium">Session 2026/2027</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Communications Hub
          </h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 text-sm max-w-3xl">
            Broadcast institutional announcements, dispatch targeted SMS and email advisories, and review multi-channel delivery audit logs.
          </p>
        </div>

        {/* Quick Stats Banner */}
        <div className="flex items-center gap-2 shrink-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-2 rounded-2xl shadow-xs">
          <div className="px-3 py-1.5 text-center border-r border-slate-100 dark:border-zinc-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">Notices</div>
            <div className="text-sm font-black text-slate-800 dark:text-white">{notices.length}</div>
          </div>
          <div className="px-3 py-1.5 text-center border-r border-slate-100 dark:border-zinc-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">Urgent</div>
            <div className="text-sm font-black text-rose-600 dark:text-rose-400">{urgentNoticesCount}</div>
          </div>
          <div className="px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase font-bold text-slate-400">Dispatched</div>
            <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">{messageLogs.length}</div>
          </div>
        </div>
      </header>
      
      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-6 sm:space-x-8">
          <a
            href={`/${params.schoolDomain}/communications?tab=notices${activeTierName ? `&tier=${encodeURIComponent(activeTierName)}` : ""}`}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm transition-colors flex items-center gap-2 ${
              activeTab === "notices"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:border-slate-300"
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Announcements Board ({notices.length})</span>
          </a>
          <a
            href={`/${params.schoolDomain}/communications?tab=logs${activeTierName ? `&tier=${encodeURIComponent(activeTierName)}` : ""}`}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm transition-colors flex items-center gap-2 ${
              activeTab === "logs"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:border-slate-300"
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Message Center & Logs ({messageLogs.length})</span>
          </a>
        </nav>
      </div>

      <div>
        {activeTab === "notices" ? (
          <AnnouncementsBoard 
            schoolId={school.id} 
            schoolDomain={params.schoolDomain}
            activeTier={activeTierName}
            notices={notices} 
          />
        ) : (
          <MessageLogView 
            schoolId={school.id} 
            schoolDomain={params.schoolDomain}
            activeTier={activeTierName}
            messageLogs={messageLogs} 
            students={students}
            staff={staff}
          />
        )}
      </div>
    </div>
  );
}
