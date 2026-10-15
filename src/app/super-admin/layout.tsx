import { requireSuperAdmin } from "../../security/auth-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return <>{children}</>;
}
