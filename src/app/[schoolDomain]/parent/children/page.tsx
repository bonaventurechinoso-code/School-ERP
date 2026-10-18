import { redirect } from "next/navigation";

export default async function ParentChildrenRedirect({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/parents`);
}
