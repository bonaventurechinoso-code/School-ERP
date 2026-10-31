import { basePrisma } from "@/lib/tenant-prisma";
import { AdmissionTierType } from "@prisma/client";

export interface StageConstraints {
  require_payment?: boolean;
  require_birth_cert?: boolean;
  require_passport?: boolean;
  require_academic_results?: boolean;
  require_jamb?: boolean;
  require_exam_score?: boolean;
  min_exam_score?: number;
  min_age?: number;
  [key: string]: any;
}

export interface AuthValidationResult {
  authorized: boolean;
  status: 200 | 403;
  reason?: string;
  isTenantAdmin?: boolean;
  isAdmissionsOfficer?: boolean;
  isGlobalSuperAdmin?: boolean;
}

/**
 * Validates whether the caller has Tenant Admin authority for the target tenant.
 * Crucial Tenancy Tenet: Tenant Admins are NOT platform Super Admins.
 * Tenant Admins are strictly scoped to their own tenant_id.
 */
/**
 * Helper to safely verify whether session's tenant matches the target tenant.
 * Accounts for UUID vs. Subdomain slug representations.
 */
export async function isSessionMatchingTenant(
  session: any,
  targetTenantId: string
): Promise<boolean> {
  if (!targetTenantId) return false;

  const sessionTenantId = (
    session?.tenantId ||
    session?.user?.tenantId ||
    session?.tenant_id ||
    session?.user?.tenant_id ||
    session?.schoolId ||
    session?.user?.schoolId ||
    ""
  )
    .toString()
    .trim();

  const sessionDomain = (
    session?.schoolDomain ||
    session?.user?.schoolDomain ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  const target = targetTenantId.toString().trim();
  const targetLower = target.toLowerCase();

  // Fast path 1: Direct UUID / ID match
  if (sessionTenantId && sessionTenantId.toLowerCase() === targetLower) {
    return true;
  }

  // Fast path 2: Direct subdomain match
  if (sessionDomain && sessionDomain === targetLower) {
    return true;
  }

  // Fallback path: Query database to resolve target and session tenant identifiers
  try {
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [{ id: target }, { subdomain: target }, { slug: target }],
      },
      select: { id: true, subdomain: true, slug: true },
    });

    if (school) {
      const schoolIdLower = school.id.toLowerCase();
      const schoolSubdomainLower = (school.subdomain || "").toLowerCase();
      const schoolSlugLower = (school.slug || "").toLowerCase();

      if (
        (sessionTenantId && sessionTenantId.toLowerCase() === schoolIdLower) ||
        (sessionDomain &&
          (sessionDomain === schoolSubdomainLower ||
            sessionDomain === schoolSlugLower))
      ) {
        return true;
      }
    }
  } catch (err) {
    console.warn("[isSessionMatchingTenant] Database lookup warning:", err);
  }

  return false;
}

/**
 * Validates whether the caller has Tenant Admin authority for the target tenant.
 * Crucial Tenancy Tenet: Tenant Admins are NOT platform Super Admins.
 * Tenant Admins are strictly scoped to their own tenant_id.
 */
