import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTenant } from "@/lib/tenant-context";

// ==============================================================================
// 1. ACADEMIC TIER ENUMS & TYPES
// ==============================================================================

export type AcademicTierType = 
  | "DAYCARE_NURSERY" 
  | "PRIMARY" 
  | "SECONDARY" 
  | "TERTIARY";

export type BillingStructureType = "FLAT" | "PER_CREDIT";

export interface TierTerminology {
  periodName: string;         // e.g. "Term" vs "Semester"
  periodPlural: string;       // e.g. "Terms" vs "Semesters"
  revenueLabel: string;       // e.g. "Termly Revenue" vs "Semester Revenue"
  billingTitle: string;       // e.g. "Termly Tuition & Care Fees" vs "Semester Tuition & Faculty Dues"
  billingUnitLabel: string;   // e.g. "Termly Flat Fee" vs "Per Credit Unit"
  classLabel: string;         // e.g. "Care Group / Class" vs "Grade" vs "Academic Level"
  studentLabel: string;       // e.g. "Pupil" vs "Student" vs "Collegiate Scholar"
  studentPlural: string;      // e.g. "Pupils" vs "Students" vs "Undergraduates"
  learnerPlural?: string;     // alias for studentPlural
  curriculumLabel: string;    // e.g. "Early Learning Modules" vs "Subjects" vs "Credit Units"
  rankingMetric: string;      // e.g. "Milestone Assessment" vs "Class Rank" vs "Semester GPA & CGPA"
  eventsLabel: string;        // e.g. "Care Activities" vs "Term Schedule" vs "Lecture Timetable"
}

export interface TierConfig {
  type: AcademicTierType;
  label: string;
  shortLabel: string;
  defaultClasses: string[];
  classAliases: string[];
  allowedBillingTypes: BillingStructureType[];
  allowsCreditUnits: boolean;
  terms: TierTerminology;
}

// ==============================================================================
// 2. CENTRALIZED CONFIGURATION MATRIX
// ==============================================================================

export const TIER_CONFIG_MATRIX: Record<AcademicTierType, TierConfig> = {
  DAYCARE_NURSERY: {
    type: "DAYCARE_NURSERY",
    label: "Daycare & Nursery",
    shortLabel: "NURSERY",
    defaultClasses: ["Creche", "Pre-Nursery", "Nursery 1", "Nursery 2", "Kindergarten"],
    classAliases: [
      "creche", "crèche", "nursery", "daycare", "kindergarten", 
      "pre-nursery", "playgroup", "toddler", "early"
    ],
    allowedBillingTypes: ["FLAT"],
    allowsCreditUnits: false,
    terms: {
      periodName: "Term",
      periodPlural: "Terms",
      revenueLabel: "Termly Revenue",
      billingTitle: "Termly Tuition & Feeding Fees",
      billingUnitLabel: "Termly Flat Fee",
      classLabel: "Class / Care Group",
      studentLabel: "Pupil",
      studentPlural: "Pupils",
      learnerPlural: "Pupils",
      curriculumLabel: "Early Learning Modules & Activities",
      rankingMetric: "Developmental Stage & Milestone Assessment",
      eventsLabel: "Daycare & Care Activities",
    },
  },
  PRIMARY: {
    type: "PRIMARY",
    label: "Primary Education",
    shortLabel: "PRIMARY",
    defaultClasses: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
    classAliases: [
      "primary", "basic", "grade 1", "grade 2", "grade 3", "grade 4", "grade 5", "grade 6",
      "class 1", "class 2", "class 3", "class 4", "class 5", "class 6", "elementary"
    ],
    allowedBillingTypes: ["FLAT"],
    allowsCreditUnits: false,
    terms: {
      periodName: "Term",
      periodPlural: "Terms",
      revenueLabel: "Termly Revenue",
      billingTitle: "Termly School Fees & Levies",
      billingUnitLabel: "Per Subject / Flat Fee",
      classLabel: "Grade / Class",
      studentLabel: "Pupil",
      studentPlural: "Pupils",
      learnerPlural: "Pupils",
      curriculumLabel: "Primary Subjects",
      rankingMetric: "Continuous Assessment & Class Position",
      eventsLabel: "Term Calendar & Events",
    },
  },
  SECONDARY: {
    type: "SECONDARY",
    label: "Secondary Education",
    shortLabel: "SECONDARY",
    defaultClasses: ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"],
    classAliases: [
      "jss", "sss", "secondary", "high school", "junior secondary", "senior secondary",
      "ss 1", "ss 2", "ss 3", "grade 7", "grade 8", "grade 9", "grade 10", "grade 11", "grade 12"
    ],
    allowedBillingTypes: ["FLAT"],
    allowsCreditUnits: false,
    terms: {
      periodName: "Term",
      periodPlural: "Terms",
      revenueLabel: "Termly Revenue",
      billingTitle: "Termly School Fees & Academic Levies",
      billingUnitLabel: "Per Subject / Flat Fee",
      classLabel: "Class",
      studentLabel: "Student",
      studentPlural: "Students",
      learnerPlural: "Students",
      curriculumLabel: "Secondary Subjects & Practical Labs",
      rankingMetric: "Terminal Exams, Class Position & Rank",
      eventsLabel: "Term Schedule & Academic Events",
    },
  },
  TERTIARY: {
    type: "TERTIARY",
    label: "Higher Education / University",
    shortLabel: "TERTIARY",
    defaultClasses: ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level"],
    classAliases: [
      "level", "100l", "200l", "300l", "400l", "500l", "university", "polytechnic", 
      "college of education", "nce", "nd 1", "nd 2", "hnd 1", "hnd 2", "degree", 
      "faculty", "undergraduate", "postgraduate", "tertiary"
    ],
    allowedBillingTypes: ["FLAT", "PER_CREDIT"],
    allowsCreditUnits: true,
    terms: {
      periodName: "Semester",
      periodPlural: "Semesters",
      revenueLabel: "Semester Revenue",
      billingTitle: "Semester Tuition & Faculty Dues",
      billingUnitLabel: "Per Credit Unit",
      classLabel: "Academic Level",
      studentLabel: "Collegiate Scholar",
      studentPlural: "Undergraduates",
      learnerPlural: "Students",
      curriculumLabel: "Active Course Credit Loading",
      rankingMetric: "Grade Point Average (GPA & Cumulative CGPA)",
      eventsLabel: "Semester Lecture & Exam Timetable",
    },
  },
};

