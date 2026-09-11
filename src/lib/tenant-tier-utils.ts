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
