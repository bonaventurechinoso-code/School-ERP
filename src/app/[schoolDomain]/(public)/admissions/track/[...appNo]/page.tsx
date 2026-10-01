import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import TrackApplicationClient from "./TrackApplicationClient";
import { Building2, SearchX } from "lucide-react";
import BackButton from "@/components/ui/BackButton";

export default async function TrackApplicationPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string; appNo: string[] }>;
}) {
  const params = await paramsPromise;
  const { schoolDomain } = params;
  const fullAppNo = Array.isArray(params.appNo) ? params.appNo.join('/') : params.appNo;
  const decodedAppNo = decodeURIComponent(fullAppNo || "");
  console.log("TRACK PAGE: Looking for", decodedAppNo);

  // 1. Resolve tenant school
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
        <div className="max-w-md w-full mb-3 text-left">
          <BackButton />
        </div>
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

  // 2. Resolve application record from admissionRegister
  let register = await basePrisma.admissionRegister.findFirst({
    where: {
      tenantId: school.id,
      OR: [
        { applicationNo: decodedAppNo },
        { id: decodedAppNo },
      ],
    },
  });

  // 3. Fallback: if not yet in admissionRegister, check admissionLead
  if (!register) {
    const lead = await basePrisma.admissionLead.findFirst({
      where: {
        schoolId: school.id,
        OR: [
          { id: decodedAppNo },
          { uploadToken: decodedAppNo },
        ],
      },
    });

    if (lead) {
      const nameParts = (lead.applicantName || "Student").trim().split(" ");
      const firstName = nameParts[0] || "Student";
      const lastName = nameParts.slice(1).join(" ") || "Applicant";
      const generatedAppNo = `APP-${lead.id.slice(0, 6).toUpperCase()}`;

      const existing = await basePrisma.admissionRegister.findFirst({
        where: { tenantId: school.id, applicationNo: generatedAppNo },
      });
      if (existing) {
        register = existing;
      } else {
        register = await basePrisma.admissionRegister.create({
          data: {
            tenantId: school.id,
            applicationNo: generatedAppNo,
            firstName,
            lastName,
            classApplied: lead.targetGrade || "Class 1",
            parentPhone: lead.parentPhone || lead.parentContact || "N/A",
            email: lead.studentEmail || lead.parentEmail || null,
            status: "docs_pending",
          },
        }).catch(async () => {
          return await basePrisma.admissionRegister.findFirst({
            where: { tenantId: school.id, applicationNo: generatedAppNo },
          });
        });
      }
    }
  }

  if (!register) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full mb-3 text-left">
          <BackButton />
        </div>
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 sm:p-10 rounded-3xl shadow-lg border border-slate-200 dark:border-zinc-800 text-center animate-in fade-in">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-5">
            <SearchX className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-zinc-100">
            Application Not Found
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2.5 leading-relaxed">
            No application was found matching reference number <strong className="font-mono text-slate-800 dark:text-zinc-200">{decodedAppNo}</strong>.
          </p>
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-400">
            Please check your email confirmation or contact admissions at{" "}
            <strong>{school.contactPhone || "+234 (0) 800-SCHOOL-ERP"}</strong>.
          </div>
        </div>
      </div>
    );
  }

  const brandColor = "#4f46e5";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto pt-5 px-4 sm:px-6">
        <BackButton />
      </div>
      <TrackApplicationClient
        schoolDomain={school.subdomain || schoolDomain}
        schoolId={school.id}
        schoolName={school.name}
        contactPhone={school.contactPhone}
        brandColor={brandColor}
        applicant={{
          id: register.id,
          applicationNo: register.applicationNo,
          firstName: register.firstName,
          lastName: register.lastName,
          classApplied: register.classApplied,
          parentPhone: register.parentPhone,
          email: register.email,
          status: register.status,
          credentialsJson: register.credentialsJson as any,
          createdAt: register.createdAt.toISOString(),
        }}
      />
    </div>
  );
}