// ==============================================================================
// 3. TIER RESOLUTION & VALIDATION UTILITIES
// ==============================================================================

/**
 * Normalizes any string, slug, or tier name to an AcademicTierType enum.
 */
export function resolveTierType(tierIdentifier?: string | null): AcademicTierType {
  if (!tierIdentifier) return "PRIMARY";
  const lower = tierIdentifier.toLowerCase().trim();

  // 1. Daycare / Nursery
  if (
    lower.includes("nursery") ||
    lower.includes("daycare") ||
    lower.includes("creche") ||
    lower.includes("crèche") ||
    lower.includes("kindergarten") ||
    lower.includes("pre-nursery") ||
    lower.includes("playgroup") ||
    lower === "early_childhood"
  ) {
    return "DAYCARE_NURSERY";
  }

  // 2. Tertiary / Higher Ed
  if (
    lower.includes("university") ||
    lower.includes("polytechnic") ||
    lower.includes("college of education") ||
    lower.includes("tertiary") ||
    lower.includes("higher") ||
    lower.includes("degree") ||
    lower.includes("undergraduate") ||
    lower.includes("monotechnic") ||
    lower === "higher_ed"
  ) {
    return "TERTIARY";
  }

  // 3. Secondary School
  if (
    lower.includes("secondary") ||
    lower.includes("high school") ||
    lower.includes("jss") ||
    lower.includes("sss") ||
    lower.includes("junior") ||
    lower.includes("senior")
  ) {
    return "SECONDARY";
  }

  // 4. Primary School
  if (
    lower.includes("primary") ||
    lower.includes("basic") ||
    lower.includes("elementary") ||
    lower.includes("grade")
  ) {
    return "PRIMARY";
  }

  return "PRIMARY";
}

/**
 * Retrieves the comprehensive TierConfig object for an identifier.
 */
export function getTierConfig(tierIdentifier?: string | null): TierConfig {
  const type = resolveTierType(tierIdentifier);
  return TIER_CONFIG_MATRIX[type];
}

/**
 * Determines whether a given class string belongs to a specific academic tier.
 */
