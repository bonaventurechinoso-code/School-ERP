import { requireAuth } from "../../security/auth-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
