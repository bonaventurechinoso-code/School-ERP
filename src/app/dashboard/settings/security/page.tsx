import React from "react";
import SecurityPasswordForm from "@/components/SecurityPasswordForm";
import { getSession } from "@/lib/auth";
import { basePrisma } from "@/lib/tenant-prisma";
import Image from "next/image";
import Link from "next/link";
import { Shield, Lock, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";

export default async function DashboardSecuritySettingsPage() {
  const session = await getSession();
  const schoolDomain = session?.schoolDomain || "york";
  const userRole = (session?.role || session?.staffRole || "USER").toUpperCase();
  const userEmail = session?.email || "User";

  // Look up school brand color if possible
  let brandColor = "#4f46e5";
  let schoolName = "School Portal";
  if (schoolDomain) {
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: schoolDomain.toLowerCase().trim() },
          { slug: schoolDomain.toLowerCase().trim() },
        ],
      },
    });
    if (school) {
      schoolName = school.name;
      if ((school as any)?.branding?.primaryColor) {
        brandColor = (school as any).branding.primaryColor;
      }
    }
  }

  // Determine back link based on role
  let backLink = `/${schoolDomain}/dashboard`;
  if (userRole === "STUDENT") {
    backLink = `/${schoolDomain}/portal/student`;
  } else if (userRole === "BURSAR") {
    backLink = `/bursar`;
  } else if (userRole === "TEACHER") {
    backLink = `/${schoolDomain}/portal/staff`;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4">
          <Link
            href={backLink}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Role: {userRole}
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
            <Shield className="w-4 h-4" />
            <span>Security Center</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
            Account Security Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Update your authentication credentials for <span className="font-semibold text-slate-700 dark:text-zinc-300">{userEmail}</span> at {schoolName}.
          </p>
        </div>

        {/* Password Update Form */}
        <SecurityPasswordForm
          schoolDomain={schoolDomain}
          isForcedReset={false}
          brandColor={brandColor}
          userRole={userRole}
          endpoint="/api/change-password"
          logoutOnSuccess={true}
        />

        {/* Security Checklist Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 text-xs text-slate-600 dark:text-zinc-400 space-y-3 shadow-xs">
          <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200 flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-500" />
            <span>Enterprise Security Password Guidelines</span>
          </h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Must be at least 8 characters long</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Must contain at least 1 uppercase letter (A-Z)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Must contain at least 1 numeric digit (0-9)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Must contain at least 1 symbol/special character (e.g. !@#$%^&*)</span>
            </li>
            <li className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <KeyRound className="w-4 h-4 shrink-0" />
              <span>Changing your password will immediately terminate all active sessions and log you out for verification.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
