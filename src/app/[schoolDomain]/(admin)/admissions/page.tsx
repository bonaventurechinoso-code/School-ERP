import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import { checkRouteAuthorization } from "@/lib/admissions.service";
import {
  normalizeCandidateName,
  normalizeCandidateGrade,
  isInstitutionalApplicationNo,
  buildDeterministicAdmissionKey,
  mergeDuplicateAdmissionsApplications,
} from "@/lib/admissions-deduplication.service";
import AdmissionsWorkspaceClient, {
  SerializedApplication,
  SerializedTransaction,
  AdmissionCycleItem,
} from "./AdmissionsWorkspaceClient";

const TIER_CONFIG = {
  CRECHE: {
    showPostUTME: false,
    showOLevel: false,
    showProgramDept: false,
    applicantLabel: "Child",
    programLabel: "GROUP / ROOM",
    searchPlaceholder: "Search by child name, parent name...",
    topCards: ["INQUIRIES", "PARENT SCREENING", "ASSESSMENT", "OFFERS", "ENROLLED"],
    columns: ["CHILD FULL NAME", "APPLICATION NO", "GROUP / ROOM", "AGE", "PARENT NAME", "STATUS", "FEE STATUS"],
  },
  PRIMARY: {
    showPostUTME: false,
    showOLevel: false,
    showProgramDept: false,
    applicantLabel: "Pupil",
    programLabel: "CLASS",
    searchPlaceholder: "Search by pupil name...",
    topCards: ["INQUIRIES", "SCREENING", "ASSESSMENT", "OFFERS", "ENROLLED"],
    columns: ["PUPIL FULL NAME", "APPLICATION NO", "CLASS", "AGE", "STATUS", "FEE STATUS"],
  },
  SECONDARY: {
    showPostUTME: false,
    showOLevel: true,
    showProgramDept: false,
    applicantLabel: "Student",
    programLabel: "CLASS / ARM",
    searchPlaceholder: "Search by student name, application number...",
    topCards: ["INQUIRIES", "SCREENING & KYC", "EXAMS & INTERVIEWS", "OFFERS EXTENDED", "MATRICULATED"],
    columns: ["STUDENT FULL NAME", "APPLICATION NO", "CLASS / ARM", "OLEVEL", "STATUS"],
  },
  TERTIARY: {
    showPostUTME: true,
    showOLevel: true,
    showProgramDept: true,
    applicantLabel: "Candidate",
    programLabel: "PROGRAM / DEPT",
    searchPlaceholder: "Search by candidate name, application number, JAMB reg...",
    topCards: ["INQUIRIES", "SCREENING & KYC", "EXAMS & INTERVIEWS", "OFFERS EXTENDED", "MATRICULATED"],
    columns: ["CANDIDATE FULL NAME", "APPLICATION NO", "PROGRAM / DEPT", "OLEVEL", "SCORE", "STATUS", "FEE STATUS"],
  },
};

function getTier(school: any): "CRECHE" | "PRIMARY" | "SECONDARY" | "TERTIARY" {
  if (school?.tier) {
    const t = String(school.tier).toUpperCase();
    if (t === "CRECHE" || t === "PRIMARY" || t === "SECONDARY" || t === "TERTIARY") {
      return t as any;
    }
  }
  const n = (school?.name || "").toLowerCase();
  if (n.includes("creche") || n.includes("daycare") || n.includes("crèche") || n.includes("nursery school")) return "CRECHE";
  if (n.includes("primary") || n.includes("basic") || n.includes("nursery")) return "PRIMARY";
  if (n.includes("secondary")) return "SECONDARY";
  return "TERTIARY";
}

