import { redirect } from "next/navigation";

export default async function NonTeachingStaffRedirectPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/staff?role=NON_TEACHING`);
}
