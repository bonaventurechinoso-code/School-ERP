import { redirect } from "next/navigation";

export default async function TenantTeachersRedirectPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/staff?filter=teaching`);
}
