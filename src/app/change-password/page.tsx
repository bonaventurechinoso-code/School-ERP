import React from "react";
import SecurityPasswordForm from "@/components/SecurityPasswordForm";
import { getSession } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { basePrisma } from "@/lib/tenant-prisma";

export default async function UniversalChangePasswordPage() {
  const session = await getSession();
  const schoolDomain = session?.schoolDomain || "york";
  const effectiveRole = session?.role || session?.staffRole || "STAFF";

  // Look up school brand color if possible
  let brandColor = "#4f46e5";
  if (schoolDomain) {
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: schoolDomain.toLowerCase().trim() },
          { slug: schoolDomain.toLowerCase().trim() },
        ],
      },
    });
    if ((school as any)?.branding?.primaryColor) {
      brandColor = (school as any).branding.primaryColor;
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 selection:bg-indigo-900">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <Image
              src="/img/business-logo.png"
              alt="School ERP"
              width={28}
              height={28}
              className="w-7 h-7 rounded-lg object-contain shadow-xs"
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Account Security &bull; Mandatory Password Change
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
