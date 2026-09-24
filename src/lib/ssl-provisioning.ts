import dns from "dns";
import { basePrisma } from "@/lib/tenant-prisma";

/**
 * Platform supported base apex domains for multi-tenant SSL & Subdomain routing
 */
export const SUPPORTED_BASE_DOMAINS = [
  (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "bonaveeict.com.ng").toLowerCase().replace(/^www\./, "").trim(),
  "schoolerp.com",
  "bonaveeict.com.ng",
].filter((v, i, a) => a.indexOf(v) === i && Boolean(v));

export interface SSLVerificationResult {
  allowed: boolean;
  domain: string;
  subdomain?: string;
  reason: string;
  isApex?: boolean;
}

/**
 * Evaluates whether a domain should be issued an SSL certificate.
 * Used by Caddy On-Demand TLS ("ask" endpoint) and reverse proxy certificate managers.
 * Prevents SSL certificate exhaustion attacks by ensuring only registered active tenants
 * or platform apex domains receive dynamic certificates.
 */
export async function verifyTenantDomainForSSL(hostname: string): Promise<SSLVerificationResult> {
  const cleanHost = (hostname || "").toLowerCase().trim().split(":")[0];

  if (!cleanHost) {
    return { allowed: false, domain: cleanHost, reason: "Host parameter is missing" };
  }

  // 1. Check if host is a platform apex domain or www variant
  for (const baseDomain of SUPPORTED_BASE_DOMAINS) {
    if (cleanHost === baseDomain || cleanHost === `www.${baseDomain}`) {
      return {
        allowed: true,
        domain: cleanHost,
        reason: "Platform Apex Domain",
        isApex: true,
      };
    }
  }

  // 2. Extract potential tenant subdomain
  let extractedSubdomain = "";
  for (const baseDomain of SUPPORTED_BASE_DOMAINS) {
    if (cleanHost.endsWith(`.${baseDomain}`)) {
      extractedSubdomain = cleanHost.slice(0, -(baseDomain.length + 1)).toLowerCase();
      break;
    }
  }

  // Fallback for custom 3-level domain
  if (!extractedSubdomain) {
    const parts = cleanHost.split(".");
    if (parts.length >= 3) {
      extractedSubdomain = parts[0];
    }
  }

  if (!extractedSubdomain) {
    return {
      allowed: false,
      domain: cleanHost,
      reason: "Domain does not match platform tenant structure",
    };
  }

  // Disallow reserved system names
  const reserved = ["admin", "super-admin", "api", "app", "mail", "ftp", "ns1", "ns2", "cpanel"];
  if (reserved.includes(extractedSubdomain)) {
    return {
      allowed: false,
      domain: cleanHost,
      subdomain: extractedSubdomain,
      reason: "Reserved subdomain",
    };
  }

  try {
    // 3. Query database to verify tenant existence and active status
    const school = await basePrisma.school.findUnique({
      where: { subdomain: extractedSubdomain },
      select: {
        id: true,
        subdomain: true,
        isActive: true,
        isBanned: true,
      },
    });

    if (!school) {
      return {
        allowed: false,
        domain: cleanHost,
        subdomain: extractedSubdomain,
        reason: "Tenant not registered in database",
      };
    }

    if (school.isBanned || !school.isActive) {
      return {
        allowed: false,
        domain: cleanHost,
        subdomain: extractedSubdomain,
        reason: "Tenant account is suspended or inactive",
      };
    }

    return {
      allowed: true,
      domain: cleanHost,
      subdomain: extractedSubdomain,
      reason: "Valid active tenant",
    };
  } catch (dbErr: any) {
    console.error("[SSL_VERIFICATION_DB_ERROR]:", dbErr);
    // In event of transient DB failure, disallow dynamically to prevent error loops
    return {
      allowed: false,
      domain: cleanHost,
      subdomain: extractedSubdomain,
      reason: `Verification error: ${dbErr?.message || "DB connection error"}`,
    };
  }
}

/**
 * Non-blocking, automated SSL and DNS verification hook triggered when a new tenant registers.
 * Resolves wildcard DNS status and warms/triggers SSL certificate generation.
 */
