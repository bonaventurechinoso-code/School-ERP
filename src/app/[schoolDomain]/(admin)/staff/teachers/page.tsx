import { redirect } from "next/navigation";

export default async function TeachersRedirectPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/staff?role=TEACHER`);
}
