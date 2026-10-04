import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function SchoolAdminRedirect() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const role = (session.role || session.userRole || "").toUpperCase();
  if (role === "SUPER_ADMIN") {
    redirect("/admin");
  }
  const slug = session.schoolDomain || (session as any).tenantSlug;
  if (slug) {
    redirect(`/${slug}/dashboard`);
  }
  redirect("/login");
}
