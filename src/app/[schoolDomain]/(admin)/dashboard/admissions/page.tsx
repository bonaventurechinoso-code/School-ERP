import { redirect } from "next/navigation";

export default async function DashboardAdmissionsRedirect({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/admissions`);
}
