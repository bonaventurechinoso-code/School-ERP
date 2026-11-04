import { redirect } from "next/navigation";

export default async function AdminAdmissionsRedirect({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/admissions`);
}
