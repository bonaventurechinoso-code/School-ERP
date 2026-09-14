import { TierCategory, TierPresentationConfig } from "./types";
import { formatTierBadgeCode, sanitizeTierSlug, isHigherEdTier } from "@/lib/tenant-tier-utils";

/**
 * Classifies any tier string into one of three macro categories:
 * - EARLY_CHILDHOOD: Daycare, Nursery, Creche, Primary, Elementary
 * - SECONDARY: Junior/Senior Secondary, High School, JSS, SSS, K12
 * - HIGHER_ED: University, Polytechnic, College of Education, Monotechnic
 */
/**
 * Classifies any tier string into one of three macro categories:
 * - EARLY_CHILDHOOD: Daycare, Nursery, Creche, Kindergarten, Primary, Elementary
 * - SECONDARY: Junior/Senior Secondary, High School, JSS, SSS, K12
 * - HIGHER_ED: University, Polytechnic, College of Education, Monotechnic
 */
export function classifyTierCategory(tierName?: string): TierCategory {
  if (!tierName) return "EARLY_CHILDHOOD";
  const upper = tierName.toUpperCase().trim();

  // Explicit Early Childhood / Nursery / Kindergarten overrides
  if (
    upper.includes("KINDERGARTEN") ||
    upper.includes("NURSERY") ||
    upper.includes("DAYCARE") ||
    upper.includes("CRÈCHE") ||
    upper.includes("CRECHE") ||
    upper.includes("PLAYGROUP") ||
    upper.includes("EARLY") ||
    upper.includes("BASIC") ||
    upper.includes("PRIMARY") ||
    upper.includes("ELEMENTARY")
  ) {
    return "EARLY_CHILDHOOD";
  }

  if (
    upper.includes("UNIVERSITY") ||
    upper.includes("POLYTECHNIC") ||
    upper.includes("COLLEGE") ||
    upper.includes("TERTIARY") ||
    upper.includes("HIGHER ED") ||
    upper.includes("HIGHER INSTITUTION") ||
    upper.includes("MONOTECHNIC")
  ) {
    return "HIGHER_ED";
  }

  if (
    upper.includes("SECONDARY") ||
    upper.includes("HIGH SCHOOL") ||
    upper.includes("JSS") ||
    upper.includes("SSS")
  ) {
    return "SECONDARY";
  }

  return "EARLY_CHILDHOOD";
}

/**
 * Resolves the accurate badge code based on student's current class and academic tier.
 * Prevents data contamination where early childhood students receive SECONDARY tags.
 */
export function formatClassAlignedBadgeCode(className?: string, tierName?: string): string {
  const classUpper = (className || "").toUpperCase().trim();
  if (
    classUpper.includes("KINDERGARTEN") ||
    classUpper.includes("NURSERY") ||
    classUpper.includes("DAYCARE") ||
    classUpper.includes("CRÈCHE") ||
    classUpper.includes("CRECHE") ||
    classUpper.includes("PLAYGROUP") ||
    classUpper.includes("EARLY")
  ) {
    return "NURSERY";
  }
  if (classUpper.includes("PRIMARY") || classUpper.includes("BASIC") || classUpper.includes("ELEMENTARY")) {
    return "PRIMARY";
  }
  if (
    classUpper.includes("SECONDARY") ||
    classUpper.includes("HIGH SCHOOL") ||
    classUpper.includes("JSS") ||
    classUpper.includes("SSS") ||
    classUpper.includes("GRADE 7") ||
    classUpper.includes("GRADE 8") ||
    classUpper.includes("GRADE 9") ||
    classUpper.includes("GRADE 10") ||
    classUpper.includes("GRADE 11") ||
    classUpper.includes("GRADE 12")
  ) {
    return "SECONDARY";
  }
  if (
    classUpper.includes("LEVEL") ||
    classUpper.includes("100L") ||
    classUpper.includes("200L") ||
    classUpper.includes("300L") ||
    classUpper.includes("400L") ||
    classUpper.includes("500L") ||
    classUpper.includes("ND") ||
    classUpper.includes("HND") ||
    classUpper.includes("DEGREE")
  ) {
    return "UNIVERSITY";
  }

  return formatTierBadgeCode(tierName);
}

