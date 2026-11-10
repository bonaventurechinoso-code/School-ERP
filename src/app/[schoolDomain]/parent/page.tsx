import { redirect } from "next/navigation";

export default async function TenantParentRoute({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/portal/parent`);
}

