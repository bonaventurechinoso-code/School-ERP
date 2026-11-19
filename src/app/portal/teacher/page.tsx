import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { basePrisma } from "@/lib/tenant-prisma";

export default async function PortalTeacherRedirectPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?callbackUrl=/portal/teacher");
  }
  const targetDomain = session.schoolDomain;
  if (!targetDomain) {
    redirect("/login");
  }

  const userRole = (session.role || session.userRole || "").toUpperCase();
  if (["SCHOOL_ADMIN", "TENANT_ADMIN", "ADMIN"].includes(userRole)) {
    redirect(`/${targetDomain}/dashboard?denied=teacher_portal_restricted`);
  }

  redirect(`/${targetDomain}/portal/staff`);
}
