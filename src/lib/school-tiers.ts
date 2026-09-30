export const TIER_CLASSES: Record<string, string[]> = {
  daycare: ["Daycare", "Playgroup"],
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
    "Daycare",
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
    return TIER_CLASSES.primary;
  }
  if (
    normalized === "daycare" ||
    normalized.includes("daycare") ||
    normalized.includes("creche")
  ) {
    return TIER_CLASSES.daycare;
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
