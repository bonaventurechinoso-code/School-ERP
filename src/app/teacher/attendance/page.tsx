import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { basePrisma } from "@/lib/tenant-prisma";

export default async function AttendancePage() {
  const session = await getSession();
  let targetDomain = session?.schoolDomain || session?.schoolCode;
  if (!targetDomain) {
    const defaultSchool = await basePrisma.school.findFirst({
      where: { isActive: true },
      select: { subdomain: true },
    });
    targetDomain = defaultSchool?.subdomain || "greenwood";
  }

  redirect(`/${targetDomain}/portal/staff?tab=attendance`);
}
