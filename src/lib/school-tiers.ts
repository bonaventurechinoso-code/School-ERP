export const TIER_CLASSES: Record<string, string[]> = {
  creche: ["Creche", "Playgroup"],
  nursery: ["Kindergarten", "Nursery 1", "Nursery 2", "Nursery 3"],
  primary: [
    "Primary 1",
    "Primary 2",
    "Primary 3",
    "Primary 4",
    "Primary 5",
    "Primary 6",
  ],
  secondary: ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
  basic: [
    "Primary 1",
    "Primary 2",
    "Primary 3",
    "Primary 4",
    "Primary 5",
    "Primary 6",
    "JSS1",
    "JSS2",
    "JSS3",
    "SS1",
    "SS2",
    "SS3",
  ],
  all: [
    "Creche",
    "Playgroup",
    "Kindergarten",
    "Nursery 1",
    "Nursery 2",
    "Nursery 3",
    "Primary 1",
    "Primary 2",
    "Primary 3",
    "Primary 4",
    "Primary 5",
    "Primary 6",
    "JSS1",
    "JSS2",
    "JSS3",
    "SS1",
    "SS2",
    "SS3",
  ],
};

export function getClassesForTier(tier: string): string[] {
  if (!tier) return TIER_CLASSES.nursery;
  const normalized = tier.toLowerCase().trim();

  if (normalized === "secondary" || normalized.includes("secondary")) {
    return TIER_CLASSES.secondary;
  }
  if (normalized === "primary" || normalized.includes("primary")) {
    return PRIMARY_ALLOWED_CLASSES;
  }
  if (
    normalized === "creche" ||
    normalized.includes("creche") ||
    normalized.includes("creche")
  ) {
    return TIER_CLASSES.creche;
  }
  if (
    normalized === "nursery" ||
    normalized.includes("nursery") ||
    normalized.includes("kindergarten")
  ) {
    return TIER_CLASSES.nursery;
  }
  if (normalized === "basic" || normalized.includes("basic")) {
    return TIER_CLASSES.basic;
  }
  if (normalized === "all" || normalized.includes("all")) {
    return TIER_CLASSES.all;
  }

  // Direct key lookup
  if (TIER_CLASSES[normalized]) {
    return TIER_CLASSES[normalized];
  }

  return TIER_CLASSES.secondary;
}

export const PRIMARY_ALLOWED_CLASSES = [
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
];

export const SECONDARY_ALLOWED_CLASSES = [
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SSS 1",
  "SSS 2",
  "SSS 3",
];

export const CRECHE_ALLOWED_CLASSES = [
  "Creche",
];

export const COMBINED_ALLOWED_CLASSES = [
  "Creche",
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SSS 1",
  "SSS 2",
  "SSS 3",
];

export const TERTIARY_ALLOWED_CLASSES = [
  "100 Level",
  "200 Level",
  "300 Level",
  "400 Level",
  "500 Level",
  "Postgraduate",
];

/**
 * Returns the authoritative class levels allowed for a school tier.
 * Primary tier school = Nursery 1, Nursery 2, Primary 1-6 (8 items max).
 * Secondary tier = JSS 1-3, SSS 1-3 (6 items).
 * Creche tier = Creche.
 * Combined / All = All grades.
 */
export function getAllowedLevelsByTier(tier?: string | null): string[] {
  if (!tier) return PRIMARY_ALLOWED_CLASSES;
  const normalized = tier.toUpperCase().trim();

  if (
    normalized === "SECONDARY" ||
    normalized.includes("SECONDARY") ||
    normalized.includes("HIGH") ||
    normalized.includes("JSS") ||
    normalized.includes("SSS")
  ) {
    return SECONDARY_ALLOWED_CLASSES;
  }

  if (
    normalized === "CRECHE" ||
    normalized.includes("CRECHE") ||
    normalized.includes("CRÈCHE")
  ) {
    return CRECHE_ALLOWED_CLASSES;
  }

  if (
    normalized === "COMBINED" ||
    normalized === "ALL" ||
    normalized.includes("K12") ||
    (normalized.includes("PRIMARY") && normalized.includes("SECONDARY"))
  ) {
    return COMBINED_ALLOWED_CLASSES;
  }

  if (
    normalized === "TERTIARY" ||
    normalized.includes("TERTIARY") ||
    normalized.includes("UNIVERSITY") ||
    normalized.includes("POLYTECHNIC") ||
    normalized.includes("COLLEGE") ||
    normalized.includes("HIGHER")
  ) {
    return TERTIARY_ALLOWED_CLASSES;
  }

  // Default: PRIMARY tier school = allowed class levels = NURSERY + PRIMARY (8 items max)
  return PRIMARY_ALLOWED_CLASSES;
}

