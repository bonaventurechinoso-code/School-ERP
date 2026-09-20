import React from "react";
import { getTeacherStudents } from "../actions";
import { TeacherStudentsClient } from "./TeacherStudentsClient";

export default async function StudentsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ q?: string; class?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const data = await getTeacherStudents(searchParams.q, searchParams.class);

  return (
    <TeacherStudentsClient
      initialStudents={data.students}
      assignedClasses={data.assignedClasses}
      schoolName={data.teacher.schoolName}
    />
  );
}
