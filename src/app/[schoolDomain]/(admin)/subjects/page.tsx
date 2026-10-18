import { redirect } from "next/navigation";

export default async function SubjectsPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/transcripts?tab=subjects`);
}