export function isClassInTier(className: string, tier?: string | AcademicTierType): boolean {
  if (!className) return false;
  const tierType = resolveTierType(tier);
  const lower = className.toLowerCase().trim();

  // Check against explicit default classes first
  const config = TIER_CONFIG_MATRIX[tierType];
  if (config.defaultClasses.some(dc => dc.toLowerCase() === lower)) {
    return true;
  }

  // Strict negative boundaries to prevent cross-bleeding:
  // Tertiary cues
  const hasTertiaryCue = 
    lower.includes("level") || lower.includes("100l") || lower.includes("200l") || 
    lower.includes("300l") || lower.includes("400l") || lower.includes("500l") || 
    lower.includes("nd 1") || lower.includes("nd 2") || lower.includes("hnd") || 
    lower.includes("nce") || lower.includes("degree");
  
  if (hasTertiaryCue) {
    return tierType === "TERTIARY";
  }

  // Secondary cues
  const hasSecondaryCue = 
    lower.includes("jss") || lower.includes("sss") || lower.includes("ss 1") || 
    lower.includes("ss 2") || lower.includes("ss 3") || lower.includes("secondary") ||
    lower.includes("form ");
  
  if (hasSecondaryCue) {
    return tierType === "SECONDARY";
  }

  // Daycare / Nursery cues
  const hasDaycareCue = 
    lower.includes("creche") || lower.includes("crèche") || lower.includes("nursery") || 
    lower.includes("daycare") || lower.includes("kindergarten") || lower.includes("pre-nursery") ||
    lower.includes("playgroup");
  
  if (hasDaycareCue) {
    return tierType === "DAYCARE_NURSERY";
  }

  // Primary cues
  const hasPrimaryCue = 
    lower.includes("primary") || lower.includes("basic") || lower.includes("elementary") ||
    /^class\s*[1-6](\s|$)/i.test(lower) || /^grade\s*[1-6](\s|$)/i.test(lower);
  
  if (hasPrimaryCue) {
    return tierType === "PRIMARY";
  }

  // Fallback alias substring matching for the requested tier
  return config.classAliases.some(alias => lower.includes(alias));
}

/**
 * Filters a raw list of class strings so that ONLY classes matching the active tier remain.
 * If no classes match, falls back safely to the tier's default classes.
 */
export function filterClassesForTier(classes: string[], tier?: string | AcademicTierType): string[] {
  const tierType = resolveTierType(tier);
  const filtered = classes.filter(c => isClassInTier(c, tierType));
  if (filtered.length > 0) {
    return Array.from(new Set(filtered));
  }
  return TIER_CONFIG_MATRIX[tierType].defaultClasses;
}

/**
 * Returns the authoritative class options for a tier, combining matching custom classrooms with defaults.
 */
export function getClassesForTier(tier?: string | AcademicTierType, customClassrooms: string[] = []): string[] {
  const tierType = resolveTierType(tier);
  const defaults = TIER_CONFIG_MATRIX[tierType].defaultClasses;
  const customMatching = customClassrooms.filter(c => isClassInTier(c, tierType));
  return Array.from(new Set([...defaults, ...customMatching]));
}

// ==============================================================================
// 4. DATA MODEL DOMAIN ISOLATION PRUNERS
// ==============================================================================

/**
 * Prunes a student list to contain strictly entities belonging to the active tier.
 */
export function filterStudentsForTier<T extends { 
  id?: string;
  currentClass?: string | null; 
  tierId?: string | null; 
  tier?: { name?: string; id?: string } | null;
}>(
  students: T[], 
  tier?: string | AcademicTierType, 
  activeTierId?: string
): T[] {
  const tierType = resolveTierType(tier);
  return students.filter(student => {
    // 1. Direct tierId match
    if (activeTierId && student.tierId) {
      return student.tierId === activeTierId;
    }
    // 2. Direct tier object match
    if (student.tier?.name) {
      return resolveTierType(student.tier.name) === tierType;
    }
    if (activeTierId && student.tier?.id) {
      return student.tier.id === activeTierId;
    }
    // 3. Current class alignment
    if (student.currentClass) {
      return isClassInTier(student.currentClass, tierType);
    }
    return false;
  });
}

/**
 * Prunes an invoice list to eliminate invoices of students enrolled in other academic tiers.
 */
