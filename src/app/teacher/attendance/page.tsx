import React from "react";
import { getTeacherAttendanceData } from "../actions";
import { TeacherAttendanceClient } from "./TeacherAttendanceClient";

export default async function AttendancePage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ date?: string; class?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const data = await getTeacherAttendanceData(searchParams.date, searchParams.class);

  return (
    <TeacherAttendanceClient
      initialDate={data.date}
      initialClass={data.selectedClass}
      assignedClasses={data.assignedClasses}
      students={data.students}
      initialAttendanceMap={data.attendanceMap}
      schoolName={data.teacher.schoolName}
    />
  );
}
