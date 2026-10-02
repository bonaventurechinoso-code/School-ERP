import React from "react";
import BackButton from "@/components/ui/BackButton";
import { basePrisma } from "@/lib/tenant-prisma";
import TrackApplicationClient from "@/app/[schoolDomain]/(public)/admissions/track/[...appNo]/TrackApplicationClient";
import { SearchX } from "lucide-react";

export default async function GenericTrackPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;
  const { id } = params;
  const decodedId = decodeURIComponent(id || "");

  // Look up register record by applicationNo or id
  const register = await basePrisma.admissionRegister.findFirst({
    where: {
      OR: [{ applicationNo: decodedId }, { id: decodedId }],
    },
  });

  if (!register) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full mb-3 text-left">
          <BackButton />
        </div>
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-lg border border-slate-200 dark:border-zinc-800 text-center animate-in fade-in">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <SearchX className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-zinc-100">
            Application Not Found
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
            No application was found matching reference number <strong className="font-mono">{decodedId}</strong>.
          </p>
        </div>
      </div>
    );
  }

  const school = await basePrisma.school.findUnique({
    where: { id: register.tenantId },
  });

  // Resolve linked AdmissionLead for verification logs, rejection remarks, or document metadata
  const cleanRef = register.id.replace(/^ADM-|^APP-/, "").trim().toLowerCase();
  const appNoClean = register.applicationNo.replace(/^ADM-|^APP-/, "").trim().toLowerCase();
  const linkedLead = await basePrisma.admissionLead.findFirst({
    where: {
      schoolId: register.tenantId,
      OR: [
        { id: register.id },
        ...(cleanRef ? [{ id: { contains: cleanRef, mode: "insensitive" as const } }] : []),
        ...(appNoClean ? [{ id: { contains: appNoClean, mode: "insensitive" as const } }] : []),
        ...(register.email ? [{ studentEmail: register.email }, { parentEmail: register.email }] : []),
        ...(register.parentPhone ? [{ parentPhone: register.parentPhone }, { parentContact: register.parentPhone }] : []),
        { applicantName: `${register.firstName} ${register.lastName}` },
      ],
    },
    include: { notes: { orderBy: { createdAt: "desc" } } },
  }).catch(() => null);

  let adminComments: string | null = null;
  if (linkedLead?.notes && Array.isArray(linkedLead.notes) && linkedLead.notes.length > 0) {
    adminComments = linkedLead.notes[0]?.content || null;
  }
  if (!adminComments && linkedLead?.logs) {
    try {
      const logs = typeof linkedLead.logs === "string" ? JSON.parse(linkedLead.logs) : linkedLead.logs;
      if (Array.isArray(logs)) {
        const rejectLog = logs.find((l: any) => l.action?.toString().toUpperCase().includes("REJECT") || l.remarks || l.comment);
        if (rejectLog) {
          adminComments = rejectLog.remarks || rejectLog.comment || null;
        }
      }
    } catch {}
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto pt-5 px-4 sm:px-6">
        <BackButton />
      </div>
      <TrackApplicationClient
        schoolDomain={school?.subdomain || "portal"}
        schoolId={school?.id || register.tenantId}
        schoolName={school?.name || "School ERP"}
        contactPhone={school?.contactPhone}
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
          documents: linkedLead?.documents as any,
          adminComments: adminComments || null,
          verificationLogs: linkedLead?.logs as any,
        }}
      />
    </div>
  );
}
