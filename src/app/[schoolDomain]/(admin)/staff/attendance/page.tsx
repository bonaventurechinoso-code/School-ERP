import { redirect } from "next/navigation";

export default async function StaffAttendanceRedirectPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/staff?tab=attendance`);
}