export async function verifyTenantAdminRole(
  session: any,
  targetTenantId: string
): Promise<AuthValidationResult> {
  if (!session) {
    return {
      authorized: false,
      status: 403,
      reason: "403 Forbidden: Valid authenticated session is required.",
    };
  }

  const role = (
    session?.role ||
    session?.user?.role ||
    (session as any)?.userRole ||
    ""
  ).toUpperCase();
  const staffRole = (
    session?.staffRole ||
    session?.user?.staffRole ||
    ""
  ).toUpperCase();

  const isGlobalSuperAdmin =
    role === "SUPER_ADMIN" ||
    role === "SUPERADMIN" ||
    session?.isSuperAdmin === true ||
    session?.email === "bonaventure.chinoso@gmail.com" ||
    session?.email === "admin@schoolerp.com";

  const isTenantAdmin =
    role === "ADMIN" ||
    role === "SCHOOL_ADMIN" ||
    role === "TENANT_ADMIN" ||
    staffRole.includes("ADMIN") ||
    staffRole.includes("PRINCIPAL") ||
    staffRole.includes("DIRECTOR") ||
    staffRole.includes("HEADMASTER") ||
    staffRole.includes("HEADMISTRESS") ||
    staffRole.includes("PROPRIETOR");

  if (!isGlobalSuperAdmin && !isTenantAdmin) {
    return {
      authorized: false,
      status: 403,
      reason:
        "403 Forbidden: Pipeline configuration changes (creating/editing tracks and stages) are strictly restricted to the Tenant Admin.",
    };
  }

  // Cross-tenant protection: Ensure tenant admin belongs to this tenant
  if (!isGlobalSuperAdmin) {
    const isMatching = await isSessionMatchingTenant(session, targetTenantId);
    if (!isMatching) {
      return {
        authorized: false,
        status: 403,
        reason:
          "403 Forbidden: Tenant Admins cannot access or configure cross-tenant pipelines.",
      };
    }
  }

  return {
    authorized: true,
    status: 200,
    isTenantAdmin: true,
    isGlobalSuperAdmin,
  };
}

/**
 * Validates whether caller has either Tenant Admin or Admissions Officer authority for candidate transitions.
 */
export async function verifyAdmissionsMutatorRole(
  session: any,
  targetTenantId: string
): Promise<AuthValidationResult> {
  if (!session) {
    return {
      authorized: false,
      status: 403,
      reason: "403 Forbidden: Valid authenticated session is required.",
    };
  }

  const role = (
    session?.role ||
    session?.user?.role ||
    (session as any)?.userRole ||
    ""
  ).toUpperCase();
  const staffRole = (
    session?.staffRole ||
    session?.user?.staffRole ||
    ""
  ).toUpperCase();

  const isGlobalSuperAdmin =
    role === "SUPER_ADMIN" ||
    role === "SUPERADMIN" ||
    session?.isSuperAdmin === true ||
    session?.email === "bonaventure.chinoso@gmail.com" ||
    session?.email === "admin@schoolerp.com";

  const isTenantAdmin =
    role === "ADMIN" ||
    role === "SCHOOL_ADMIN" ||
    role === "TENANT_ADMIN" ||
    staffRole.includes("ADMIN") ||
    staffRole.includes("PRINCIPAL") ||
    staffRole.includes("DIRECTOR") ||
    staffRole.includes("HEADMASTER") ||
    staffRole.includes("HEADMISTRESS") ||
    staffRole.includes("PROPRIETOR");

  const isAdmissionsOfficer =
    staffRole.includes("ADMISSION") ||
    staffRole.includes("ENROLLMENT") ||
    staffRole.includes("REGISTRAR") ||
    role.includes("ADMISSION") ||
    role.includes("REGISTRAR");

  if (!isGlobalSuperAdmin && !isTenantAdmin && !isAdmissionsOfficer) {
    return {
      authorized: false,
      status: 403,
      reason:
        "403 Forbidden: Moving candidates along the pipeline requires either Tenant Admin or Admissions Officer privileges.",
    };
  }

  // Cross-tenant protection
  if (!isGlobalSuperAdmin) {
    const isMatching = await isSessionMatchingTenant(session, targetTenantId);
    if (!isMatching) {
      return {
        authorized: false,
        status: 403,
        reason:
          "403 Forbidden: You do not have permission to transition applicants belonging to another tenant.",
      };
    }
  }

  return {
    authorized: true,
    status: 200,
    isTenantAdmin,
    isAdmissionsOfficer,
    isGlobalSuperAdmin,
  };
}

/**
 * Stage Constraint Verification
 * Evaluates candidate profile attributes against target stage constraint rules.
 */
