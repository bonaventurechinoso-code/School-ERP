import React from "react";
import { getTeacherTimetable } from "../actions";
import { TeacherTimetableClient } from "./TeacherTimetableClient";

export default async function TimetablePage() {
  const data = await getTeacherTimetable();

  return (
    <TeacherTimetableClient
      timetable={data.timetable}
      schoolName={data.teacher.schoolName}
      teacherName={data.teacher.staffName}
    />
  );
}
