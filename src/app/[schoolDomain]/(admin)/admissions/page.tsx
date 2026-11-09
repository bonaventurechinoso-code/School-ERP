import React from "react";
import { basePrisma, isDemoSchool, getDemoPrismaClient, setDemoSchoolId } from "@/lib/tenant-prisma";
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

function extractDocUrlStr(val: any): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed && trimmed !== "undefined" && trimmed !== "null" ? trimmed : null;
  }
  if (typeof val === "object" && !Array.isArray(val)) {
    const candidate = val.url || val.fileUrl || val.storageKey || val.path;
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      return trimmed && trimmed !== "undefined" && trimmed !== "null" ? trimmed : null;
    }
  }
  return null;
}

function mergeDocMapsNonDestructively(...maps: any[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const map of maps) {
    if (!map || typeof map !== "object" || Array.isArray(map)) continue;
    for (const [k, v] of Object.entries(map)) {
      if (v === undefined || v === null) continue;
      const existing = result[k];
      if (!existing) {
        result[k] = v;
        continue;
      }
      const existingUrl = extractDocUrlStr(existing);
      const incomingUrl = extractDocUrlStr(v);
      if (typeof existing === "object" && !Array.isArray(existing) && typeof v === "object" && !Array.isArray(v)) {
        const finalUrl = incomingUrl || existingUrl;
        result[k] = {
          ...existing,
          ...v,
          ...(finalUrl ? { url: finalUrl, fileUrl: (v as any).fileUrl || (existing as any).fileUrl || finalUrl } : {}),
        };
      } else if (typeof existing === "string" && typeof v === "object" && !Array.isArray(v)) {
        const finalUrl = incomingUrl || existingUrl;
        result[k] = {
          ...v,
          ...(finalUrl ? { url: finalUrl, fileUrl: (v as any).fileUrl || finalUrl } : {}),
        };
      } else if (typeof existing === "object" && !Array.isArray(existing) && typeof v === "string") {
        const finalUrl = incomingUrl || existingUrl;
        result[k] = {
          ...existing,
          ...(finalUrl ? { url: finalUrl, fileUrl: finalUrl } : {}),
        };
      } else {
        if (incomingUrl || !existingUrl) {
          result[k] = v;
        }
      }
    }
  }
  return result;
}

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
  let centralDb: any = (process.env.DEMO_DATABASE_URL && isDemoSchool(schoolDomain))
    ? getDemoPrismaClient()
    : basePrisma;

  let school = await centralDb.school.findFirst({
    where: {
      OR: [{ subdomain: schoolDomain }, { slug: schoolDomain }],
    },
    include: {
      academicTiers: {
        orderBy: { level: "asc" },
      },
    },
  });

  // If not found in primary and DEMO_DATABASE_URL is set, attempt lookup in demo database
  if (!school && process.env.DEMO_DATABASE_URL && centralDb === basePrisma) {
    try {
      const demoClient = getDemoPrismaClient();
      const demoSchool = await demoClient.school.findFirst({
        where: {
          OR: [{ subdomain: schoolDomain }, { slug: schoolDomain }],
        },
        include: {
          academicTiers: {
            orderBy: { level: "asc" },
          },
        },
      });
      if (demoSchool) {
        school = demoSchool;
        centralDb = demoClient;
      }
    } catch {
      // Ignore fallback lookup error
    }
  }

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
        <p>No school registered under domain: {schoolDomain}</p>
      </div>
    );
  }

  if (school.subdomain === "demo" || isDemoSchool(school.id) || isDemoSchool(schoolDomain)) {
    setDemoSchoolId(school.id);
  }

  // 3. Query Admissions Applications scoped to tenant
  // Auto-reconcile / backfill any pending AdmissionLead or AdmissionRegister records into AdmissionsApplication
  try {
    const existingApps: any[] = await centralDb.admissionsApplication.findMany({
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
        status: true,
        tierSpecificData: true,
        metadata: true,
      },
    });
    const knownAppNos = new Set(existingApps.map((a: any) => a.applicationNumber));

    const pendingRegisters: any[] = await centralDb.admissionRegister.findMany({
      where: { tenantId: school.id },
      take: 50,
    });

    for (const reg of pendingRegisters) {
      if (knownAppNos.has(reg.applicationNo)) continue;

      const regFullName = `${reg.firstName || ""} ${reg.lastName || ""}`.trim();
      const normRegName = normalizeCandidateName(regFullName);
      const normRegClass = normalizeCandidateGrade(reg.classApplied);

      // Deterministic check: do NOT create duplicate if pupil already has an application
      const matchApp = existingApps.find((app: any) => {
        const appFullName = `${app.firstName || ""} ${app.middleName || ""} ${app.lastName || ""}`.trim();
        const normApp = normalizeCandidateName(appFullName);
        const nameMatch = normApp === normRegName || (normRegName.length > 5 && (normApp.includes(normRegName) || normRegName.includes(normApp)));
        if (!nameMatch) return false;

        const normAppClass = normalizeCandidateGrade(app.programId);
        return !normRegClass || !normAppClass || normAppClass === normRegClass;
      });

      if (matchApp) {
        // If matching application has temporary ID (APP-XXXXXX), upgrade to finalized institutional format!
        // Safe document extraction - NEVER overwrite valid documents with empty credentialsJson
        const existingMetaDocs = (matchApp.metadata as any)?.documents || {};
        const rawRegCreds = reg.credentialsJson;
        let regDocs: any = {};
        if (Array.isArray(rawRegCreds)) {
          for (const d of (rawRegCreds as any[])) {
            if (d && typeof d === "object" && ((d as any).key || (d as any).type) && ((d as any).url || (d as any).fileUrl || (d as any).path)) {
              regDocs[(d as any).key || (d as any).type] = d;
            }
          }
        } else if (rawRegCreds && typeof rawRegCreds === "object") {
          if (Array.isArray((rawRegCreds as any).documents)) {
            for (const d of (rawRegCreds as any).documents) {
              if (d && typeof d === "object" && (d.key || d.type) && (d.url || d.fileUrl || d.path)) {
                regDocs[d.key || d.type] = d;
              }
            }
          } else {
            for (const [k, v] of Object.entries(rawRegCreds)) {
              if (v && typeof v === "object" && ((v as any).url || (v as any).fileUrl || (v as any).path)) {
                regDocs[k] = v;
              }
            }
          }
        }
        const mergedDocs = mergeDocMapsNonDestructively(existingMetaDocs, regDocs);

        const updateData: any = {
          metadata: {
            ...((matchApp.metadata as any) || {}),
            registerId: reg.id,
            documents: Object.keys(mergedDocs).length > 0 ? mergedDocs : existingMetaDocs,
            applicationFeeReceiptUrl: reg.applicationFeeReceiptUrl || reg.formFeeReceiptUrl || (matchApp.metadata as any)?.applicationFeeReceiptUrl,
          },
        };
        if (!isInstitutionalApplicationNo(matchApp.applicationNumber) && isInstitutionalApplicationNo(reg.applicationNo)) {
          updateData.applicationNumber = reg.applicationNo;
          knownAppNos.delete(matchApp.applicationNumber);
          matchApp.applicationNumber = reg.applicationNo;
        }
        await centralDb.admissionsApplication.update({
          where: { id: matchApp.id },
          data: updateData,
        }).catch(() => null);
        knownAppNos.add(reg.applicationNo);
        continue;
      }

      const currentYear = new Date().getFullYear();
      await centralDb.admissionsApplication.create({
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

    const pendingLeads: any[] = await centralDb.admissionLead.findMany({
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
      const matchApp = existingApps.find((app: any) => {
        const appFullName = `${app.firstName || ""} ${app.middleName || ""} ${app.lastName || ""}`.trim();
        const normApp = normalizeCandidateName(appFullName);
        const nameMatch = normApp === normLeadName || (normLeadName.length > 5 && (normApp.includes(normLeadName) || normLeadName.includes(normApp)));
        if (!nameMatch) return false;

        const normAppClass = normalizeCandidateGrade(app.programId);
        return !normLeadClass || !normAppClass || normAppClass === normLeadClass;
      });

      if (matchApp) {
        const leadDocs = (lead.documents as any) || {};
        if (Object.keys(leadDocs).length > 0) {
          const appMeta = (matchApp.metadata as any) || {};
          const appTierData = (matchApp.tierSpecificData as any) || {};
          const mergedDocs = mergeDocMapsNonDestructively(appMeta.documents || {}, appTierData.documents || {}, leadDocs);

          const updateData: any = {
            metadata: {
              ...appMeta,
              leadId: lead.id,
              documents: mergedDocs,
              applicationFeeReceiptUrl: mergedDocs.applicationFeeReceiptUrl || (lead as any).applicationFeeReceiptUrl || appMeta.applicationFeeReceiptUrl,
            },
            tierSpecificData: {
              ...appTierData,
              leadId: lead.id,
              documents: mergedDocs,
              applicationFeeReceiptUrl: mergedDocs.applicationFeeReceiptUrl || (lead as any).applicationFeeReceiptUrl || appTierData.applicationFeeReceiptUrl,
            },
          };

          // CRITICAL: Only advance status for early intake stages (DRAFT or PAYMENT_PENDING).
          // NEVER regress or overwrite an application that has been reviewed, approved, offered, enrolled, or rejected!
          const isEarlyIntake = !matchApp.status || matchApp.status === "DRAFT" || matchApp.status === "PAYMENT_PENDING";
          if (isEarlyIntake) {
            const hasFee = Boolean(mergedDocs.applicationFeeReceiptUrl || (lead as any).applicationFeeReceiptUrl);
            const hasDocs = Object.keys(mergedDocs).length > 1;
            const nextStatus = (hasFee && hasDocs) ? "UNDER_REVIEW" : hasDocs ? "SUBMITTED" : matchApp.status;
            if (nextStatus && nextStatus !== matchApp.status) {
              updateData.status = nextStatus as any;
              matchApp.status = nextStatus;
            }
          }

          await centralDb.admissionsApplication.update({
            where: { id: matchApp.id },
            data: updateData,
          }).catch(() => null);
        }
        continue;
      }

      const generatedAppNo = (lead as any).applicationNo || ("APP-" + lead.id.slice(0, 6).toUpperCase());
      if (knownAppNos.has(generatedAppNo)) continue;

      const nameParts = leadFullName.split(" ");
      const firstName = nameParts[0] || "Student";
      const lastName = nameParts.slice(1).join(" ") || "Applicant";
      const currentYear = new Date().getFullYear();

      await centralDb.admissionsApplication.create({
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
    rawApplications = await centralDb.admissionsApplication.findMany({
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
      rawApplications = await centralDb.admissionsApplication.findMany({
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
      // Preserve the more progressed/advanced stage between duplicates
      const STATUS_WEIGHT: Record<string, number> = {
        ENROLLED: 6,
        ADMITTED: 6,
        OFFER_EXTENDED: 5,
        APPROVED: 5,
        UNDER_REVIEW: 4,
        VERIFIED: 4,
        SUBMITTED: 3,
        PAYMENT_PENDING: 2,
        DRAFT: 1,
      };
      const existingWeight = STATUS_WEIGHT[existing.status] || 0;
      const appWeight = STATUS_WEIGHT[app.status] || 0;
      if (existingWeight > appWeight) {
        app.status = existing.status;
      } else if (appWeight > existingWeight) {
        existing.status = app.status;
      }

      // Prefer finalized localized institutional number (e.g. EGEDE/2026/0001) over temporary portal ID (APP-7F6950)
      if (isInstitutionalApplicationNo(app.applicationNumber) && !isInstitutionalApplicationNo(existing.applicationNumber)) {
        const idx = deduplicatedApps.indexOf(existing);
        if (idx !== -1) deduplicatedApps[idx] = app;
        compositeKeyMap.set(dKey, app);
        // Safely re-point documents & fee transactions before purging duplicate!
        centralDb.admissionsDocument.updateMany({
          where: { applicationId: existing.id },
          data: { applicationId: app.id },
        }).catch(() => null);
        centralDb.admissionsFeeTransaction.updateMany({
          where: { applicationId: existing.id },
          data: { applicationId: app.id },
        }).catch(() => null);
        app.documents = [...(app.documents || []), ...(existing.documents || [])];
        app.feeTransactions = [...(app.feeTransactions || []), ...(existing.feeTransactions || [])];
        app.metadata = { ...((existing.metadata as any) || {}), ...((app.metadata as any) || {}) };
        app.tierSpecificData = { ...((existing.tierSpecificData as any) || {}), ...((app.tierSpecificData as any) || {}) };
        // Purge redundant temporary record from database
        centralDb.admissionsApplication.delete({ where: { id: existing.id } }).catch(() => null);
      } else {
        // Current app is the duplicate; migrate its documents to existing before purging!
        centralDb.admissionsDocument.updateMany({
          where: { applicationId: app.id },
          data: { applicationId: existing.id },
        }).catch(() => null);
        centralDb.admissionsFeeTransaction.updateMany({
          where: { applicationId: app.id },
          data: { applicationId: existing.id },
        }).catch(() => null);
        existing.documents = [...(existing.documents || []), ...(app.documents || [])];
        existing.feeTransactions = [...(existing.feeTransactions || []), ...(app.feeTransactions || [])];
        existing.metadata = { ...((app.metadata as any) || {}), ...((existing.metadata as any) || {}) };
        existing.tierSpecificData = { ...((app.tierSpecificData as any) || {}), ...((existing.tierSpecificData as any) || {}) };
        centralDb.admissionsApplication.delete({ where: { id: app.id } }).catch(() => null);
      }
    }
  }
  rawApplications = deduplicatedApps;

  // Real-time document hydration pass: Ensure all uploaded credentials across AdmissionsDocument, AdmissionLead & AdmissionRegister are synchronized and rendered
  try {
    for (const app of rawApplications) {
      if (!app.documents) app.documents = [];

      const leadId = (app.metadata as any)?.leadId || (app.tierSpecificData as any)?.leadId;
      const cleanNo = (app.applicationNumber || "").replace(/^ADM-|^APP-/i, "").replace(/[^a-zA-Z0-9]/g, "");

      const linkedLead = await centralDb.admissionLead.findFirst({
        where: {
          schoolId: school.id,
          OR: [
            ...(leadId ? [{ id: leadId }] : []),
            { id: app.id },
            ...(cleanNo ? [
              { id: { contains: cleanNo, mode: "insensitive" as const } },
              { uploadToken: { contains: cleanNo, mode: "insensitive" as const } },
            ] : []),
            ...(app.email ? [{ studentEmail: app.email }, { parentEmail: app.email }] : []),
            ...(app.phoneNumber ? [{ parentPhone: app.phoneNumber }, { parentContact: app.phoneNumber }] : []),
          ],
        },
      });

      const linkedReg = await centralDb.admissionRegister.findFirst({
        where: {
          tenantId: school.id,
          OR: [
            { applicationNo: app.applicationNumber },
            ...(cleanNo ? [{ applicationNo: { contains: cleanNo, mode: "insensitive" as const } }] : []),
            ...(app.email ? [{ email: app.email }] : []),
          ],
        },
      });

      // Gather all documents from AdmissionsDocument table
      const dbDocs = await centralDb.admissionsDocument.findMany({
        where: { applicationId: app.id },
      });

      for (const d of dbDocs) {
        if (!app.documents.some((existing: any) => existing.id === d.id || existing.documentType === d.documentType)) {
          app.documents.push({
            id: d.id,
            documentType: d.documentType,
            storageKey: d.storageKey,
            verificationStatus: d.verificationStatus,
            rejectionReason: d.rejectionReason,
          });
        }
      }

      const metaDocs: Record<string, any> = mergeDocMapsNonDestructively(
        (app.metadata as any)?.documents || {},
        (app.tierSpecificData as any)?.documents || {}
      );

      // Pull from AdmissionsDocument rows into metaDocs
      const revDocMapDefs: Record<string, string> = {
        PASSPORT_PHOTOGRAPH: "passportPhoto",
        PASSPORT_PHOTO: "passportPhoto",
        PASSPORT: "passportPhoto",
        BIRTH_CERTIFICATE: "birthCertificate",
        BIRTH_CERT: "birthCertificate",
        ACADEMIC_TRANSCRIPT: "academicResults",
        ACADEMIC_RESULTS: "academicResults",
        O_LEVEL_RESULT: "academicResults",
        LAST_SCHOOL_RESULT: "academicResults",
        JAMB_RESULT_SLIP: "academicResults",
        MEDICAL_REPORT: "medicalRecords",
        MEDICAL_RECORDS: "medicalRecords",
        IMMUNIZATION_RECORD: "medicalRecords",
        NIN_SLIP: "ninSlip",
        NIN: "ninSlip",
        APPLICATION_FEE_RECEIPT: "applicationFeeReceipt",
        FEE_RECEIPT: "applicationFeeReceipt",
      };

      const ensureDocEntryUrl = (key: string, url: string, extra?: Record<string, any>) => {
        if (!key || !url) return;
        const current = metaDocs[key];
        const currentUrl = extractDocUrlStr(current);
        if (!current) {
          metaDocs[key] = {
            url,
            fileUrl: url,
            fileName: `${key}.pdf`,
            verified: false,
            ...(extra || {}),
          };
        } else if (!currentUrl && typeof current === "object") {
          metaDocs[key] = {
            ...current,
            url,
            fileUrl: url,
            ...(extra || {}),
          };
        }
      };

      for (const d of app.documents) {
        const fieldKey = revDocMapDefs[d.documentType?.toUpperCase()] || d.documentType;
        if (d.storageKey) {
          ensureDocEntryUrl(fieldKey, d.storageKey, {
            verified: d.verificationStatus === "MANUALLY_VERIFIED" || d.verificationStatus === "AUTO_VERIFIED",
            status: d.verificationStatus,
          });
        }
      }

      // Supplement from linkedLead
      if (linkedLead && linkedLead.documents && typeof linkedLead.documents === "object") {
        const leadDocs = linkedLead.documents as Record<string, any>;
        for (const [k, v] of Object.entries(leadDocs)) {
          const vUrl = extractDocUrlStr(v);
          if (vUrl) {
            ensureDocEntryUrl(k, vUrl, typeof v === "object" ? v : undefined);
          } else if (v && typeof v === "object" && !metaDocs[k]) {
            metaDocs[k] = v;
          }
        }
      }

      // Supplement from linkedReg
      if (linkedReg && linkedReg.credentialsJson) {
        const rawReg = linkedReg.credentialsJson;
        if (Array.isArray(rawReg)) {
          for (const item of (rawReg as any[])) {
            if (item && ((item as any).key || (item as any).type)) {
              const k = (item as any).key || (item as any).type;
              const iUrl = extractDocUrlStr(item);
              if (iUrl) ensureDocEntryUrl(k, iUrl, item);
            }
          }
        } else if (typeof rawReg === "object") {
          if (Array.isArray((rawReg as any).documents)) {
            for (const item of (rawReg as any).documents) {
              if (item && (item.key || item.type)) {
                const k = item.key || item.type;
                const iUrl = extractDocUrlStr(item);
                if (iUrl) ensureDocEntryUrl(k, iUrl, item);
              }
            }
          } else {
            for (const [k, v] of Object.entries(rawReg)) {
              const vUrl = extractDocUrlStr(v);
              if (vUrl) {
                ensureDocEntryUrl(k, vUrl, typeof v === "object" ? (v as any) : undefined);
              }
            }
          }
        }
      }

      // Reverse supplement to app.documents
      const docMapDefs: Record<string, string> = {
        passportPhoto: "PASSPORT_PHOTOGRAPH",
        academicResults: "ACADEMIC_TRANSCRIPT",
        birthCertificate: "BIRTH_CERTIFICATE",
        medicalRecords: "MEDICAL_REPORT",
        ninSlip: "NIN_SLIP",
        applicationFeeReceipt: "APPLICATION_FEE_RECEIPT",
      };

      for (const [fKey, dType] of Object.entries(docMapDefs)) {
        const item = metaDocs[fKey];
        const url =
          item?.url ||
          item?.fileUrl ||
          (typeof item === "string" ? item : null) ||
          (fKey === "applicationFeeReceipt" ? (metaDocs.applicationFeeReceiptUrl || linkedReg?.applicationFeeReceiptUrl || (linkedLead as any)?.applicationFeeReceiptUrl) : null);

        if (url && !app.documents.some((d: any) => d.documentType === dType || d.documentType?.toUpperCase().includes(fKey.toUpperCase()))) {
          app.documents.push({
            id: `lead-doc-${fKey}-${app.id}`,
            documentType: dType,
            storageKey: url,
            verificationStatus: item?.verified ? "MANUALLY_VERIFIED" : "PENDING",
            rejectionReason: null,
          });
        }
      }

      const feeReceiptUrl =
        metaDocs.applicationFeeReceiptUrl ||
        metaDocs.formFeeReceiptUrl ||
        metaDocs.applicationFeeReceipt?.url ||
        linkedReg?.applicationFeeReceiptUrl ||
        (linkedLead as any)?.applicationFeeReceiptUrl;

      const isAlreadyPaid =
        Boolean(linkedReg?.formFeePaid) ||
        Boolean((linkedLead?.documents as any)?.formFeePaid) ||
        Boolean((linkedLead?.documents as any)?.feePaid) ||
        (linkedLead?.documents as any)?.formFeeStatus === "PAID" ||
        (linkedLead?.documents as any)?.formFeeStatus === "SETTLED" ||
        (linkedLead?.documents as any)?.paymentState === "SETTLED" ||
        metaDocs.applicationFeeReceipt?.status === "VERIFIED" ||
        metaDocs.applicationFeeReceipt?.verified === true ||
        metaDocs.paymentReceipt?.status === "VERIFIED" ||
        metaDocs.formFeePaid === true ||
        metaDocs.feePaid === true ||
        metaDocs.formFeeStatus === "PAID" ||
        metaDocs.formFeeStatus === "SETTLED" ||
        metaDocs.paymentState === "SETTLED";

      if (isAlreadyPaid) {
        metaDocs.formFeePaid = true;
        metaDocs.feePaid = true;
        metaDocs.formFeeStatus = "PAID";
        metaDocs.paymentState = "SETTLED";
      }

      if (feeReceiptUrl && (!app.feeTransactions || app.feeTransactions.length === 0)) {
        const persistedTx = await centralDb.admissionsFeeTransaction
          .create({
            data: {
              tenantId: app.tenantId || school.id,
              applicationId: app.id,
              paymentMethod: "MANUAL_BANK_TRANSFER",
              amount: 5000,
              currency: "NGN",
              paymentReference: `FEE-${app.applicationNumber}`,
              paymentStatus: isAlreadyPaid ? "SETTLED" : "PENDING",
              proofOfPaymentUrl: feeReceiptUrl,
            },
          })
          .catch(() => null);

        app.feeTransactions = [
          persistedTx || {
            id: `tx-lead-${app.id}`,
            paymentMethod: "MANUAL_BANK_TRANSFER",
            amount: 5000,
            currency: "NGN",
            paymentReference: `FEE-${app.applicationNumber}`,
            paymentStatus: isAlreadyPaid ? "SETTLED" : "PENDING",
            proofOfPaymentUrl: feeReceiptUrl,
            createdAt: new Date(),
          },
        ];
      } else if (isAlreadyPaid && app.feeTransactions && app.feeTransactions.length > 0) {
        app.feeTransactions = app.feeTransactions.map((tx: any) => ({
          ...tx,
          paymentStatus: "SETTLED",
        }));
      }

      app.metadata = { ...((app.metadata as any) || {}), documents: metaDocs };
      app.tierSpecificData = { ...((app.tierSpecificData as any) || {}), documents: metaDocs };
    }
  } catch (hydrateErr) {
    console.warn("[ADMISSIONS] Document hydration notice:", hydrateErr);
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
    documents: (() => {
      const docsList = [...(app.documents || []).map((d: any) => ({
        id: d.id,
        documentType: d.documentType,
        storageKey: d.storageKey,
        verificationStatus: d.verificationStatus,
        rejectionReason: d.rejectionReason,
      }))];

      const metaDocs = (app.metadata as any)?.documents || (app.tierSpecificData as any)?.documents;
      if (metaDocs && typeof metaDocs === "object" && !Array.isArray(metaDocs)) {
        const docMappings: Record<string, string> = {
          passportPhoto: "PASSPORT_PHOTOGRAPH",
          academicResults: "ACADEMIC_TRANSCRIPT",
          birthCertificate: "BIRTH_CERTIFICATE",
          medicalRecords: "MEDICAL_REPORT",
          ninSlip: "NIN_SLIP",
          applicationFeeReceipt: "APPLICATION_FEE_RECEIPT",
        };
        for (const [key, dType] of Object.entries(docMappings)) {
          const item = metaDocs[key];
          const url =
            item?.url ||
            item?.fileUrl ||
            (typeof item === "string" ? item : null) ||
            (key === "applicationFeeReceipt" ? metaDocs.applicationFeeReceiptUrl || metaDocs.formFeeReceiptUrl : null);
          if (
            url &&
            !docsList.some((d: any) =>
              d.documentType.toUpperCase().replace(/[\s-_]/g, "").includes(key.toUpperCase().replace(/[\s-_]/g, "")) ||
              d.documentType === dType
            )
          ) {
            docsList.push({
              id: `meta-${key}-${app.id}`,
              documentType: dType,
              storageKey: url,
              verificationStatus: "PENDING",
              rejectionReason: null,
            });
          }
        }
      }

      return docsList;
    })(),
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
    rawCycles = await centralDb.admissionCycle.findMany({
      where: {
        schoolId: school.id,
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => []);
    if (!rawCycles || rawCycles.length === 0) {
      rawCycles = await centralDb.admissionCycle.findMany({
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
    rawTransactions = await centralDb.admissionsFeeTransaction.findMany({
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

  const academicTiers = (school.academicTiers || []).map((t: any) => ({
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
