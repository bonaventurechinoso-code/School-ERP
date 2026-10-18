import { redirect } from "next/navigation";

export default async function ClassesPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/scheduling?tab=classes`);
}
