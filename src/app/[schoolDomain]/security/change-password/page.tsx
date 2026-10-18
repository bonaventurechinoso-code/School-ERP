import React from "react";
import { notFound, redirect } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import SecurityPasswordForm from "@/components/SecurityPasswordForm";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";

export default async function ChangePasswordPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams: Promise<{ forced?: string; role?: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const isForced = searchParams.forced === "true" || searchParams.forced === "1";
  if (isForced && schoolDomain.toLowerCase() === "demo") {
    redirect("/demo/dashboard");
  }
  const session = await getSession();
  const effectiveRole = searchParams.role || session?.role || session?.staffRole;

  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: schoolDomain.toLowerCase().trim() },
        { slug: schoolDomain.toLowerCase().trim() },
      ],
    },
  });

  if (!school) {
    return notFound();
  }

  const brandColor = (school as any)?.branding?.primaryColor || "#4f46e5";

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
              {school.name} &bull; Security
            </span>
          </div>

          {!isForced && (
            <Link
              href={`/${school.subdomain}/dashboard`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
          )}
        </div>

        <SecurityPasswordForm
          schoolDomain={school.subdomain}
          isForcedReset={isForced}
          brandColor={brandColor}
          userRole={effectiveRole}
        />
      </div>
    </div>
  );
}
