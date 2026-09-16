import { redirect } from "next/navigation";

interface ExamRosterPageProps {
  params: Promise<{
    schoolDomain: string;
    id: string;
  }> | {
    schoolDomain: string;
    id: string;
  };
}

export default async function ExamRosterRedirectPage({ params }: ExamRosterPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const { schoolDomain, id } = resolvedParams;

  // Seamlessly redirect administrator into the active grading roster spreadsheet calibrated to this specific exam
  redirect(`/${schoolDomain}/exams?tab=grading&examId=${id}`);
}
