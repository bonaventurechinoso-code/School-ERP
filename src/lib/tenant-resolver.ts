/**
 * Tenant Subdomain Resolution & Routing Helpers
 * Supports production (bonaveeict.com.ng), staging (*.onrender.com), and local dev (*.localhost:3000)
 */

export const RESERVED_SUBDOMAINS = new Set([
  "register",
  "onboarding",
  "login",
  "www",
  "admin",
  "api",
  "app",
  "portal",
  "support",
  "mail",
  "blog",
  "bonaveeict",
  "test",
  "platform",
  "console",
  "dashboard",
  "super-admin",
  "superadmin",
  "static",
  "assets",
  "status",
  "dev",
  "staging",
]);

export interface HostInfo {
  rawHost: string;
  hostname: string;
  port: string | null;
  baseDomain: string;
  subdomain: string | null;
  isApex: boolean;
  isWww: boolean;
  protocol: string;
}

/**
 * Known platform root domains (in order of priority).
 */
export function getKnownRootDomains(): string[] {
  const envRoot = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(":")[0]
    .trim();

  return [
    envRoot,
    "bonaveeict.com.ng",
    "school-erp-97vz.onrender.com",
    "onrender.com",
  ].filter(Boolean);
}

/**
 * Extracts comprehensive host and subdomain telemetry from Host / x-forwarded-host headers.
 */
export function parseHostInfo(hostHeader?: string | null, protoHeader?: string | null): HostInfo {
  const fallbackProto = process.env.NODE_ENV === "production" ? "https" : "http";
  const protocol = (protoHeader || "").split(",")[0].trim() || fallbackProto;

  if (!hostHeader) {
    const rawRoot = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "bonaveeict.com.ng")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split(":")[0]
      .trim();

    const isLocal = rawRoot === "localhost" || rawRoot === "127.0.0.1";
    return {
      rawHost: rawRoot || "bonaveeict.com.ng",
      hostname: rawRoot || "bonaveeict.com.ng",
      port: isLocal ? "3000" : null,
      baseDomain: isLocal ? "localhost" : (rawRoot || "bonaveeict.com.ng"),
      subdomain: null,
      isApex: true,
      isWww: false,
      protocol: isLocal ? "http" : protocol,
    };
  }

  // 1. Take primary host from comma-delimited proxy headers & strip whitespace
  const rawHost = hostHeader.split(",")[0].trim().toLowerCase();

  // 2. Separate hostname and port
  let hostname = rawHost;
  let port: string | null = null;
  if (rawHost.includes(":")) {
    const parts = rawHost.split(":");
    hostname = parts[0];
    port = parts[1] || null;
  }

  // 3. Check for local development on localhost
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1") {
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return {
        rawHost,
        hostname,
        port,
        baseDomain: "localhost",
        subdomain: null,
        isApex: true,
        isWww: false,
        protocol: protoHeader || "http",
      };
    }
    if (hostname === "www.localhost") {
      return {
        rawHost,
        hostname,
        port,
        baseDomain: "localhost",
        subdomain: null,
        isApex: false,
        isWww: true,
        protocol: protoHeader || "http",
      };
    }
    const sub = hostname.replace(/\.localhost$/, "");
    const cleanSub = sub.replace(/^www\./, "").split(".")[0];
    return {
      rawHost,
      hostname,
      port,
      baseDomain: "localhost",
      subdomain: cleanSub || null,
      isApex: false,
      isWww: sub.startsWith("www."),
      protocol: protoHeader || "http",
    };
  }

  // 4. Match against known platform root domains
  const knownRoots = getKnownRootDomains();
  for (const root of knownRoots) {
    if (hostname === root) {
      return {
        rawHost,
        hostname,
        port,
        baseDomain: root,
        subdomain: null,
        isApex: true,
        isWww: false,
        protocol,
      };
    }
    if (hostname === `www.${root}`) {
      return {
        rawHost,
        hostname,
        port,
        baseDomain: root,
        subdomain: null,
        isApex: false,
        isWww: true,
        protocol,
      };
    }
    if (hostname.endsWith(`.${root}`)) {
      const sub = hostname.slice(0, -(root.length + 1));
      const cleanSub = sub.replace(/^www\./, "").split(".")[0];
      return {
        rawHost,
        hostname,
        port,
        baseDomain: root,
        subdomain: cleanSub || null,
        isApex: false,
        isWww: sub.startsWith("www."),
        protocol,
      };
    }
  }

  // 5. Generic multi-part domain fallback (e.g., custom_domain or staging URL)
  const segments = hostname.split(".");
  if (segments.length >= 3) {
    const isWww = segments[0] === "www";
    const sub = isWww ? (segments.length >= 4 ? segments[1] : null) : segments[0];
    const base = isWww ? segments.slice(1).join(".") : segments.slice(1).join(".");
    return {
      rawHost,
      hostname,
      port,
      baseDomain: base,
      subdomain: sub,
      isApex: isWww && segments.length === 3,
      isWww,
      protocol,
    };
  }

  return {
    rawHost,
    hostname,
    port,
    baseDomain: hostname,
    subdomain: null,
    isApex: true,
    isWww: false,
    protocol,
  };
}

