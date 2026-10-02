/**
 * Isomorphic utility functions for tenant tier identifiers and database naming.
 * Safe for use in both Client Components and Server Components.
 */

/**
 * Standardizes a tier name to a clean identifier slug.
 * e.g. "Daycare / Nursery" -> "nursery", "Primary School" -> "primary"
 */
export function sanitizeTierSlug(tierName: string): string {
  const upper = (tierName || "").toUpperCase().trim();
  if (upper.includes("DAYCARE") || upper.includes("NURSERY")) return "nursery";
  if (upper.includes("PRIMARY") && upper.includes("SECONDARY")) return "primary_secondary";
  if (upper.includes("PRIMARY")) return "primary";
  if (upper.includes("SECONDARY")) return "secondary";
  if (upper.includes("UNIVERSITY")) return "university";
  if (upper.includes("POLYTECHNIC")) return "polytechnic";
  if (upper.includes("COLLEGE")) return "college_education";
  
  // Fallback: clean alphanumeric
  return tierName.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 20);
}

/**
 * Generates the standardized database name for a tenant tier.
 * Standard format: tenant_slug_tiername (e.g. greenwood_primary)
 */
export function generateTierDbName(subdomain: string, tierName: string): string {
  const cleanSubdomain = (subdomain || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const tierSlug = sanitizeTierSlug(tierName);
  return `${cleanSubdomain}_${tierSlug}`;
}

/**
 * Resolves an uppercase short code/identifier for badge display.
 * e.g. "Daycare / Nursery" -> "NURSERY", "Primary School" -> "PRIMARY", "Secondary School" -> "SECONDARY"
 */
export function formatTierBadgeCode(tierName?: string): string {
  if (!tierName) return "PRIMARY";
  const upper = tierName.toUpperCase().trim();
  if (upper.includes("DAYCARE") || upper.includes("NURSERY") || upper.includes("CRÈCHE") || upper.includes("CRECHE")) {
    return "NURSERY";
  }
  if (upper.includes("PRIMARY") && upper.includes("SECONDARY")) {
    return "K12";
  }
  if (upper.includes("PRIMARY") || upper.includes("ELEMENTARY") || upper.includes("BASIC")) {
    return "PRIMARY";
  }
  if (upper.includes("SECONDARY") || upper.includes("HIGH SCHOOL") || upper.includes("JSS") || upper.includes("SSS")) {
    return "SECONDARY";
  }
  if (upper.includes("UNIVERSITY")) {
    return "UNIVERSITY";
  }
  if (upper.includes("POLYTECHNIC")) {
    return "POLYTECHNIC";
  }
  if (upper.includes("COLLEGE")) {
    return "COLLEGE";
  }
  
  return tierName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12) || "PRIMARY";
}

/**
 * Checks if a given tier name corresponds to Higher Education (collegiate) vs K-12.
 */
export function isHigherEdTier(tierName?: string): boolean {
  if (!tierName) return false;
  const upper = tierName.toUpperCase();
  return (
    upper.includes("UNIVERSITY") ||
    upper.includes("POLYTECHNIC") ||
    upper.includes("COLLEGE") ||
    upper.includes("HIGHER ED") ||
    upper.includes("TERTIARY")
  );
}

/**
 * Resolves a concise school acronym or prefix from its subdomain.
 * e.g. "greenwood" -> "GW", "oxford" -> "OXF"
 */
export function resolveSchoolPrefix(subdomain?: string): string {
  if (!subdomain) return "SCH";
  const sub = subdomain.trim().toUpperCase();
  if (sub === "GREENWOOD") return "GW";
  if (sub.length <= 4) return sub;
  return sub.substring(0, 3);
}

/**
 * Resolves a 3-4 letter tier abbreviation for admission number formatting.
 * e.g. "Secondary School" -> "SEC", "Primary School" -> "PRI", "Daycare / Nursery" -> "NUR"
 */