/**
 * Dynamically resolves the accurate Academic Tier and presentation configuration
 * directly from the student's real class level retrieved from their isolated database.
 */
export function resolveStudentAcademicTier(params: {
  currentClass?: string | null;
  studentTierName?: string | null;
  schoolTiers?: string[];
  fallbackTier?: string;
}): {
  tierName: string;
  config: TierPresentationConfig;
  badgeCode: string;
  category: TierCategory;
} {
  const { currentClass, studentTierName, schoolTiers = [], fallbackTier } = params;
  const classUpper = (currentClass || "").toUpperCase().trim();
  const available = schoolTiers.map(t => t.trim());

  let resolvedTierName = "";

  // 1. Check currentClass semantic cues
  if (
    classUpper.includes("KINDERGARTEN") ||
    classUpper.includes("NURSERY") ||
    classUpper.includes("DAYCARE") ||
    classUpper.includes("CRÈCHE") ||
    classUpper.includes("CRECHE") ||
    classUpper.includes("PLAYGROUP")
  ) {
    // Find matching early childhood tier in tenant tiers
    const matched = available.find(t => {
      const u = t.toUpperCase();
      return u.includes("NURSERY") || u.includes("DAYCARE") || u.includes("KINDERGARTEN") || u.includes("EARLY");
    });
    resolvedTierName = matched || "Daycare / Nursery";
  } else if (classUpper.includes("PRIMARY") || classUpper.includes("BASIC") || classUpper.includes("ELEMENTARY")) {
    const matched = available.find(t => {
      const u = t.toUpperCase();
      return (u.includes("PRIMARY") || u.includes("BASIC") || u.includes("ELEMENTARY")) && !u.includes("SECONDARY");
    });
    resolvedTierName = matched || "Primary School";
  } else if (
    classUpper.includes("SECONDARY") ||
    classUpper.includes("HIGH SCHOOL") ||
    classUpper.includes("JSS") ||
    classUpper.includes("SSS")
  ) {
    const matched = available.find(t => {
      const u = t.toUpperCase();
      return u.includes("SECONDARY") || u.includes("HIGH SCHOOL");
    });
    resolvedTierName = matched || "Secondary School";
  } else if (
    classUpper.includes("LEVEL") ||
    classUpper.includes("100L") ||
    classUpper.includes("200L") ||
    classUpper.includes("300L") ||
    classUpper.includes("400L") ||
    classUpper.includes("500L") ||
    classUpper.includes("DEGREE")
  ) {
    const matched = available.find(t => {
      const u = t.toUpperCase();
      return u.includes("UNIVERSITY") || u.includes("COLLEGE") || u.includes("POLYTECHNIC") || u.includes("HIGHER");
    });
    resolvedTierName = matched || "University";
  } else if (studentTierName) {
    // 2. Direct student tier relation
    resolvedTierName = studentTierName;
  } else if (fallbackTier) {
    // 3. Fallback tier
    resolvedTierName = fallbackTier;
  } else if (available.length > 0) {
    resolvedTierName = available[0];
  } else {
    resolvedTierName = "Daycare / Nursery";
  }

  const config = getTierPresentationConfig(resolvedTierName);
  const badgeCode = formatClassAlignedBadgeCode(currentClass || undefined, resolvedTierName);

  // Synchronize badgeCode into config if necessary
  config.badgeCode = badgeCode;

  return {
    tierName: resolvedTierName,
    config,
    badgeCode,
    category: config.category
  };
}

/**
 * Sanitizes student admission numbers to prevent tier prefix contamination.
 * e.g. Replaces erroneously assigned SECONDARY tags with NURSERY when student is in Kindergarten.
 */