/**
 * Extracts tenant slug from Host / x-forwarded-host header.
 * Strips port, lowercases, and ignores www.
 * Returns null for apex domains (bonaveeict.com.ng, www.bonaveeict.com.ng, localhost:3000).
 */
export function extractSubdomain(hostHeader?: string | null): string | null {
  const info = parseHostInfo(hostHeader);
  return info.subdomain;
}

/**
 * Returns true if a given slug is in the blocked reserved list.
 * Note: 'demo' is permitted if an active demo school exists in the database.
 */
export function isReservedSubdomain(slug: string): boolean {
  if (!slug) return true;
  const lower = slug.toLowerCase().trim();
  // Allow demo tenant if present
  if (lower === "demo") return false;
  return RESERVED_SUBDOMAINS.has(lower);
}

/**
 * Generates a clean URL slug from an institutional school name:
 * - lowercase
 * - remove accents / special characters
 * - spaces and punctuation -> '-'
 * - collapse consecutive hyphens
 * e.g. "Test Demo School" -> "test-demo-school"
 * e.g. "St. Peter's Academy (Enugu)" -> "st-peters-academy-enugu"
 */
export function generateSlugFromName(name: string): string {
  if (!name || typeof name !== "string") return "";

  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumeric except spaces and hyphens
    .trim()
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/-+/g, "-") // collapse duplicate hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

/**
 * Builds the canonical full tenant portal URL:
 * https://[slug].bonaveeict.com.ng/[path]
 * 
 * Note: Render only supports wildcard SSL on custom domains (*.bonaveeict.com.ng).
 * Subdomains on *.onrender.com do not exist in DNS, so onrender.com hostnames
 * must resolve to bonaveeict.com.ng in production.
 */
export function buildTenantUrl(
  slug: string,
  hostHeader?: string | null,
  path: string = "",
  protoHeader?: string | null
): string {
  const info = parseHostInfo(hostHeader, protoHeader);
  const cleanSlug = slug.toLowerCase().trim();
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "/";

  // Prevent slug duplication: if path starts with `/${cleanSlug}` or equals `/${cleanSlug}`
  let safePath = normalizedPath;
  if (safePath === `/${cleanSlug}` || safePath === `/${cleanSlug}/`) {
    safePath = "/";
  } else if (safePath.startsWith(`/${cleanSlug}/`)) {
    safePath = safePath.slice(`/${cleanSlug}`.length);
    if (!safePath.startsWith("/")) safePath = `/${safePath}`;
  }

  // 1. Local development environment
  if (info.baseDomain === "localhost" || info.hostname.includes("localhost") || info.hostname === "127.0.0.1") {
    const portSuffix = info.port ? `:${info.port}` : ":3000";
    return `http://${cleanSlug}.localhost${portSuffix}${safePath}`;
  }

  // 2. Production: Render service or custom domain
  let targetDomain = info.baseDomain;
  if (!targetDomain || targetDomain.includes("onrender.com")) {
    targetDomain = "bonaveeict.com.ng";
  }

  return `https://${cleanSlug}.${targetDomain}${safePath}`;
}

/**
 * Canonical helper for tenant login URLs: https://{subdomain}.bonaveeict.com.ng/login
 */
export function getTenantLoginUrl(slug: string, hostHeader?: string | null): string {
  return buildTenantUrl(slug, hostHeader, "/login");
}

/**
 * Canonical helper for tenant portal root URLs: https://{subdomain}.bonaveeict.com.ng/
 */
export function getTenantPortalUrl(slug: string, hostHeader?: string | null): string {
  return buildTenantUrl(slug, hostHeader, "/");
}

/**
 * Canonical helper for tenant dashboard URLs: https://{subdomain}.bonaveeict.com.ng/dashboard
 */
export function getTenantDashboardUrl(slug: string, hostHeader?: string | null): string {
  return buildTenantUrl(slug, hostHeader, "/dashboard");
}
