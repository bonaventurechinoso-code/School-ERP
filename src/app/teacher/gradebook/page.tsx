import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { basePrisma } from "@/lib/tenant-prisma";

export default async function GradebookPage() {
  const session = await getSession();
  const userRole = (session?.role || session?.userRole || "").toUpperCase();
  let targetDomain = session?.schoolDomain || session?.schoolCode;
  if (!targetDomain) {
    const defaultSchool = await basePrisma.school.findFirst({
      where: { isActive: true },
      select: { subdomain: true },
    });
    targetDomain = defaultSchool?.subdomain || "greenwood";
  }

  // School Admins do not have access to the Teacher Dashboard or Gradebook
  if (["SCHOOL_ADMIN", "TENANT_ADMIN", "ADMIN"].includes(userRole)) {
    redirect(`/${targetDomain}/dashboard?denied=teacher_portal_restricted`);
  }

  redirect(`/${targetDomain}/portal/staff?tab=gradebook`);
}
