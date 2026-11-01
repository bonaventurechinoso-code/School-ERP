import { redirect } from "next/navigation";

export default async function SchoolReconciliationsRedirectPage({
  params: paramsPromise,
}: {
  params: Promise<{ school: string }>;
}) {
  const { school } = await paramsPromise;
  redirect(`/${school}/finance/admissions-reconciliations`);
}