export async function triggerSSLProvisioning(subdomain: string): Promise<{
  success: boolean;
  subdomain: string;
  dnsResolved: boolean;
  resolvedIp?: string;
  sslWarmStatus?: string;
  message: string;
}> {
  const rootDomain = SUPPORTED_BASE_DOMAINS[0] || "bonaveeict.com.ng";
  const targetFqdn = `${subdomain}.${rootDomain}`;

  console.log(`[SSL_PROVISIONING_INIT]: Initiating automated provisioning for ${targetFqdn}`);

  let dnsResolved = false;
  let resolvedIp = "";

  // 1. Check DNS resolution for the newly registered subdomain
  try {
    const addresses = await dns.promises.resolve4(targetFqdn);
    if (addresses && addresses.length > 0) {
      dnsResolved = true;
      resolvedIp = addresses[0];
      console.log(`[SSL_PROVISIONING_DNS]: Verified Wildcard A-Record for ${targetFqdn} -> ${resolvedIp}`);
    }
  } catch (dnsErr: any) {
    // If specific subdomain isn't explicitly cached, check wildcard apex
    try {
      const wildcardCheck = `wildcard-test-${Date.now()}.${rootDomain}`;
      const wcAddresses = await dns.promises.resolve4(wildcardCheck);
      if (wcAddresses && wcAddresses.length > 0) {
        dnsResolved = true;
        resolvedIp = wcAddresses[0];
        console.log(`[SSL_PROVISIONING_DNS]: Wildcard DNS active for *.${rootDomain} -> ${resolvedIp}`);
      }
    } catch {
      console.warn(`[SSL_PROVISIONING_DNS_WARN]: Wildcard DNS not immediately resolving for ${targetFqdn}. Reliance on path routing fallback active.`);
    }
  }

  // 2. Pre-warm TLS / Notify Reverse Proxy (Caddy / Render / Certbot hook)
  let sslWarmStatus = "INITIATED";
  try {
    // If a custom SSL provision webhook is configured (e.g., Caddy admin or internal proxy daemon)
    const proxyWebhook = process.env.SSL_PROVISION_WEBHOOK;
    if (proxyWebhook) {
      fetch(proxyWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: targetFqdn, subdomain }),
      }).catch(e => console.warn("[SSL_WEBHOOK_WARN]:", e.message));
    }

    // Pre-flight non-blocking handshake attempt to trigger On-Demand TLS
    if (dnsResolved) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      fetch(`https://${targetFqdn}/api/tenants/status?subdomain=${subdomain}`, {
        method: "GET",
        signal: controller.signal,
      })
        .then(() => {
          clearTimeout(timeoutId);
          console.log(`[SSL_PROVISIONING_WARMED]: Handshake completed for ${targetFqdn}`);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          // Handshake trigger executed (reverse proxy intercepts SNI to initiate cert issuance)
        });
    }
  } catch (err: any) {
    sslWarmStatus = "FAILED_TRIGGER";
    console.warn(`[SSL_PROVISIONING_TRIGGER_WARN]: ${err?.message}`);
  }

  return {
    success: true,
    subdomain,
    dnsResolved,
    resolvedIp,
    sslWarmStatus,
    message: `Automated SSL provisioning cycle completed for ${targetFqdn}`,
  };
}

/**
 * Health check evaluator used during frontend onboarding propagation window.
 * Verifies tenant existence in DB and checks whether the subdomain's SSL handshake has completed.
 */
export async function checkSSLHealth(subdomain: string): Promise<{
  verified: boolean;
  subdomain: string;
  domain: string;
  isRegistered: boolean;
  dnsResolved: boolean;
  sslReady: boolean;
  directFallbackUrl: string;
  message: string;
}> {
  const rootDomain = SUPPORTED_BASE_DOMAINS[0] || "bonaveeict.com.ng";
  const targetFqdn = `${subdomain}.${rootDomain}`;
  const directFallback = `https://${rootDomain}/${subdomain}`;

  // 1. Verify tenant in database
  const school = await basePrisma.school.findUnique({
    where: { subdomain },
    select: { id: true, subdomain: true, isActive: true, isBanned: true }
  });

  if (!school || school.isBanned || !school.isActive) {
    return {
      verified: false,
      subdomain,
      domain: targetFqdn,
      isRegistered: !!school,
      dnsResolved: false,
      sslReady: false,
      directFallbackUrl: directFallback,
      message: "Tenant is either not registered or inactive."
    };
  }

  // 2. Check DNS / Handshake status
  let dnsResolved = false;
  try {
    const addresses = await dns.promises.resolve4(targetFqdn);
    dnsResolved = !!(addresses && addresses.length > 0);
  } catch {
    dnsResolved = false;
  }

  // 3. Test TLS handshake
  let sslReady = false;
  if (dnsResolved) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`https://${targetFqdn}/api/tenants/status?subdomain=${subdomain}`, {
        method: "HEAD",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      sslReady = res.ok || res.status < 500;
    } catch {
      sslReady = false;
    }
  }

  return {
    verified: true,
    subdomain,
    domain: targetFqdn,
    isRegistered: true,
    dnsResolved,
    sslReady,
    directFallbackUrl: directFallback,
    message: sslReady ? "SSL certificate is active and bound to hostname." : "SSL propagation or TLS handshake in progress."
  };
}

