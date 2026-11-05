import { redirect } from "next/navigation";

export default async function SettingsPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }> | { schoolDomain: string };
}) {
  const params = await Promise.resolve(paramsPromise);
  redirect(`/${params.schoolDomain}/portal-settings`);
}
