/**
 * Single Source of Truth for School Tiers, Canonical Classes, and Class Scoping.
 * Isomorphic: safe to use in Server Actions, Server Components, and Client Components.
 */

export type EducationalTierCategory = "NURSERY" | "PRIMARY" | "SECONDARY" | "TERTIARY";

export interface SchoolTierItem {
  category: EducationalTierCategory;
  name: string;
  label: string;
  badgeCode: string;
  level: number;
}

export interface SchoolTierInfo {
  schoolId?: string;
  schoolName: string;
  subdomain: string;
  isDemo: boolean;
  registeredTiers: SchoolTierItem[];
  hasNursery: boolean;
  hasPrimary: boolean;
  hasSecondary: boolean;
  hasTertiary: boolean;
  isMultiTier: boolean;
  mainTierCategory: EducationalTierCategory;
  defaultClass: string;
  tierSummaryLabel: string;
}

export interface TierClassGroup {
  tierCategory: EducationalTierCategory;
  tierName: string;
  label: string;
  classes: string[];
}

export interface SchoolClassesResult {
  groups: TierClassGroup[];
  allClasses: string[];
  defaultClass: string;
  tierInfo: SchoolTierInfo;
}

// Canonical standard classes for Nigerian educational tiers
export const CANONICAL_TIER_CLASSES: Record<EducationalTierCategory, string[]> = {
  NURSERY: [
    "Creche",
    "Nursery 1",
    "Nursery 2",
    "Nursery 3",
    "Kindergarten",
  ],
  PRIMARY: [
    "Primary 1",
    "Primary 2",
    "Primary 3",
    "Primary 4",
    "Primary 5",
    "Primary 6",
  ],
  SECONDARY: [
    "JSS 1",
    "JSS 2",
    "JSS 3",
    "SS 1",
    "SS 2",
    "SS 3",
  ],
  TERTIARY: [
    "100 Level",
    "200 Level",
    "300 Level",
    "400 Level",
    "500 Level",
  ],
};

/**
 * Maps any class name (e.g. "Primary 3", "JSS 1", "Creche", "SS 2", "100 Level")
 * to its exact Educational Tier Category, canonical name, and badge styling.
 */
export function getTierForClass(className: string): {
  category: EducationalTierCategory;
  name: string;
  badgeLabel: string;
  badgeCode: string;
  badgeColor: string;
} {
  const norm = (className || "").trim().toUpperCase();

  // 1. Early Years / Nursery / Creche
  if (
    norm.includes("CRECHE") ||
    norm.includes("NURSERY") ||
    norm.includes("CRÈCHE") ||
    norm.includes("PRE-SCHOOL") ||
    norm.includes("KINDERGARTEN") ||
    norm.includes("DAYCARE") ||
    norm.includes("PLAYGROUP") ||
    norm.includes("EARLY")
  ) {
    return {
      category: "NURSERY",
      name: "Creche / Nursery",
      badgeLabel: "Creche / Nursery",
      badgeCode: "NURSERY",
      badgeColor: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    };
  }

  // 2. Primary / Elementary / Basic
  if (
    norm.includes("PRIMARY") ||
    norm.includes("BASIC") ||
    norm.includes("ELEMENTARY") ||
    norm.includes("PRI ") ||
    /^PRI\s*[1-6]/i.test(norm) ||
    norm.includes("GRADE 1") ||
    norm.includes("GRADE 2") ||
    norm.includes("GRADE 3") ||
    norm.includes("GRADE 4") ||
    norm.includes("GRADE 5") ||
    norm.includes("GRADE 6")
  ) {
    return {
      category: "PRIMARY",
      name: "Primary School",
      badgeLabel: "Primary School",
      badgeCode: "PRIMARY",
      badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    };
  }

  // 3. Secondary / High School (JSS / SSS)
  if (
    norm.includes("JSS") ||
    norm.includes("SSS") ||
    /\bSS\s*[1-3]\b/i.test(norm) ||
    /\bJS\s*[1-3]\b/i.test(norm) ||
    norm.includes("SECONDARY") ||
    norm.includes("HIGH SCHOOL")
  ) {
    return {
      category: "SECONDARY",
      name: "Secondary School",
      badgeLabel: "Secondary School",
      badgeCode: "SECONDARY",
      badgeColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    };
  }

  // 4. Tertiary / Higher Ed
  if (
    norm.includes("LEVEL") ||
    norm.includes("ND") ||
    norm.includes("HND") ||
    norm.includes("NCE") ||
    norm.includes("UNIVERSITY") ||
    norm.includes("POLYTECHNIC") ||
    norm.includes("COLLEGE") ||
    norm.includes("YEAR")
  ) {
    return {
      category: "TERTIARY",
      name: "Higher Institution",
      badgeLabel: "Tertiary / Higher Ed",
      badgeCode: "TERTIARY",
      badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    };
  }

  // Default fallback to Primary School
  return {
    category: "PRIMARY",
    name: "Primary School",
    badgeLabel: "Primary School",
    badgeCode: "PRIMARY",
    badgeColor: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  };
}

