import { redirect } from "next/navigation";

export default async function TenantBankRedirectPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  redirect(`/${schoolDomain}/finance/bank-account`);
}