export default async function AdmissionsPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;

  // 1. Session and RBAC Authorization
  const session = await getSession(undefined, schoolDomain);
  const auth = checkRouteAuthorization(session, { resource: "admissions", action: "view" });

  if (!auth.allowed) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-center shadow-sm">
        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-xl">
          ✕
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">403 Forbidden</h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2">
          {auth.reason || "Access Denied: You do not have permission to access the Admissions module."}
        </p>
      </div>
    );
  }

  const mutateAuth = checkRouteAuthorization(session, { resource: "admissions", action: "mutate" });
  const canMutate = mutateAuth.canMutate;

  // 2. Resolve Target School Institution
  const school = await basePrisma.school.findFirst({
    where: {
      OR: [{ subdomain: schoolDomain }, { slug: schoolDomain }],
    },
    include: {
      academicTiers: {
        orderBy: { level: "asc" },
      },
    },
  });

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
        <p>No school registered under domain: {schoolDomain}</p>
      </div>
    );
  }

  // 3. Query Admissions Applications scoped to tenant
  // Auto-reconcile / backfill any pending AdmissionLead or AdmissionRegister records into AdmissionsApplication
  try {
    const existingApps = await basePrisma.admissionsApplication.findMany({
      where: { schoolId: school.id },
      select: {
        id: true,
        applicationNumber: true,
        firstName: true,
        lastName: true,
        middleName: true,
        programId: true,
        academicSessionId: true,
        dateOfBirth: true,
        tierSpecificData: true,
        metadata: true,
      },
    });
    const knownAppNos = new Set(existingApps.map((a) => a.applicationNumber));

    const pendingRegisters = await basePrisma.admissionRegister.findMany({
      where: { tenantId: school.id },
      take: 50,
    });

    for (const reg of pendingRegisters) {
      if (knownAppNos.has(reg.applicationNo)) continue;

      const regFullName = `${reg.firstName || ""} ${reg.lastName || ""}`.trim();
      const normRegName = normalizeCandidateName(regFullName);
      const normRegClass = normalizeCandidateGrade(reg.classApplied);

      // Deterministic check: do NOT create duplicate if pupil already has an application
      const matchApp = existingApps.find((app) => {
        const appFullName = `${app.firstName || ""} ${app.middleName || ""} ${app.lastName || ""}`.trim();
        const normApp = normalizeCandidateName(appFullName);
        const nameMatch = normApp === normRegName || (normRegName.length > 5 && (normApp.includes(normRegName) || normRegName.includes(normApp)));
        if (!nameMatch) return false;

        const normAppClass = normalizeCandidateGrade(app.programId);
        return !normRegClass || !normAppClass || normAppClass === normRegClass;
      });

      if (matchApp) {
        // If matching application has temporary ID (APP-XXXXXX), upgrade to finalized institutional format!
        if (!isInstitutionalApplicationNo(matchApp.applicationNumber) && isInstitutionalApplicationNo(reg.applicationNo)) {
          await basePrisma.admissionsApplication.update({
            where: { id: matchApp.id },
            data: {
              applicationNumber: reg.applicationNo,
              metadata: {
                ...((matchApp.metadata as any) || {}),
                registerId: reg.id,
              },
            },
          }).catch(() => null);
          knownAppNos.delete(matchApp.applicationNumber);
          matchApp.applicationNumber = reg.applicationNo;
        }
        knownAppNos.add(reg.applicationNo);
        continue;
      }

      const currentYear = new Date().getFullYear();
      await basePrisma.admissionsApplication.create({
        data: {
          tenantId: school.id,
          schoolId: school.id,
          academicSessionId: currentYear + "/" + (currentYear + 1),
          programId: reg.classApplied || "Class 1",
          applicationNumber: reg.applicationNo,
          intakeChannel: "ONLINE_PORTAL",
          firstName: reg.firstName,
          lastName: reg.lastName,
          email: reg.email || (reg.applicationNo.toLowerCase().replace(/[^a-z0-9]/g, "") + "@applicant.schoolerp"),
          phoneNumber: reg.parentPhone || "N/A",
          whatsappNumber: reg.parentPhone || null,
          dateOfBirth: new Date(Date.now() - 10 * 365.25 * 24 * 60 * 60 * 1000),
          gender: "Unspecified",
          status: "PAYMENT_PENDING",
          tierSpecificData: {
            targetGrade: reg.classApplied,
            targetClass: reg.classApplied,
            parentPhone: reg.parentPhone,
            registerId: reg.id,
          },
        },
      }).catch(() => null);
      knownAppNos.add(reg.applicationNo);
    }

    const pendingLeads = await basePrisma.admissionLead.findMany({
      where: { schoolId: school.id },
      take: 50,
    });

    for (const lead of pendingLeads) {
      // If lead is already CONVERTED, it has already transitioned to register/application! Do NOT spawn APP-XXXXXX!
      if (lead.status === "CONVERTED") continue;

      const leadFullName = (lead.applicantName || "").trim();
      const normLeadName = normalizeCandidateName(leadFullName);
      const normLeadClass = normalizeCandidateGrade(lead.targetGrade);

      // Deterministic check: do NOT create duplicate if pupil already has an application
      const matchApp = existingApps.find((app) => {
        const appFullName = `${app.firstName || ""} ${app.middleName || ""} ${app.lastName || ""}`.trim();
        const normApp = normalizeCandidateName(appFullName);
        const nameMatch = normApp === normLeadName || (normLeadName.length > 5 && (normApp.includes(normLeadName) || normLeadName.includes(normApp)));
        if (!nameMatch) return false;

        const normAppClass = normalizeCandidateGrade(app.programId);
        return !normLeadClass || !normAppClass || normAppClass === normLeadClass;
      });

      if (matchApp) {
        continue;
      }

      const generatedAppNo = (lead as any).applicationNo || ("APP-" + lead.id.slice(0, 6).toUpperCase());
      if (knownAppNos.has(generatedAppNo)) continue;

      const nameParts = leadFullName.split(" ");
      const firstName = nameParts[0] || "Student";
      const lastName = nameParts.slice(1).join(" ") || "Applicant";
      const currentYear = new Date().getFullYear();

      await basePrisma.admissionsApplication.create({
        data: {
          tenantId: school.id,
          schoolId: school.id,
          academicSessionId: currentYear + "/" + (currentYear + 1),
          programId: lead.targetGrade || "Class 1",
          applicationNumber: generatedAppNo,
          intakeChannel: "ONLINE_PORTAL",
          firstName,
          lastName,
          email: lead.studentEmail || lead.parentEmail || (generatedAppNo.toLowerCase().replace(/[^a-z0-9]/g, "") + "@applicant.schoolerp"),
          phoneNumber: lead.parentPhone || lead.parentContact || "N/A",
          whatsappNumber: lead.parentPhone || lead.parentContact || null,
          dateOfBirth: new Date(Date.now() - 10 * 365.25 * 24 * 60 * 60 * 1000),
          gender: "Unspecified",
          status: "PAYMENT_PENDING",
          tierSpecificData: {
            targetGrade: lead.targetGrade,
            targetClass: lead.targetGrade,
            parentName: lead.parentName,
            parentPhone: lead.parentPhone || lead.parentContact,
            leadId: lead.id,
          },
          metadata: {
            leadId: lead.id,
            uploadToken: (lead as any).uploadToken,
          },
        },
      }).catch(() => null);
      knownAppNos.add(generatedAppNo);
    }
  } catch (reconcileErr) {
    console.warn("[ADMISSIONS] Notice during auto-reconciliation:", reconcileErr);
  }

  // Wrap auditTrails include in try/catch - if table missing, fallback to empty array
  let rawApplications: any[] = [];
  try {
    rawApplications = await basePrisma.admissionsApplication.findMany({
      where: {
        schoolId: school.id,
      },
      include: {
        documents: {
          select: {
            id: true,
            documentType: true,
            storageKey: true,
            verificationStatus: true,
            rejectionReason: true,
          },
        },
        feeTransactions: {
          select: {
            id: true,
            paymentMethod: true,
            amount: true,
            currency: true,
            paymentReference: true,
            paymentStatus: true,
            proofOfPaymentUrl: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        auditTrails: {
          select: {
            id: true,
            action: true,
            actorId: true,
            fromStage: true,
            toStage: true,
            ipAddress: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  } catch (auditErr) {
    console.warn("[ADMISSIONS] Failed querying applications with auditTrails, falling back without auditTrails:", auditErr);
    try {
      rawApplications = await basePrisma.admissionsApplication.findMany({
        where: {
          schoolId: school.id,
        },
        include: {
          documents: {
            select: {
              id: true,
              documentType: true,
              storageKey: true,
              verificationStatus: true,
              rejectionReason: true,
            },
          },
          feeTransactions: {
            select: {
              id: true,
              paymentMethod: true,
              amount: true,
              currency: true,
              paymentReference: true,
              paymentStatus: true,
              proofOfPaymentUrl: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
    } catch (fallbackErr) {
      console.error("[ADMISSIONS] Critical fallback: Failed querying applications:", fallbackErr);
      rawApplications = [];
    }
  }

  // Self-healing deduplication pass for rawApplications:
  // If identical pupil applications exist with distinct application number formats (e.g. portal APP-7F6950 vs localized EGEDE/2026/0001),
  // merge them into the finalized institutional record so the Admissions Register Table renders cleanly without duplicates!
  const deduplicatedApps: any[] = [];
  const compositeKeyMap = new Map<string, any>();

  for (const app of rawApplications) {
    const fullName = `${app.firstName || ""} ${app.middleName || ""} ${app.lastName || ""}`.trim();
    const dKey = buildDeterministicAdmissionKey({
      fullName,
      className: app.programId,
      dateOfBirth: app.dateOfBirth,
      session: app.academicSessionId,
    });

    if (!compositeKeyMap.has(dKey)) {
      compositeKeyMap.set(dKey, app);
      deduplicatedApps.push(app);
    } else {
      const existing = compositeKeyMap.get(dKey);
      // Prefer finalized localized institutional number (e.g. EGEDE/2026/0001) over temporary portal ID (APP-7F6950)
      if (isInstitutionalApplicationNo(app.applicationNumber) && !isInstitutionalApplicationNo(existing.applicationNumber)) {
        const idx = deduplicatedApps.indexOf(existing);
        if (idx !== -1) deduplicatedApps[idx] = app;
        compositeKeyMap.set(dKey, app);
        // Purge redundant temporary record from database
        basePrisma.admissionsApplication.delete({ where: { id: existing.id } }).catch(() => null);
      } else {
        // Current app is the duplicate; purge from database
        basePrisma.admissionsApplication.delete({ where: { id: app.id } }).catch(() => null);
      }
    }
  }
  rawApplications = deduplicatedApps;

  // Serialize applications for client component
  const applications: SerializedApplication[] = (rawApplications || []).map((app: any) => ({
    id: app.id,
    tenantId: app.tenantId || school.id,
    schoolId: app.schoolId || school.id,
    academicSessionId: app.academicSessionId,
    programId: app.programId,
    applicationNumber: app.applicationNumber,
    intakeChannel: app.intakeChannel,
    firstName: app.firstName,
    lastName: app.lastName,
    middleName: app.middleName,
    email: app.email,
    phoneNumber: app.phoneNumber,
    whatsappNumber: app.whatsappNumber,
    dateOfBirth: app.dateOfBirth
      ? app.dateOfBirth instanceof Date
        ? app.dateOfBirth.toISOString().split("T")[0]
        : new Date(app.dateOfBirth).toISOString().split("T")[0]
      : "",
    gender: app.gender,
    status: app.status,
    tierSpecificData: (app.tierSpecificData as any) || {},
    documents: (app.documents || []).map((d: any) => ({
      id: d.id,
      documentType: d.documentType,
      storageKey: d.storageKey,
      verificationStatus: d.verificationStatus,
      rejectionReason: d.rejectionReason,
    })),
    feeTransactions: (app.feeTransactions || []).map((t: any) => ({
      id: t.id,
      paymentMethod: t.paymentMethod,
      amount: Number(t.amount),
      currency: t.currency,
      paymentReference: t.paymentReference,
      paymentStatus: t.paymentStatus,
      proofOfPaymentUrl: t.proofOfPaymentUrl,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : new Date(t.createdAt).toISOString(),
    })),
    auditTrails: (app.auditTrails || []).map((a: any) => ({
      id: a.id,
      action: a.action,
      actorId: a.actorId,
      fromStage: a.fromStage,
      toStage: a.toStage,
      ipAddress: a.ipAddress,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : new Date(a.createdAt).toISOString(),
    })),
    metadata: (app.metadata as any) || {},
    createdAt: app.createdAt instanceof Date ? app.createdAt.toISOString() : new Date(app.createdAt).toISOString(),
  }));

  // 4. Query Admission Cycles for session filtering (with tenantId & schoolId scoping and catch fallback)
  let rawCycles: any[] = [];
  try {
    rawCycles = await basePrisma.admissionCycle.findMany({
      where: {
        schoolId: school.id,
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => []);
    if (!rawCycles || rawCycles.length === 0) {
      rawCycles = await basePrisma.admissionCycle.findMany({
        where: {
          OR: [{ schoolId: school.id }, { tenantId: school.id }],
        },
        orderBy: { createdAt: "desc" },
      }).catch(() => []);
    }
  } catch (cycleErr) {
    console.warn("[ADMISSIONS] AdmissionCycle table query failed, falling back to empty:", cycleErr);
    rawCycles = [];
  }

  const currentYear = new Date().getFullYear();
  const defaultSession = `${currentYear}/${currentYear + 1}`;

  const cycles: AdmissionCycleItem[] =
    rawCycles && rawCycles.length > 0
      ? rawCycles.map((c: any) => ({
          id: c.id,
          session: c.session || c.academicSession || defaultSession,
          name: c.name || `${c.academicSession || defaultSession} Cycle`,
          tier: String(c.tier),
          applicationFee: c.applicationFee ?? Number(c.applicationFeeAmount) ?? 5000,
          isActive: Boolean(c.isActive),
        }))
      : [
          {
            id: "default-cycle",
            session: defaultSession,
            name: `${defaultSession} General Admissions Cycle`,
            tier: school.academicTiers[0]?.name || "PRIMARY",
            applicationFee: 5000,
            isActive: true,
          },
        ];

  // 5. Query Admissions Fee Transactions for embedded reconciliation
  let rawTransactions: any[] = [];
  try {
    rawTransactions = await basePrisma.admissionsFeeTransaction.findMany({
      where: {
        OR: [
          { tenantId: school.id },
          { application: { schoolId: school.id } },
        ],
      },
      include: {
        application: {
          select: {
            id: true,
            applicationNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            whatsappNumber: true,
            programId: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }).catch(() => []);
  } catch (txErr) {
    console.warn("[ADMISSIONS] Failed querying fee transactions, defaulting to empty:", txErr);
    rawTransactions = [];
  }

  const transactions: SerializedTransaction[] = (rawTransactions || []).map((tx: any) => ({
    id: tx.id,
    tenantId: tx.tenantId || school.id,
    applicationId: tx.applicationId,
    paymentMethod: tx.paymentMethod,
    amount: Number(tx.amount),
    currency: tx.currency,
    paymentReference: tx.paymentReference,
    proofOfPaymentUrl: tx.proofOfPaymentUrl,
    paymentStatus: tx.paymentStatus,
    reconciliationNotes: tx.reconciliationNotes,
    verifiedByUserId: tx.verifiedByUserId,
    verifiedAt: tx.verifiedAt ? (tx.verifiedAt instanceof Date ? tx.verifiedAt.toISOString() : new Date(tx.verifiedAt).toISOString()) : null,
    createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : new Date(tx.createdAt).toISOString(),
    application: {
      id: tx.application?.id || "",
      applicationNumber: tx.application?.applicationNumber || "N/A",
      firstName: tx.application?.firstName || "",
      lastName: tx.application?.lastName || "",
      email: tx.application?.email || "",
      phoneNumber: tx.application?.phoneNumber || "",
      whatsappNumber: tx.application?.whatsappNumber || null,
      programId: tx.application?.programId || "",
      status: tx.application?.status || "PENDING",
    },
  }));

  // 6. Tenant bank details
  const bankDetails = {
    bankName: school.settlementBankName || "Zenith Bank Plc",
    accountNumber: school.settlementAccountNumber || "1012345678",
    accountName: school.settlementAccountName || school.name,
  };

  const academicTiers = school.academicTiers.map((t) => ({
    id: t.id,
    name: t.name,
    level: t.level ?? 1,
  }));

  const tier = school.tier || getTier(school);
  const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.PRIMARY;

  return (
    <div className="space-y-6 w-full min-h-screen flex flex-col p-2 sm:p-4">
      {/* Admissions Client Workspace */}
      <AdmissionsWorkspaceClient
        school={school}
        tier={tier}
        schoolId={school.id}
        schoolDomain={schoolDomain}
        schoolName={school.name}
        tierConfig={tierConfig}
        initialApplications={applications}
        initialTransactions={transactions}
        cycles={cycles}
        academicTiers={academicTiers}
        bankDetails={bankDetails}
        canMutate={canMutate}
      />
    </div>
  );
}
