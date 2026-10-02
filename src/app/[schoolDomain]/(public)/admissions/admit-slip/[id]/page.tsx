import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import { Building2, SearchX } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import AdmitSlipClientView from "./AdmitSlipClientView";
import { getExamSubjectsForTier } from "@/lib/tenant-tier-utils";

export default async function PublicAdmitSlipPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string; id: string }>;
}) {
  const params = await paramsPromise;
  const { schoolDomain, id } = params;
  const decodedId = decodeURIComponent(id || "");

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

  // 2. Resolve AdmissionLead
  let lead = await basePrisma.admissionLead.findFirst({
    where: {
      schoolId: school.id,
      OR: [
        { id: decodedId },
        { uploadToken: decodedId },
        { parentContact: decodedId },
        { parentEmail: decodedId },
        { studentEmail: decodedId },
      ],
    },
    include: { tier: true },
  });

  // Fallback to AdmissionRegister if needed
  let register = null;
  if (!lead) {
    register = await basePrisma.admissionRegister.findFirst({
      where: {
        tenantId: school.id,
        OR: [
          { id: decodedId },
          { applicationNo: decodedId },
        ],
      },
    });

    if (register) {
      lead = {
        id: register.id,
        schoolId: school.id,
        tierId: "",
        applicantName: `${register.firstName} ${register.lastName}`,
        targetGrade: register.classApplied,
        parentContact: register.parentPhone,
        parentPhone: register.parentPhone,
        parentEmail: register.email,
        studentEmail: register.email,
        studentPhone: null,
        parentName: null,
        source: "Online Register",
        status: register.status,
        assignedCounselor: null,
        logs: [],
        offerToken: null,
        offerExpiresAt: null,
        uploadToken: null,
        uploadExpiresAt: null,
        passportPhotoUrl: null,
        academicResultsUrl: null,
        birthCertificateUrl: null,
        medicalRecordsUrl: null,
        documents: {},
        createdAt: new Date(register.createdAt),
        updatedAt: new Date(register.updatedAt),
        tier: null,
      } as any;
    }
  }

  if (!lead) {
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

  // 3. Extract or synthesize Exam Schedule details
  const docs = (lead.documents as any) || {};
  const schedule = docs.examSchedule || {};
  const examNo = schedule.rollNo || `EXM-${(schoolDomain || "GW").toUpperCase()}-2026-${lead.id.substring(0, 5).toUpperCase()}`;
  const examDate = schedule.testDate || "Saturday, 27th September 2026";
  const arrivalTime = schedule.arrivalTime || "08:30 AM Prompt";
  const venue = schedule.venue || "Main ICT Complex / Hall A";
  const subjects = schedule.subjects || getExamSubjectsForTier(lead.tier?.name, lead.targetGrade).join(", ");

  return (
    <AdmitSlipClientView
      schoolName={school.name}
      schoolDomain={school.subdomain}
      applicantName={lead.applicantName}
      targetGrade={lead.targetGrade}
      tierName={lead.tier?.name || "General"}
      parentPhone={lead.parentPhone || lead.parentContact}
      examNo={examNo}
      examDate={examDate}
      arrivalTime={arrivalTime}
      venue={venue}
      subjects={subjects}
    />
  );
}
