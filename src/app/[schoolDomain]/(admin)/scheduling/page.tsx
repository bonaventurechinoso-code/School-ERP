import React from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import TimetableView from "./TimetableView";
import AttendanceView from "./AttendanceView";

export default async function SchedulingPage({ params, searchParams }: { params: { schoolDomain: string }, searchParams: { tab?: string } }) {
  
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
  
  // Fetch data needed for Timetable
  const [courses, classrooms, staff, timetable, students, attendanceRecords] = await Promise.all([
    tenantDb.course.findMany(),
    tenantDb.classroom.findMany(),
    tenantDb.staff.findMany({ where: { role: "TEACHER" } }),
    tenantDb.timetable.findMany({
      include: {
        course: true,
        classroom: true,
        staff: true
      }
    }),
    tenantDb.student.findMany(),
    tenantDb.studentAttendance.findMany() // Simplification: we might want to filter this by date to avoid loading all history
  ]);

  const activeTab = searchParams.tab || "timetable";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
          Scheduling & Attendance
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          Manage class timetables and track daily attendance.
        </p>
      </header>
      
      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <a
            href={`/${params.schoolDomain}/scheduling?tab=timetable`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "timetable"
                ? "border-slate-800 text-slate-800"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Weekly Timetable
          </a>
          <a
            href={`/${params.schoolDomain}/scheduling?tab=attendance`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "attendance"
                ? "border-slate-800 text-slate-800"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Daily Attendance
          </a>
        </nav>
      </div>

      <div className="mt-8">
        {activeTab === "timetable" ? (
          <TimetableView 
            schoolId={school.id} 
            timetable={timetable} 
            courses={courses} 
            classrooms={classrooms} 
            staff={staff} 
          />
        ) : (
          <AttendanceView 
            schoolId={school.id} 
            students={students} 
            attendanceRecords={attendanceRecords} 
          />
        )}
      </div>
      
    </div>
  );
}
