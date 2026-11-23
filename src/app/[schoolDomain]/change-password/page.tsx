export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import React from "react";
import { redirect } from "next/navigation";
import SecurityPasswordForm from "@/components/SecurityPasswordForm";
import { getSession } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { basePrisma } from "@/lib/tenant-prisma";

export default async function TenantChangePasswordPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }> | { schoolDomain: string };
}) {
  const { schoolDomain } = await Promise.resolve(paramsPromise);
  const normalizedDomain = (schoolDomain || "").toLowerCase().trim();

  if (normalizedDomain === "demo") {
    redirect("/demo/dashboard");
  }

  let session = null;
  try {
    session = await getSession(undefined, normalizedDomain);
  } catch (e) {
    console.warn("[TenantChangePasswordPage] getSession warning:", e);
  }

  let school = null;
  try {
    school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: normalizedDomain },
          { slug: normalizedDomain },
        ],
      },
      select: {
        id: true,
        name: true,
        logo: true,
        subdomain: true,
      },
    });
  } catch (e) {
    console.warn("[TenantChangePasswordPage] School lookup warning:", e);
  }

  const effectiveRole = session?.role || session?.staffRole || "STAFF";
  const schoolName = school?.name || "School Portal";
  const schoolLogo = school?.logo || "/img/business-logo.png";
  const brandColor = "#4f46e5";

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
          schoolDomain={normalizedDomain}
          isForcedReset={true}
          brandColor={brandColor}
          userRole={effectiveRole}
        />
      </div>
    </div>
  );
}
