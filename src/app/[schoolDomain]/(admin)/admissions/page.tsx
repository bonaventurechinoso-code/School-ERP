import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import { checkRouteAuthorization } from "@/lib/admissions.service";
import EnterpriseAdmissionsClient, {
  SerializedApplication,
  SerializedTransaction,
  AdmissionCycleItem,
} from "./EnterpriseAdmissionsClient";

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

  return (
    <div className="space-y-6 w-full min-h-screen flex flex-col p-2 sm:p-4">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
            Enterprise Admissions Workspace
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 text-xs sm:text-sm">
            Full lifecycle applicant processing: inquiries, document verification, post-UTME screening, batch provisional offers, fee reconciliation, and matriculation.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>{school.name}</span>
          </span>
        </div>
      </header>

      {/* Enterprise Admissions Client Workspace */}
      <EnterpriseAdmissionsClient
        schoolId={school.id}
        schoolDomain={schoolDomain}
        schoolName={school.name}
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
