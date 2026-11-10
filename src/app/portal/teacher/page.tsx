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

  redirect(`/${targetDomain}/portal/staff`);
}
