import React from "react";
import { cookies } from "next/headers";
import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";
import { resolveStaffTierCategory } from "@/lib/staff-roles-config";
import TimetableView from "./TimetableView";
import AttendanceView from "./AttendanceView";
import { Calendar, Users, Clock, ShieldCheck } from "lucide-react";

export default async function SchedulingPage({ 
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
        <h2 className="text-xl font-bold text-slate-800">Institution Not Found</h2>
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
  const tierCategory = resolveStaffTierCategory(activeTierName);

  // Dynamic tier-isolated database client
  const tenantDb = await getPrismaClientForTier(school.id, activeTierName);
  
  // Scoped queries per active academic tier
  const tierFilter = activeTierObj ? { OR: [{ tierId: activeTierObj.id }, { tierId: null }] } : {};

  const [
    courses, 
    classrooms, 
    teachers, 
    allStaff, 
    rawTimetable, 
    students, 
    studentAttendance, 
    staffAttendance
  ] = await Promise.all([
    tenantDb.course.findMany({ 
      where: { schoolId: school.id, ...tierFilter },
      orderBy: { name: "asc" } 
    }),
    tenantDb.classroom.findMany({ 
      where: { schoolId: school.id, ...tierFilter },
      orderBy: { name: "asc" } 
    }),
    tenantDb.staff.findMany({ 
      where: { 
        schoolId: school.id,
        status: { not: "TERMINATED" },
        role: { in: ["TEACHER", "Class Teacher", "Subject Teacher", "Teacher", "Early Educator", "Nursery Caregiver", "Lecturer", "Professor"] }
      }, 
      orderBy: { firstName: "asc" } 
    }),
    tenantDb.staff.findMany({ 
      where: { schoolId: school.id, status: { not: "TERMINATED" } }, 
      include: { department: true },
      orderBy: { firstName: "asc" } 
    }),
    tenantDb.timetable.findMany({
      where: { schoolId: school.id },
      include: {
        course: true,
        classroom: true,
        staff: true
      },
      orderBy: { startTime: "asc" }
    }),
    tenantDb.student.findMany({
      where: { 
        schoolId: school.id,
        status: { in: ["ENROLLED", "ACTIVE"] },
        ...(activeTierObj ? { tierId: activeTierObj.id } : {})
      },
      orderBy: { firstName: "asc" }
    }),
    tenantDb.studentAttendance.findMany({
      where: { schoolId: school.id },
      orderBy: { date: "desc" },
      take: 2000,
    }),
    tenantDb.staffAttendance.findMany({
      where: { schoolId: school.id },
      orderBy: { date: "desc" },
      take: 1000,
    }),
  ]);

  // If role-filtered teachers is empty, use allStaff as fallback faculty
  const effectiveTeachers = teachers.length > 0 ? teachers : allStaff;

  // Filter timetable entries relevant to this tier's classrooms or courses
  const tierClassroomIds = new Set(classrooms.map((c) => c.id));
  const tierCourseIds = new Set(courses.map((c) => c.id));

  const timetable = rawTimetable.filter((t) => {
    if (tierClassroomIds.size > 0 && tierClassroomIds.has(t.classroomId)) return true;
    if (tierCourseIds.size > 0 && tierCourseIds.has(t.courseId)) return true;
    return classrooms.length === 0; // fallback if no specific classrooms
  });

  // Extract distinct class names for filtering in attendance & timetable
  const distinctClasses = Array.from(
    new Set([
      ...classrooms.map((c) => c.name),
      ...students.map((s) => s.currentClass).filter(Boolean) as string[],
    ])
  ).sort();

  const activeTab = searchParams?.tab || "timetable";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {activeTierName || "Academic Tier"}
            </span>
            <span className="text-xs text-slate-400 font-medium">Session 2026/2027</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Scheduling & Attendance Register
          </h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 text-sm max-w-3xl">
            Configure weekly master timetables, manage teacher and room assignments, and track daily attendance records with automated roll-call registers.
          </p>
        </div>

        {/* Quick Stats Pill Header */}
        <div className="flex items-center gap-2 shrink-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-2 rounded-2xl shadow-xs">
          <div className="px-3 py-1.5 text-center border-r border-slate-100 dark:border-zinc-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">Classrooms</div>
            <div className="text-sm font-black text-slate-800 dark:text-white">{classrooms.length}</div>
          </div>
          <div className="px-3 py-1.5 text-center border-r border-slate-100 dark:border-zinc-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">Enrolled</div>
            <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">{students.length}</div>
          </div>
          <div className="px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase font-bold text-slate-400">Sessions</div>
            <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">{timetable.length}</div>
          </div>
        </div>
      </header>
      
      {/* Segmented Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-6 sm:space-x-8">
          <a
            href={`/${params.schoolDomain}/scheduling?tab=timetable${activeTierName ? `&tier=${encodeURIComponent(activeTierName)}` : ""}`}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm transition-colors flex items-center gap-2 ${
              activeTab === "timetable"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:border-slate-300"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Weekly Master Timetable</span>
          </a>
          <a
            href={`/${params.schoolDomain}/scheduling?tab=attendance${activeTierName ? `&tier=${encodeURIComponent(activeTierName)}` : ""}`}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm transition-colors flex items-center gap-2 ${
              activeTab === "attendance"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:border-slate-300"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Daily Attendance Register</span>
          </a>
        </nav>
      </div>

      <div>
        {activeTab === "timetable" ? (
          <TimetableView 
            schoolId={school.id} 
            schoolDomain={params.schoolDomain}
            activeTier={activeTierName}
            timetable={timetable} 
            courses={courses} 
            classrooms={classrooms} 
            staff={effectiveTeachers}
            classes={distinctClasses}
          />
        ) : (
          <AttendanceView 
            schoolId={school.id} 
            schoolDomain={params.schoolDomain}
            activeTier={activeTierName}
            tierCategory={tierCategory}
            students={students} 
            staff={allStaff}
            classes={distinctClasses}
            studentAttendanceRecords={studentAttendance} 
            staffAttendanceRecords={staffAttendance}
          />
        )}
      </div>
    </div>
  );
}
