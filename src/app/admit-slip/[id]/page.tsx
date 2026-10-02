import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import { SearchX } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import AdmitSlipClientView from "@/app/[schoolDomain]/(public)/admissions/admit-slip/[id]/AdmitSlipClientView";
import { getExamSubjectsForTier } from "@/lib/tenant-tier-utils";

export default async function GenericAdmitSlipPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;
  const { id } = params;
  const decodedId = decodeURIComponent(id || "");

  // Look up applicant in AdmissionLead or AdmissionRegister
  const lead = await basePrisma.admissionLead.findFirst({
    where: {
      OR: [
        { id: decodedId },
        { uploadToken: decodedId },
        { parentContact: decodedId },
        { parentEmail: decodedId },
      ],
    },
    include: { tier: true, school: true },
  });

  let register = null;
  let school: any = lead?.school;

  if (!lead) {
    register = await basePrisma.admissionRegister.findFirst({
      where: {
        OR: [
          { id: decodedId },
          { applicationNo: decodedId },
        ],
      },
    });

    if (register) {
      school = await basePrisma.school.findUnique({
        where: { id: register.tenantId },
      });
    }
  }

  if (!lead && !register) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full mb-3 text-left">
          <BackButton />
        </div>
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 text-center animate-in fade-in">
          <SearchX className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Admit Slip Not Found</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
            No applicant record was found matching ID <strong className="font-mono">{decodedId}</strong>.
          </p>
        </div>
      </div>
    );
  }

  const schoolName = school?.name || "School ERP";
  const schoolDomain = school?.subdomain || "portal";
  const applicantName = lead?.applicantName || `${register?.firstName} ${register?.lastName}`;
  const targetGrade = lead?.targetGrade || register?.classApplied || "Class 1";
  const tierName = lead?.tier?.name || "General";
  const parentPhone = lead?.parentPhone || lead?.parentContact || register?.parentPhone || "N/A";

  const docs = (lead?.documents as any) || {};
  const schedule = docs.examSchedule || {};
  const examNo = schedule.rollNo || `EXM-${schoolDomain.toUpperCase()}-2026-${(lead?.id || register?.id || "").substring(0, 5).toUpperCase()}`;
  const examDate = schedule.testDate || "Saturday, 27th September 2026";
  const arrivalTime = schedule.arrivalTime || "08:30 AM Prompt";
  const venue = schedule.venue || "Main ICT Complex / Hall A";
  const subjects = schedule.subjects || getExamSubjectsForTier(tierName, targetGrade).join(", ");

  return (
    <AdmitSlipClientView
      schoolName={schoolName}
      schoolDomain={schoolDomain}
      applicantName={applicantName}
      targetGrade={targetGrade}
      tierName={tierName}
      parentPhone={parentPhone}
      examNo={examNo}
      examDate={examDate}
      arrivalTime={arrivalTime}
      venue={venue}
      subjects={subjects}
    />
  );
}
