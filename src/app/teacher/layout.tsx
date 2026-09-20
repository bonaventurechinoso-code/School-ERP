import React from "react";
import { getTeacherContext, TeacherContext } from "./actions";
import { TeacherShell } from "./TeacherShell";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Teacher Portal | School ERP",
  description: "Teacher classroom dashboard, attendance roll-call, continuous assessment gradebook, and timetable.",
};

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getTeacherContext();

  const fallbackContext: TeacherContext = context || {
    staffId: "demo-teacher-id",
    staffName: "Mr. Ayodeji Balogun",
    staffEmail: "teacher@school.edu.ng",
    staffRole: "Class Teacher",
    departmentName: "General Academics",
    schoolId: "default-school",
    schoolName: "Greenwood Academy",
    schoolSubdomain: "greenwood",
    assignedClasses: ["JSS 1", "JSS 2", "SSS 1"],
    assignedSubjects: ["Mathematics", "Further Mathematics", "English Language"],
  };

  return (
    <TeacherShell teacherContext={fallbackContext}>
      {children}
    </TeacherShell>
  );
}