export function filterInvoicesForTier<T extends {
  student?: {
    currentClass?: string | null;
    tierId?: string | null;
    tier?: { name?: string; id?: string } | null;
  } | null;
}>(
  invoices: T[],
  tier?: string | AcademicTierType,
  activeTierId?: string
): T[] {
  const tierType = resolveTierType(tier);
  return invoices.filter(invoice => {
    if (!invoice.student) return true; // Keep system/general invoices if unattached
    
    if (activeTierId && invoice.student.tierId) {
      return invoice.student.tierId === activeTierId;
    }
    if (invoice.student.tier?.name) {
      return resolveTierType(invoice.student.tier.name) === tierType;
    }
    if (activeTierId && invoice.student.tier?.id) {
      return invoice.student.tier.id === activeTierId;
    }
    if (invoice.student.currentClass) {
      return isClassInTier(invoice.student.currentClass, tierType);
    }
    return true;
  });
}

/**
 * Prunes fee templates according to tier constraints (e.g. stripping credit units from Daycare/Primary).
 */
export function filterFeeTemplatesForTier<T extends { 
  name: string; 
  billingType?: string | null;
}>(
  templates: T[], 
  tier?: string | AcademicTierType
): T[] {
  const tierType = resolveTierType(tier);
  const config = TIER_CONFIG_MATRIX[tierType];

  return templates.filter(template => {
    // If credit unit is used and not allowed in this tier, prune it
    if (template.billingType === "PER_CREDIT" && !config.allowsCreditUnits) {
      return false;
    }

    const lowerName = template.name.toLowerCase();

    // In Daycare/Nursery: prune university and secondary specific templates
    if (tierType === "DAYCARE_NURSERY") {
      if (
        lowerName.includes("credit unit") ||
        lowerName.includes("level") ||
        lowerName.includes("faculty") ||
        lowerName.includes("jss") ||
        lowerName.includes("sss") ||
        lowerName.includes("secondary") ||
        lowerName.includes("matriculation")
      ) {
        return false;
      }
    }

    // In Primary/Secondary: prune tertiary and early-childhood specific templates
    if (tierType === "PRIMARY" || tierType === "SECONDARY") {
      if (
        lowerName.includes("creche") ||
        lowerName.includes("diaper") ||
        lowerName.includes("faculty") ||
        lowerName.includes("credit unit") ||
        lowerName.includes("100 level") ||
        lowerName.includes("200 level")
      ) {
        return false;
      }
    }

    // In Tertiary: prune daycare/creche/nursery templates
    if (tierType === "TERTIARY") {
      if (
        lowerName.includes("creche") ||
        lowerName.includes("diaper") ||
        lowerName.includes("nursery") ||
        lowerName.includes("kindergarten")
      ) {
        return false;
      }
    }

    return true;
  });
}

// ==============================================================================
// 5. REACT CLIENT HOOK
// ==============================================================================

/**
 * Hook to dynamically resolve the active tier and isolation configuration
 * directly in client components based on URL query params and global tenant context.
 */
export function useActiveTierConfig(customTierIdentifier?: string | null) {
  const searchParams = useSearchParams();
  const tenant = useTenant();

  const activeTierParam = searchParams?.get("tier");
  const tenantTier = tenant?.preciseTier || tenant?.institutionType;

  const resolvedType = useMemo(() => {
    return resolveTierType(customTierIdentifier || activeTierParam || tenantTier);
  }, [customTierIdentifier, activeTierParam, tenantTier]);

  const tierConfig = useMemo(() => {
    return TIER_CONFIG_MATRIX[resolvedType];
  }, [resolvedType]);

  return {
    activeTier: resolvedType,
    tierConfig,
    isDaycare: resolvedType === "DAYCARE_NURSERY",
    isPrimary: resolvedType === "PRIMARY",
    isSecondary: resolvedType === "SECONDARY",
    isTertiary: resolvedType === "TERTIARY",
    filterClasses: (classes: string[]) => filterClassesForTier(classes, resolvedType),
    getClasses: (custom?: string[]) => getClassesForTier(resolvedType, custom),
    filterStudents: <T extends { currentClass?: string | null; tierId?: string | null; tier?: { name?: string; id?: string } | null }>(students: T[], activeTierId?: string) => 
      filterStudentsForTier(students, resolvedType, activeTierId),
    filterInvoices: <T extends { student?: { currentClass?: string | null; tierId?: string | null; tier?: { name?: string; id?: string } | null } | null }>(invoices: T[], activeTierId?: string) => 
      filterInvoicesForTier(invoices, resolvedType, activeTierId),
    filterFeeTemplates: <T extends { name: string; billingType?: string | null }>(templates: T[]) => 
      filterFeeTemplatesForTier(templates, resolvedType),
  };
}
