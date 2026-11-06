import React from "react";
import { getSchoolBankDetails } from "./actions";
import BankSettingsClient from "./BankSettingsClient";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { ShieldAlert, ArrowRight, Calendar } from "lucide-react";

export default async function SchoolBankSettingsPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const params = await paramsPromise;
  const schoolDomain = params.schoolDomain;

  const session = await getSession(undefined, schoolDomain);
  if (!session) {
    redirect(`/${schoolDomain}/login`);
  }

  const role = (session?.role || "").toUpperCase();
  const staffRole = (session?.staffRole || "").toUpperCase();

  const isSuperAdmin =
    role === "SUPER_ADMIN" ||
    role === "SUPERADMIN" ||
    session?.isSuperAdmin === true;

  const isTenantAdmin =
    role === "TENANT_ADMIN" ||
    role === "SCHOOL_ADMIN" ||
    role === "ADMIN" ||
    role === "SCHOOL_OWNER" ||
    role === "TENANT_OWNER" ||
    staffRole.includes("ADMIN") ||
    staffRole.includes("PRINCIPAL") ||
    staffRole.includes("PROPRIETOR") ||
    staffRole.includes("DIRECTOR");

  const isRestrictedOfficer =
    role.includes("REGISTRAR") ||
    role.includes("ADMISSION") ||
    staffRole.includes("REGISTRAR") ||
    staffRole.includes("ADMISSION");

  // Strict RBAC: Only Tenant Admin has permission to access or modify institution bank details
  if (!isSuperAdmin && (!isTenantAdmin || isRestrictedOfficer)) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 mx-auto flex items-center justify-center font-bold shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-50">
            Access Restricted: Bank Module
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            Registrars and Admission Officers are restricted from accessing institutional bank modules. Only the <strong>Tenant Administrator</strong> has permission to view, configure, change, or reset institution bank details.
          </p>
        </div>
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/${schoolDomain}/admissions?tab=exams`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm"
          >
            <Calendar className="w-4 h-4" />
            <span>Go to Entrance Examination Schedules</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`/${schoolDomain}/admissions`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
          >
            <span>Admissions Workspace</span>
          </Link>
        </div>
      </div>
    );
  }

  const school = await getSchoolBankDetails(schoolDomain);

  if (!school) {
    notFound();
  }

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
          Direct Bank Collection Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Setup and manage the official commercial bank account where parents transfer tuition fees directly.
        </p>
      </div>

      <BankSettingsClient
        schoolDomain={schoolDomain}
        initialData={{
          name: school.name,
          settlementBankName: school.settlementBankName,
          settlementBankCode: school.settlementBankCode,
          settlementAccountNumber: school.settlementAccountNumber,
          settlementAccountName: school.settlementAccountName,
          paymentInstruction: school.paymentInstruction,
          collectionMode: school.collectionMode,
        }}
      />
    </div>
  );
}
