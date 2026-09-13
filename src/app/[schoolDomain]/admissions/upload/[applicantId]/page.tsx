import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import ApplicantUploadClient from "./ApplicantUploadClient";
import { ShieldAlert, PhoneCall, Building2 } from "lucide-react";

export default async function ApplicantUploadPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string; applicantId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { schoolDomain, applicantId } = await paramsPromise;
  const { token } = await searchParamsPromise;

  // 1. Resolve tenant school
  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolDomain },
    select: { id: true, name: true, subdomain: true, contactPhone: true },
  });

  if (!school) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800">Institution Not Found</h1>
          <p className="text-sm text-slate-500 mt-2">The school link you followed could not be identified.</p>
        </div>
      </div>
    );
  }

  // 2. Resolve applicant lead
  const lead = await basePrisma.admissionLead.findUnique({
    where: { id: applicantId },
    include: { tier: true },
  });

  const leadAny = lead as any;
  const isTokenValid = lead && token && leadAny.uploadToken === token;
  const isTokenExpired = leadAny?.uploadExpiresAt && new Date(leadAny.uploadExpiresAt) < new Date();

  // 3. Security Guard: Token validation
  if (!lead || !isTokenValid || isTokenExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
        <div className="max-w-lg w-full bg-white dark:bg-zinc-900 p-8 sm:p-10 rounded-2xl shadow-md border border-rose-100 dark:border-rose-950/40 text-center animate-in fade-in">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {isTokenExpired ? "Upload Link Expired" : "Access Denied"}
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2.5 leading-relaxed">
            {isTokenExpired
              ? "This secure credential upload link has expired for security reasons. Please reach out to the admissions office to receive a fresh submission link."
              : "No valid applicant authorization token was found in your link. Please use the direct link provided in your official admissions inquiry email."}
          </p>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
            <PhoneCall className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Admissions Desk: {school.contactPhone || "+234 (0) 800-SCHOOL-ERP"}</span>
          </div>
        </div>
      </div>
    );
  }

  // 4. Render interactive client portal
  return (
    <ApplicantUploadClient
      schoolDomain={schoolDomain}
      schoolName={school.name}
      contactPhone={school.contactPhone}
      applicantId={lead.id}
      token={token}
      applicantName={lead.applicantName}
      parentName={lead.parentName || "Parent / Guardian"}
      targetGrade={lead.targetGrade}
      tierName={lead.tier?.name || "Standard Tier"}
      status={lead.status}
      existingDocuments={leadAny.documents || {}}
      existingPassportUrl={leadAny.passportPhotoUrl}
      existingAcademicResultsUrl={leadAny.academicResultsUrl}
      existingBirthCertificateUrl={leadAny.birthCertificateUrl}
      existingMedicalRecordsUrl={leadAny.medicalRecordsUrl}
    />
  );
}