export function sanitizeStudentAdmissionId(rawId: string, className?: string, badgeCode?: string): string {
  if (!rawId) return rawId;
  const targetBadge = badgeCode || formatClassAlignedBadgeCode(className);
  
  // If student is in Early Childhood but ID has SECONDARY prefix, fix it
  if (targetBadge === "NURSERY" && rawId.includes("/SECONDARY-")) {
    return rawId.replace("/SECONDARY-", "/NURSERY-");
  }
  if (targetBadge === "PRIMARY" && rawId.includes("/SECONDARY-")) {
    return rawId.replace("/SECONDARY-", "/PRIMARY-");
  }
  if (targetBadge === "SECONDARY" && rawId.includes("/NURSERY-")) {
    return rawId.replace("/NURSERY-", "/SECONDARY-");
  }
  
  return rawId;
}

/**
 * Generates the presentation configuration and customized vocabulary
 * dictionary based on the tenant institutional tier context.
 */
export function getTierPresentationConfig(tierName: string = "Primary School"): TierPresentationConfig {
  const category = classifyTierCategory(tierName);
  const badgeCode = formatTierBadgeCode(tierName);
  const tierSlug = sanitizeTierSlug(tierName);

  switch (category) {
    case "EARLY_CHILDHOOD":
      return {
        category,
        tierName,
        tierSlug,
        badgeCode,
        billingTitle: "Termly Tuition & Feeding Fees",
        courseMetricTitle: "Early Learning Modules & Activities",
        academicRankTitle: "Developmental Stage & Milestone Assessment",
        audienceFocus: "Parents & Registered Guardians",
        hasGpaMatrix: false,
        hasCreditUnitLoading: false,
        hasPickupLog: true,
        hasMidtermBreakdown: false,
        hasParentOrientation: true,
        currencySymbol: "₦",
      };

    case "SECONDARY":
      return {
        category,
        tierName,
        tierSlug,
        badgeCode,
        billingTitle: "Termly School Fees & Academic Levies",
        courseMetricTitle: "Enrolled Secondary Subjects",
        academicRankTitle: "Class Rank, Continuous Assessment & Exam Result",
        audienceFocus: "Students & Parents",
        hasGpaMatrix: false,
        hasCreditUnitLoading: false,
        hasPickupLog: false,
        hasMidtermBreakdown: true,
        hasParentOrientation: false,
        currencySymbol: "₦",
      };

    case "HIGHER_ED":
    default:
      return {
        category,
        tierName,
        tierSlug,
        badgeCode,
        billingTitle: "Tuition & Faculty Dues",
        courseMetricTitle: "Active Course Credit Unit Loading",
        academicRankTitle: "GPA Matrix Tracking & Cumulative Standing",
        audienceFocus: "Independent Collegiate Scholar",
        hasGpaMatrix: true,
        hasCreditUnitLoading: true,
        hasPickupLog: false,
        hasMidtermBreakdown: false,
        hasParentOrientation: false,
        currencySymbol: "₦",
      };
  }
}

/**
 * Standard list of tier presets for testing & institutional switching
 */
export const INSTITUTIONAL_TIER_PRESETS = [
  { name: "Daycare / Nursery", category: "EARLY_CHILDHOOD" as const, desc: "Creche, Playgroup & Nursery" },
  { name: "Primary School", category: "EARLY_CHILDHOOD" as const, desc: "Basic Elementary Classes 1-6" },
  { name: "Secondary School", category: "SECONDARY" as const, desc: "Junior & Senior High School (JSS1 - SSS3)" },
  { name: "College of Education", category: "HIGHER_ED" as const, desc: "Teacher Training & Diploma Studies" },
  { name: "Polytechnic", category: "HIGHER_ED" as const, desc: "ND & HND Technology & Applied Sciences" },
  { name: "University", category: "HIGHER_ED" as const, desc: "Undergraduate Degree & Collegiate Faculties" },
];
