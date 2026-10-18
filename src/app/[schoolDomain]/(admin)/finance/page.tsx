import { redirect } from "next/navigation";

export default async function FinanceRedirectPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/finance/bursar-workspace`);
}