/**
 * Resolves a school's registered educational tiers from its DB attributes.
 * Reads School.tier enum, School.academicTiers relation, and school name/subdomain.
 */
export function resolveSchoolTiers(input: {
  schoolId?: string;
  name?: string | null;
  subdomain?: string | null;
  tier?: string | null;
  academicTiers?: Array<{ name?: string | null; level?: number | null }> | null;
}): SchoolTierInfo {
  const subdomain = (input.subdomain || "").toLowerCase().trim();
  const schoolName = (input.name || subdomain || "School").trim();
  const isDemo = subdomain === "demo" || subdomain.includes("sandbox");

  // Collect registered tier entities from academicTiers if present
  const rawAcademicTiers = Array.isArray(input.academicTiers) ? input.academicTiers : [];

  let hasNursery = false;
  let hasPrimary = false;
  let hasSecondary = false;
  let hasTertiary = false;

  // 1. Analyze explicit AcademicTier records in DB
  rawAcademicTiers.forEach((tier) => {
    const tName = (tier.name || "").toUpperCase();
    if (
      tName.includes("CRECHE") ||
      tName.includes("NURSERY") ||
      tName.includes("EARLY") ||
      tName.includes("KINDERGARTEN") ||
      tName.includes("DAYCARE")
    ) {
      hasNursery = true;
    }
    if (
      tName.includes("PRIMARY") ||
      tName.includes("ELEMENTARY") ||
      tName.includes("BASIC")
    ) {
      hasPrimary = true;
    }
    if (
      tName.includes("SECONDARY") ||
      tName.includes("HIGH SCHOOL") ||
      tName.includes("JSS") ||
      tName.includes("SSS")
    ) {
      hasSecondary = true;
    }
    if (
      tName.includes("UNIVERSITY") ||
      tName.includes("POLYTECHNIC") ||
      tName.includes("COLLEGE") ||
      tName.includes("TERTIARY") ||
      tName.includes("HIGHER")
    ) {
      hasTertiary = true;
    }
  });

  // 2. Also analyze School.tier enum
  const schoolTierEnum = (input.tier || "").toUpperCase().trim();
  if (schoolTierEnum === "CRECHE") {
    hasNursery = true;
  } else if (schoolTierEnum === "PRIMARY") {
    hasPrimary = true;
  } else if (schoolTierEnum === "SECONDARY") {
    hasSecondary = true;
  } else if (schoolTierEnum === "TERTIARY") {
    hasTertiary = true;
  }

  // 3. Fallback to school name / subdomain if no academicTiers were seeded yet
  if (!hasNursery && !hasPrimary && !hasSecondary && !hasTertiary) {
    const nameLower = schoolName.toLowerCase();
    if (nameLower.includes("creche") || nameLower.includes("daycare") || nameLower.includes("nursery")) {
      hasNursery = true;
    }
    if (nameLower.includes("primary") || nameLower.includes("basic") || nameLower.includes("elementary")) {
      hasPrimary = true;
    }
    if (nameLower.includes("secondary") || nameLower.includes("grammar") || nameLower.includes("high school") || nameLower.includes("college")) {
      hasSecondary = true;
    }
    if (nameLower.includes("polytechnic") || nameLower.includes("university") || nameLower.includes("institute")) {
      hasTertiary = true;
    }
  }

  // Demo tenant is intentionally comprehensive/mixed-tier
  if (isDemo) {
    hasNursery = true;
    hasPrimary = true;
    hasSecondary = true;
    hasTertiary = true;
  }

  // Build the list of registered tier items in logical progression order
  const registeredTiers: SchoolTierItem[] = [];

  if (hasNursery) {
    registeredTiers.push({
      category: "NURSERY",
      name: "Creche / Nursery",
      label: "Early Years / Creche & Nursery",
      badgeCode: "NURSERY",
      level: 1,
    });
  }

  if (hasPrimary) {
    registeredTiers.push({
      category: "PRIMARY",
      name: "Primary School",
      label: "Primary School",
      badgeCode: "PRIMARY",
      level: 2,
    });
  }

  if (hasSecondary) {
    registeredTiers.push({
      category: "SECONDARY",
      name: "Secondary School",
      label: "Secondary School",
      badgeCode: "SECONDARY",
      level: 3,
    });
  }

  if (hasTertiary) {
    registeredTiers.push({
      category: "TERTIARY",
      name: "Higher Institution",
      label: "Higher Education / Tertiary",
      badgeCode: "TERTIARY",
      level: 4,
    });
  }

  // Absolute fallback: if completely unconfigured, default to PRIMARY
  if (registeredTiers.length === 0) {
    hasPrimary = true;
    registeredTiers.push({
      category: "PRIMARY",
      name: "Primary School",
      label: "Primary School",
      badgeCode: "PRIMARY",
      level: 2,
    });
  }

  // Determine main tier category & default class
  // RULE: For a Primary school that includes Early Years, main tier is PRIMARY and default is "Primary 1"
  let mainTierCategory: EducationalTierCategory = "PRIMARY";
  let defaultClass = "Primary 1";

  if (hasPrimary) {
    mainTierCategory = "PRIMARY";
    defaultClass = "Primary 1";
  } else if (hasSecondary) {
    mainTierCategory = "SECONDARY";
    defaultClass = "JSS 1";
  } else if (hasTertiary) {
    mainTierCategory = "TERTIARY";
    defaultClass = "100 Level";
  } else if (hasNursery) {
    mainTierCategory = "NURSERY";
    defaultClass = "Nursery 1";
  }

  const isMultiTier = registeredTiers.length > 1;
  const tierSummaryLabel = registeredTiers.map((t) => t.name).join(" • ");

  return {
    schoolId: input.schoolId,
    schoolName,
    subdomain,
    isDemo,
    registeredTiers,
    hasNursery,
    hasPrimary,
    hasSecondary,
    hasTertiary,
    isMultiTier,
    mainTierCategory,
    defaultClass,
    tierSummaryLabel,
  };
}

