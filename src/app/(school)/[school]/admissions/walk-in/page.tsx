import { redirect } from "next/navigation";

export default async function SchoolWalkInRedirectPage({
  params: paramsPromise,
}: {
  params: Promise<{ school: string }>;
}) {
  const { school } = await paramsPromise;
  redirect(`/${school}/admissions/walk-in`);
}
