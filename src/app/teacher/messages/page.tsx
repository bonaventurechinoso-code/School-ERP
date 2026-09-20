import React from "react";
import { getTeacherMessages } from "../actions";
import { TeacherMessagesClient } from "./TeacherMessagesClient";

export default async function MessagesPage() {
  const data = await getTeacherMessages();

  return (
    <TeacherMessagesClient
      notices={data.notices}
      directMessages={data.directMessages}
      schoolName={data.teacher.schoolName}
    />
  );
}
