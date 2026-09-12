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
  if (upper.includes("COLLEGE")) return "college";
  
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