export function resolveTierCode(tierName?: string | null, className?: string | null): string {
  const combined = `${tierName || ""} ${className || ""}`.toUpperCase().trim();
  if (
    combined.includes("DAYCARE") ||
    combined.includes("NURSERY") ||
    combined.includes("CRÈCHE") ||
    combined.includes("CRECHE") ||
    combined.includes("KINDERGARTEN") ||
    combined.includes("PLAYGROUP") ||
    combined.includes("EARLY")
  ) {
    return "NUR";
  }
  if (
    combined.includes("PRIMARY") ||
    combined.includes("BASIC") ||
    combined.includes("ELEMENTARY")
  ) {
    return "PRI";
  }
  if (
    combined.includes("SECONDARY") ||
    combined.includes("HIGH SCHOOL") ||
    combined.includes("JSS") ||
    combined.includes("SSS") ||
    combined.includes("SS ") ||
    combined.includes("GRADE 7") ||
    combined.includes("GRADE 8") ||
    combined.includes("GRADE 9") ||
    combined.includes("GRADE 10") ||
    combined.includes("GRADE 11") ||
    combined.includes("GRADE 12")
  ) {
    return "SEC";
  }
  if (combined.includes("POLYTECHNIC") || combined.includes("ND") || combined.includes("HND")) {
    return "POLY";
  }
  if (combined.includes("COLLEGE") || combined.includes("NCE")) {
    return "COL";
  }
  if (combined.includes("UNIVERSITY") || combined.includes("DEGREE") || combined.includes("UNDERGRADUATE")) {
    return "UNI";
  }
  return "GEN";
}

/**
 * Generates an authentic institutional admission number with tier abbreviation.
 * Format: [PREFIX]/[TIER]/[YEAR]/[SEQ] (e.g. GW/SEC/2026/001)
 */
export function generateAdmissionNumber(options: {
  schoolSubdomain?: string;
  tierName?: string | null;
  currentClass?: string | null;
  studentSequence: number;
  year?: number;
}): string {
  const { schoolSubdomain = "SCH", tierName, currentClass, studentSequence, year = new Date().getFullYear() } = options;
  const prefix = resolveSchoolPrefix(schoolSubdomain);
  const tierCode = resolveTierCode(tierName, currentClass);
  const seq = String(studentSequence).padStart(3, "0");
  return `${prefix}/${tierCode}/${year}/${seq}`;
}

/**
 * Generates cross-tier and legacy admission number variants for resilient student authentication.
 * Handles cases where auto-generated admission numbers contain mismatched tier prefixes
 * (e.g. 'NUR' vs 'SEC' in 'RIV/NUR/2026/002'), legacy 3-part formats ('RIV/2026/002'),
 * or alternate delimiters.
 */
export function getAdmissionNumberSearchVariants(input: string): string[] {
  if (!input || typeof input !== "string") return [];
  const trimmed = input.trim();
  const set = new Set<string>();
  set.add(trimmed);
  set.add(trimmed.toUpperCase());
  set.add(trimmed.toLowerCase());

  // Extract delimiters (/ or - or \)
  const slashParts = trimmed.split(/[\/\\]/);
  const dashParts = trimmed.split("-");
  const parts = slashParts.length >= 3 ? slashParts : dashParts.length >= 3 ? dashParts : null;

  if (parts && parts.length >= 3) {
    const delimiter = slashParts.length >= 3 ? "/" : "-";
    const allTierCodes = ["SEC", "NUR", "PRI", "GEN", "UNI", "POLY", "COL", "BASIC", "JSS", "SSS"];

    if (parts.length === 4) {
      // 4-part format: [PREFIX, TIER, YEAR, SEQ] (e.g. RIV/NUR/2026/002)
      const [prefix, , year, seq] = parts;
      for (const t of allTierCodes) {
        set.add(`${prefix}${delimiter}${t}${delimiter}${year}${delimiter}${seq}`);
        set.add(`${prefix}${delimiter}${t}${delimiter}${year}${delimiter}${seq}`.toUpperCase());
        set.add(`${prefix}${delimiter}${t}${delimiter}${year}${delimiter}${seq}`.toLowerCase());
      }
      // 3-part legacy format without tier: RIV/2026/002
      set.add(`${prefix}${delimiter}${year}${delimiter}${seq}`);
      set.add(`${prefix}${delimiter}${year}${delimiter}${seq}`.toUpperCase());
      set.add(`${prefix}${delimiter}${year}${delimiter}${seq}`.toLowerCase());
    } else if (parts.length === 3) {
      // 3-part format: [PREFIX, YEAR, SEQ] (e.g. RIV/2026/002)
      const [prefix, yearOrTier, seq] = parts;
      if (/^\d{4}$/.test(yearOrTier)) {
        for (const t of allTierCodes) {
          set.add(`${prefix}${delimiter}${t}${delimiter}${yearOrTier}${delimiter}${seq}`);
          set.add(`${prefix}${delimiter}${t}${delimiter}${yearOrTier}${delimiter}${seq}`.toUpperCase());
          set.add(`${prefix}${delimiter}${t}${delimiter}${yearOrTier}${delimiter}${seq}`.toLowerCase());
        }
      }
    }
  }

  return Array.from(set);
}
