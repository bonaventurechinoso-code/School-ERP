import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { basePrisma } from "@/lib/tenant-prisma";

export default async function StaffPortalPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ denied?: string; schoolDomain?: string; tab?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await getSession();

  if (!session) {
    const loginDomain = searchParams.schoolDomain;
    redirect(loginDomain ? `/${loginDomain}/login?callbackUrl=/portal/staff` : `/login?callbackUrl=/portal/staff`);
  }

  let targetDomain = searchParams.schoolDomain || session.schoolDomain;
  if (!targetDomain) {
    const defaultSchool = await basePrisma.school.findFirst({
      where: { isActive: true },
      select: { subdomain: true },
    });
    targetDomain = defaultSchool?.subdomain || "greenwood";
  }

  const queryParams = new URLSearchParams();
  if (searchParams.denied) queryParams.set("denied", searchParams.denied);
  if (searchParams.tab) queryParams.set("tab", searchParams.tab);
  const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";

  redirect(`/${targetDomain}/portal/staff${qs}`);
}
