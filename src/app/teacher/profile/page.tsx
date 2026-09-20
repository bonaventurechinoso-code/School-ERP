import React from "react";
import { getTeacherProfile } from "../actions";
import { TeacherProfileClient } from "./TeacherProfileClient";

export default async function ProfilePage() {
  const data = await getTeacherProfile();

  return (
    <TeacherProfileClient
      profile={data.profile}
      recentPayslips={data.recentPayslips}
      schoolName={data.teacher.schoolName}
    />
  );
}