/**
 * Returns strictly scoped classes for a school, grouped by its registered tiers.
 * Guarantees:
 * - A Primary-only school NEVER shows Creche, Nursery, JSS, SSS, or Tertiary classes.
 * - A Primary school with Early Years shows Creche/Nursery + Primary 1-6, grouped, defaulting to Primary 1.
 * - A Secondary school shows ONLY JSS 1-3 and SS 1-3.
 * - Includes any custom classrooms or student classes created for that school IF they belong to its tiers.
 */
export function getClassesForSchool(
  schoolInput: {
    schoolId?: string;
    name?: string | null;
    subdomain?: string | null;
    tier?: string | null;
    academicTiers?: Array<{ name?: string | null; level?: number | null }> | null;
  },
  options?: {
    students?: Array<{ currentClass?: string | null }>;
    classrooms?: Array<{ name?: string | null }>;
  }
): SchoolClassesResult {
  const tierInfo = resolveSchoolTiers(schoolInput);

  // Group classes by each registered tier category
  const groups: TierClassGroup[] = [];
  const allClassesSet = new Set<string>();

  tierInfo.registeredTiers.forEach((tier) => {
    const canonicalClasses = CANONICAL_TIER_CLASSES[tier.category] || [];
    const classSet = new Set<string>(canonicalClasses);

    // Merge any actual classrooms created for this school that match this tier
    if (options?.classrooms && Array.isArray(options.classrooms)) {
      options.classrooms.forEach((c) => {
        const cName = c?.name?.trim();
        if (cName) {
          const cTier = getTierForClass(cName);
          if (cTier.category === tier.category) {
            classSet.add(cName);
          }
        }
      });
    }

    // Merge any student currentClass strings that match this tier
    if (options?.students && Array.isArray(options.students)) {
      options.students.forEach((s) => {
        const sClass = s.currentClass?.trim();
        if (sClass) {
          const sTier = getTierForClass(sClass);
          if (sTier.category === tier.category) {
            classSet.add(sClass);
          }
        }
      });
    }

    const classArray = Array.from(classSet);
    classArray.forEach((cls) => allClassesSet.add(cls));

    groups.push({
      tierCategory: tier.category,
      tierName: tier.name,
      label: tier.label,
      classes: classArray,
    });
  });

  const allClasses = Array.from(allClassesSet);

  return {
    groups,
    allClasses,
    defaultClass: tierInfo.defaultClass,
    tierInfo,
  };
}

