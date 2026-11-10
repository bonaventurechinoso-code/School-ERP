import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function TenantPortalIndexPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const session = await getSession(undefined, schoolDomain);

  if (!session) {
    redirect(`/${schoolDomain}/login?callbackUrl=${encodeURIComponent(`/${schoolDomain}/portal`)}`);
  }

  const userRole = (session.role || session.userRole || "").toUpperCase();

  if (userRole === "STUDENT") {
    redirect(`/${schoolDomain}/portal/student`);
  } else if (userRole === "PARENT") {
    redirect(`/${schoolDomain}/portal/parent`);
  } else if (userRole === "TEACHER" || userRole === "STAFF") {
    redirect(`/${schoolDomain}/portal/staff`);
  } else if (userRole === "BURSAR") {
    redirect(`/${schoolDomain}/portal/bursar`);
  } else if (userRole === "PRINCIPAL" || userRole === "HEADMASTER") {
    redirect(`/${schoolDomain}/portal/principal`);
  } else {
    redirect(`/${schoolDomain}/dashboard`);
  }
}