export function evaluateStageConstraints(
  candidate: any,
  constraints: StageConstraints | null | undefined
): { satisfied: boolean; missingPrerequisites: string[] } {
  const missing: string[] = [];
  if (!constraints || typeof constraints !== "object") {
    return { satisfied: true, missingPrerequisites: [] };
  }

  const docs = (candidate?.documents as Record<string, any>) || {};
  const creds = Array.isArray(candidate?.credentialsJson)
    ? candidate.credentialsJson
    : [];

  // 1. require_payment constraint check
  if (constraints.require_payment) {
    const isFeePaid =
      Boolean(docs.formFeePaid) ||
      Boolean(docs.feePaid) ||
      candidate?.feeStatus === "PAID" ||
      creds.some(
        (c: any) =>
          (c.type === "PAYMENT_RECEIPT" ||
            c.name?.toLowerCase().includes("payment") ||
            c.name?.toLowerCase().includes("fee")) &&
          c.verified
      );

    if (!isFeePaid) {
      missing.push(
        "Application/Form fee payment must be settled and verified as PAID before advancing."
      );
    }
  }

  // 2. require_birth_cert constraint check
  if (constraints.require_birth_cert) {
    const hasBirthCert =
      Boolean(candidate?.birthCertificateUrl) ||
      Boolean(docs.birthCertificate) ||
      Boolean(docs.birthCert) ||
      creds.some(
        (c: any) =>
          (c.type === "BIRTH_CERT" ||
            c.docType === "BIRTH_CERT" ||
            c.name?.toLowerCase().includes("birth")) &&
          !c.rejected
      );

    if (!hasBirthCert) {
      missing.push("Birth Certificate document must be uploaded and available.");
    }
  }

  // 3. require_passport constraint check
  if (constraints.require_passport) {
    const hasPassport =
      Boolean(candidate?.passportPhotoUrl) ||
      Boolean(docs.passportPhoto) ||
      Boolean(docs.passport) ||
      creds.some(
        (c: any) =>
          (c.type === "PASSPORT_PHOTO" ||
            c.docType === "PASSPORT_PHOTO" ||
            c.name?.toLowerCase().includes("passport")) &&
          !c.rejected
      );

    if (!hasPassport) {
      missing.push("Recent Passport photograph must be attached to candidate dossier.");
    }
  }

  // 4. require_academic_results constraint check
  if (constraints.require_academic_results) {
    const hasResults =
      Boolean(candidate?.academicResultsUrl) ||
      Boolean(docs.academicResults) ||
      Boolean(candidate?.olevelResults) ||
      Boolean(candidate?.academicHistory) ||
      creds.some(
        (c: any) =>
          (c.type === "WAEC_RESULT" ||
            c.type === "NECO_RESULT" ||
            c.type === "TRANSCRIPT" ||
            c.name?.toLowerCase().includes("result") ||
            c.name?.toLowerCase().includes("transcript")) &&
          !c.rejected
      );

    if (!hasResults) {
      missing.push("Academic transcripts / Examination results are required before entering this stage.");
    }
  }

  // 5. require_jamb constraint check
  if (constraints.require_jamb) {
    const hasJamb =
      Boolean(candidate?.jambDetails) ||
      Boolean(docs.jambSlip) ||
      Boolean(docs.jambScore) ||
      creds.some(
        (c: any) =>
          (c.type === "JAMB_SLIP" || c.name?.toLowerCase().includes("jamb")) &&
          !c.rejected
      );

    if (!hasJamb) {
      missing.push("JAMB Registration Details or UTME Result slip must be provided.");
    }
  }

  // 6. min_age constraint check
  if (typeof constraints.min_age === "number" && constraints.min_age > 0) {
    const personal = (candidate?.personalData as any) || {};
    const dobStr = personal.dateOfBirth || docs.dateOfBirth;
    if (dobStr) {
      const birth = new Date(dobStr);
      if (!isNaN(birth.getTime())) {
        const ageDifMs = Date.now() - birth.getTime();
        const ageDate = new Date(ageDifMs);
        const age = Math.abs(ageDate.getUTCFullYear() - 1970);
        if (age < constraints.min_age) {
          missing.push(
            `Applicant age (${age} years) is below stage minimum age requirement (${constraints.min_age} years).`
          );
        }
      }
    }
  }

  // 7. require_exam_score constraint check
  if (constraints.require_exam_score) {
    const minPassingScore =
      typeof constraints.min_exam_score === "number" ? constraints.min_exam_score : 50;
    const credsJson = (candidate?.credentialsJson as any) || {};
    const rawScore =
      docs.entranceScore ??
      docs.examScore ??
      docs.examAggregate ??
      credsJson.entranceScore ??
      credsJson.examScore ??
      candidate?.entranceScore ??
      candidate?.examScore;

    const numScore = typeof rawScore === "number" ? rawScore : parseFloat(rawScore);
    const hasValidScore = !isNaN(numScore) && numScore >= minPassingScore;

    if (!hasValidScore) {
      if (isNaN(numScore)) {
        missing.push(
          `Candidate requires an entrance examination score before advancing beyond this stage.`
        );
      } else {
        missing.push(
          `Entrance examination score (${numScore}) does not meet the minimum passing score (${minPassingScore}).`
        );
      }
    }
  }

  return {
    satisfied: missing.length === 0,
    missingPrerequisites: missing,
  };
}

