import React from "react";
import { getTeacherGradebookData } from "../actions";
import { TeacherGradebookClient } from "./TeacherGradebookClient";

export default async function GradebookPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ class?: string; subject?: string; term?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const data = await getTeacherGradebookData(
    searchParams.class,
    searchParams.subject,
    searchParams.term
  );

  return (
    <TeacherGradebookClient
      initialClass={data.selectedClass}
      initialSubject={data.selectedSubject}
      initialTerm={data.term}
      initialAcademicYear={data.academicYear}
      assignedClasses={data.assignedClasses}
      assignedSubjects={data.assignedSubjects}
      students={data.students}
      initialGradesMap={data.gradesMap}
      schoolName={data.teacher.schoolName}
    />
  );
}
