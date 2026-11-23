export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import SecurityPasswordForm from "@/components/SecurityPasswordForm";
import { getSession } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { basePrisma } from "@/lib/tenant-prisma";

export default async function UniversalChangePasswordPage() {
  const cookieStore = await cookies();
  const cookieDomain = cookieStore.get("schoolDomain")?.value || cookieStore.get("activeSchoolDomain")?.value || "";

  let session = null;
  try {
    session = await getSession(undefined, cookieDomain || undefined);
  } catch (e) {
    console.warn("[build] getSession fallback in change-password:", e);
  }

  const schoolDomain = session?.schoolDomain || cookieDomain || "demo";
  if (schoolDomain.toLowerCase() === "demo") {
    redirect("/demo/dashboard");
  }
  const effectiveRole = session?.role || session?.staffRole || "STAFF";

  // Look up school details
  let brandColor = "#4f46e5";
  let schoolName = "School Portal";
  let schoolLogo = "/img/business-logo.png";

  if (schoolDomain) {
    try {
      const school = await basePrisma.school.findFirst({
        where: {
          OR: [
            { subdomain: schoolDomain.toLowerCase().trim() },
            { slug: schoolDomain.toLowerCase().trim() },
          ],
        },
        select: {
          name: true,
          logo: true,
        },
      });
      if (school?.name) schoolName = school.name;
      if (school?.logo) schoolLogo = school.logo;
    } catch (e) {
      console.warn("[build] School drift fallback", e);
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-900 flex flex-col justify-start py-6 sm:py-10 px-4 sm:px-6 overflow-y-auto selection:bg-indigo-900">
      <div className="w-full max-w-xl mx-auto my-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <Image
              src={schoolLogo}
              alt={schoolName}
              width={28}
              height={28}
              className="w-7 h-7 rounded-lg object-contain shadow-xs bg-white/10 p-0.5"
              unoptimized={true}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {schoolName} &bull; Mandatory Password Change
            </span>
          </div>
        </div>

        <SecurityPasswordForm
          schoolDomain={schoolDomain}
          isForcedReset={true}
          brandColor={brandColor}
          userRole={effectiveRole}
        />
      </div>
    </div>
  );
}
