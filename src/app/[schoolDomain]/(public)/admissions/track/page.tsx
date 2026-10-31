import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import { redirect } from "next/navigation";
import { Building2, Search, ArrowRight, ShieldCheck } from "lucide-react";
import BackButton from "@/components/ui/BackButton";

export default async function AdmissionsTrackIndexPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams: Promise<{ token?: string; appNo?: string; applicationNo?: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const token = searchParams.token?.trim();
  const rawAppNo = (searchParams.appNo || searchParams.applicationNo)?.trim();

  // 1. Resolve Tenant School
  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: schoolDomain.toLowerCase().trim() },
        { slug: schoolDomain.toLowerCase().trim() },
        { id: schoolDomain },
      ],
    },
    select: {
      id: true,
      name: true,
      subdomain: true,
      contactPhone: true,
    },
  });

  if (!school) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 text-center">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Institution Not Found</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
            The school domain &ldquo;{schoolDomain}&rdquo; could not be identified.
          </p>
        </div>
      </div>
    );
  }

  // 2. Direct Application Number Redirect
  if (rawAppNo) {
    redirect(`/${schoolDomain}/admissions/track/${encodeURIComponent(rawAppNo)}`);
  }

  // 3. Token-based Ingestion & Redirection
  if (token) {
    // Check AdmissionLead by uploadToken or id
    const lead = await basePrisma.admissionLead.findFirst({
      where: {
        schoolId: school.id,
        OR: [{ uploadToken: token }, { id: token }],
      },
    });

    if (lead) {
      redirect(`/${schoolDomain}/admissions/upload/${lead.id}?token=${token}`);
    }

    // Check AdmissionRegister by id or applicationNo
    const register = await basePrisma.admissionRegister.findFirst({
      where: {
        tenantId: school.id,
        OR: [{ id: token }, { applicationNo: token }],
      },
    });

    if (register) {
      redirect(`/${schoolDomain}/admissions/track/${encodeURIComponent(register.applicationNo)}`);
    }
  }

  // 4. Default Interactive Lookup Form
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full mb-3 text-left">
        <BackButton />
      </div>

      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200 dark:border-zinc-800 text-center">
        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Search className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Track Your Application
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
          Enter your Application Reference Number (e.g., <code className="font-mono text-xs bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">APP-123456</code>) or secure access token to view admission status and upload receipts.
        </p>

        <form
          action={async (formData: FormData) => {
            "use server";
            const appNo = formData.get("appNo")?.toString().trim();
            if (appNo) {
              redirect(`/${schoolDomain}/admissions/track/${encodeURIComponent(appNo)}`);
            }
          }}
          className="mt-6 space-y-4"
        >
          <div className="relative">
            <input
              type="text"
              name="appNo"
              required
              placeholder="e.g. APP-00214 or Token"
              className="w-full px-4 py-3.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-sm placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-xs"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <span>Lookup Application</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Encrypted Applicant Security Portal</span>
        </div>
      </div>
    </div>
  );
}

