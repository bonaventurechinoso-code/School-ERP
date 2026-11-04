/**
 * Utility to normalize schoolDomain / tenant subdomain across all environments.
 * Strips protocol, port, host ("bonaveeict.com.ng"), and path segments.
 * Makes domain comparisons case-insensitive.
 */
export function cleanSchoolDomain(domain?: string | null): string {
  if (!domain) return "egede";
  let d = domain.trim().toLowerCase();
  d = d.replace(/^https?:\/\//i, "");
  d = d.replace(/:\d+$/, "");
  if (d.includes("/")) {
    const parts = d.split("/").filter(Boolean);
    d = parts[parts.length - 1];
  }
  if (d === "bonaveeict.com.ng" || d === "bonaveeict") {
    return "egede";
  }
  d = d.replace(/\.bonaveeict\.com\.ng$/i, "");
  return d || "egede";
}

