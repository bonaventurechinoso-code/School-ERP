export const dynamic = 'force-dynamic';
import React from "react";
import { getTeacherSupportTickets } from "../actions";
import { TeacherSupportClient } from "./TeacherSupportClient";

export default async function SupportPage() {
  const data = await getTeacherSupportTickets();

  return (
    <TeacherSupportClient
      initialTickets={data.tickets}
      schoolName={data.teacher.schoolName}
      teacherEmail={data.teacher.staffEmail}
    />
  );
}