/**
 * Initializes standard enterprise multi-tier tracks and customizable stages
 * filtered strictly to the tenant's operating tier metadata profile.
 */
export async function ensureTenantAdmissionTracks(tenantId: string) {
  // Fetch tenant profile and configured operating academic tiers
  const school = await basePrisma.school.findUnique({
    where: { id: tenantId },
    include: {
      academicTiers: {
        orderBy: { level: "asc" },
      },
    },
  });

  const operatingTiers = new Set<AdmissionTierType>();
  if (school?.academicTiers && school.academicTiers.length > 0) {
    for (const t of school.academicTiers) {
      const lower = t.name.toLowerCase();
      if (lower.includes("nursery") || lower.includes("daycare") || lower.includes("creche") || lower.includes("early")) {
        operatingTiers.add(AdmissionTierType.NURSERY);
      }
      if (lower.includes("primary") || lower.includes("basic") || lower.includes("elementary")) {
        operatingTiers.add(AdmissionTierType.PRIMARY);
      }
      if (lower.includes("secondary") || lower.includes("high") || lower.includes("jss") || lower.includes("sss") || (lower.includes("college") && !lower.includes("education"))) {
        operatingTiers.add(AdmissionTierType.SECONDARY);
      }
      if (lower.includes("university") || lower.includes("polytechnic") || lower.includes("tertiary") || lower.includes("undergraduate") || lower.includes("education")) {
        operatingTiers.add(AdmissionTierType.TERTIARY);
      }
    }
  }

  // Fallback if none matched
  if (operatingTiers.size === 0) {
    operatingTiers.add(AdmissionTierType.PRIMARY);
  }

  const existingTracks = await basePrisma.admissionTrack.findMany({
    where: { tenantId, isActive: true },
    include: {
      stages: {
        orderBy: { sequenceOrder: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Filter existing tracks strictly to those matching the tenant's operating tier metadata
  const matchingExisting = existingTracks.filter((t) => operatingTiers.has(t.tierType));
  if (matchingExisting.length > 0) {
    return matchingExisting;
  }

  // Seed default tracks for Nursery, Primary, Secondary, and Tertiary
  const tracksToCreate: Array<{
    name: string;
    tierType: AdmissionTierType;
    description: string;
    stages: Array<{
      name: string;
      sequenceOrder: number;
      constraints: StageConstraints;
      color: string;
    }>;
  }> = [
    {
      name: "Secondary School Track",
      tierType: AdmissionTierType.SECONDARY,
      description: "Standard pipeline for Junior and Senior Secondary School admissions.",
      stages: [
        {
          name: "Inquiry & Prospect Log",
          sequenceOrder: 0,
          constraints: {},
          color: "#94a3b8",
        },
        {
          name: "Dossier & Transcript Intake",
          sequenceOrder: 1,
          constraints: { require_birth_cert: true, require_academic_results: true },
          color: "#f59e0b",
        },
        {
          name: "CBT Entrance Exam",
          sequenceOrder: 2,
          constraints: { require_payment: true },
          color: "#8b5cf6",
        },
        {
          name: "Provisional Offer",
          sequenceOrder: 3,
          constraints: {},
          color: "#3b82f6",
        },
        {
          name: "Matriculated",
          sequenceOrder: 4,
          constraints: {},
          color: "#10b981",
        },
      ],
    },
    {
      name: "Primary School Track",
      tierType: AdmissionTierType.PRIMARY,
      description: "Primary school enrollment pipeline with early literacy screening.",
      stages: [
        {
          name: "Inquiry & Prospect Log",
          sequenceOrder: 0,
          constraints: {},
          color: "#94a3b8",
        },
        {
          name: "Birth Cert & Records Intake",
          sequenceOrder: 1,
          constraints: { require_birth_cert: true, require_passport: true },
          color: "#f59e0b",
        },
        {
          name: "Readiness & Placement Screening",
          sequenceOrder: 2,
          constraints: { require_payment: true },
          color: "#8b5cf6",
        },
        {
          name: "Provisional Offer",
          sequenceOrder: 3,
          constraints: {},
          color: "#3b82f6",
        },
        {
          name: "Matriculated",
          sequenceOrder: 4,
          constraints: {},
          color: "#10b981",
        },
      ],
    },
    {
      name: "Nursery & Early Years Track",
      tierType: AdmissionTierType.NURSERY,
      description: "Early childhood and daycare admissions workflow.",
      stages: [
        {
          name: "Parent Walk-In Inquiry",
          sequenceOrder: 0,
          constraints: {},
          color: "#94a3b8",
        },
        {
          name: "Immunization & Birth Records",
          sequenceOrder: 1,
          constraints: { require_birth_cert: true },
          color: "#f59e0b",
        },
        {
          name: "Parent Interactive Session",
          sequenceOrder: 2,
          constraints: { require_payment: true },
          color: "#8b5cf6",
        },
        {
          name: "Provisional Offer",
          sequenceOrder: 3,
          constraints: {},
          color: "#3b82f6",
        },
        {
          name: "Matriculated",
          sequenceOrder: 4,
          constraints: {},
          color: "#10b981",
        },
      ],
    },
    {
      name: "Tertiary & Professional Track",
      tierType: AdmissionTierType.TERTIARY,
      description: "Undergraduate, diploma, and polytechnic admissions workflow.",
      stages: [
        {
          name: "UTME / Direct Entry Intake",
          sequenceOrder: 0,
          constraints: {},
          color: "#94a3b8",
        },
        {
          name: "O'Level & JAMB Verification",
          sequenceOrder: 1,
          constraints: { require_jamb: true, require_academic_results: true },
          color: "#f59e0b",
        },
        {
          name: "Departmental Assessment",
          sequenceOrder: 2,
          constraints: { require_payment: true },
          color: "#8b5cf6",
        },
        {
          name: "Provisional Offer",
          sequenceOrder: 3,
          constraints: {},
          color: "#3b82f6",
        },
        {
          name: "Matriculated",
          sequenceOrder: 4,
          constraints: {},
          color: "#10b981",
        },
      ],
    },
  ];

  const filteredTracksToCreate = tracksToCreate.filter((t) => operatingTiers.has(t.tierType));
  const toCreate = filteredTracksToCreate.length > 0 ? filteredTracksToCreate : tracksToCreate;

  for (const t of toCreate) {
    const track = await basePrisma.admissionTrack.create({
      data: {
        tenantId,
        name: t.name,
        tierType: t.tierType,
        description: t.description,
        isActive: true,
      },
    });

    for (const s of t.stages) {
      await basePrisma.admissionStage.create({
        data: {
          trackId: track.id,
          name: s.name,
          sequenceOrder: s.sequenceOrder,
          constraints: s.constraints as any,
          color: s.color,
        },
      });
    }
  }

  const allTracks = await basePrisma.admissionTrack.findMany({
    where: { tenantId, isActive: true },
    include: {
      stages: {
        orderBy: { sequenceOrder: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const finalTracks = allTracks.filter((t) => operatingTiers.has(t.tierType));
  return finalTracks.length > 0 ? finalTracks : allTracks;
}

