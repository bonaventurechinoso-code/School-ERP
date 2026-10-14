import { requireAuth } from "../../security/auth-guard";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
