import React from "react";
import { getTeacherAssignments } from "../actions";
import { TeacherAssignmentsClient } from "./TeacherAssignmentsClient";

export default async function AssignmentsPage() {
  const data = await getTeacherAssignments();

  return (
    <TeacherAssignmentsClient
      initialAssignments={data.assignments}
      assignedClasses={data.teacher.assignedClasses}
      assignedSubjects={data.teacher.assignedSubjects}
      schoolName={data.teacher.schoolName}
    />
  );
}
