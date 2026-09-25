import dns from "dns";
import { basePrisma } from "@/lib/tenant-prisma";

/**
 * Platform supported base apex domains for multi-tenant SSL & Subdomain routing
 */
export const SUPPORTED_BASE_DOMAINS = [
  (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "bonaveeict.com.ng").toLowerCase().replace(/^www\./, "").trim(),
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
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: extractedSubdomain },
          { slug: extractedSubdomain },
        ],
      },
      select: {
        id: true,
        subdomain: true,
        slug: true,
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
 * Synchronous initial warm-up & verification hook called during registration.
 * Pings the reverse proxy / web server over HTTPS to trigger dynamic cert issuance
 * and waits up to maxTimeoutMs for the handshake to bind before returning to the onboarding flow.
 */
export async function warmAndVerifySSLHandshake(
  subdomain: string,
  rootDomain: string,
  proto: string = "https",
  maxTimeoutMs: number = 5000
): Promise<{ sslReady: boolean; targetFqdn: string; message: string }> {
  const isDev = process.env.NODE_ENV === "development";
  const targetFqdn = `${subdomain}.${rootDomain}`;

  // Local development bypass (no external TLS needed on localhost)
  if (isDev || rootDomain.includes("localhost")) {
    return { sslReady: true, targetFqdn, message: "Localhost development mode (TLS bypassed)." };
  }

  const pingUrl = `https://${targetFqdn}/api/tenants/status?subdomain=${subdomain}`;
  const startTime = Date.now();

  console.log(`[SSL_SYNC_INIT]: Triggering and awaiting reverse proxy SSL handshake for ${pingUrl}`);

  // Notify custom SSL webhook if configured
  if (process.env.SSL_PROVISION_WEBHOOK) {
    fetch(process.env.SSL_PROVISION_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: targetFqdn, subdomain }),
    }).catch(e => console.warn("[SSL_WEBHOOK_WARN]:", e.message));
  }

  // Attempt initial HTTPS connection with retries
  while (Date.now() - startTime < maxTimeoutMs) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(pingUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { "x-ssl-handshake-ping": "1" },
      });
      clearTimeout(timeoutId);

      if (res.ok || res.status === 200 || res.status === 307 || res.status === 308) {
        console.log(`[SSL_SYNC_SUCCESS]: Reverse proxy successfully bound SSL certificate for ${targetFqdn}`);
        return { sslReady: true, targetFqdn, message: `SSL certificate active on ${targetFqdn}` };
      }
    } catch (handshakeErr: any) {
      console.log(`[SSL_SYNC_WAITING]: Handshake pending for ${targetFqdn} (${handshakeErr?.code || handshakeErr?.message}). Retrying...`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`[SSL_SYNC_BUFFER]: Initial window ended for ${targetFqdn}. Transitioning to frontend polling verification.`);
  return { sslReady: false, targetFqdn, message: `SSL generation initiated for ${targetFqdn}` };
}

/**
 * Health check evaluator used during frontend onboarding propagation window.
 * Verifies tenant existence in DB and performs a live HTTPS ping check against the new subdomain.
 */
export async function checkSSLHealth(subdomain: string): Promise<{
  verified: boolean;
  subdomain: string;
  domain: string;
  isRegistered: boolean;
  dnsResolved: boolean;
  sslReady: boolean;
  directFallbackUrl: string;
  targetDashboardUrl: string;
  message: string;
}> {
  const isDev = process.env.NODE_ENV === "development";
  const rootDomain = SUPPORTED_BASE_DOMAINS[0] || "bonaveeict.com.ng";
  const targetFqdn = `${subdomain}.${rootDomain}`;
  const directFallback = `https://${rootDomain}/${subdomain}/dashboard`;
  const targetDashboard = `https://${targetFqdn}/dashboard`;

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
      targetDashboardUrl: targetDashboard,
      message: "Tenant is either not registered or inactive."
    };
  }

  // In local development, bypass external TLS
  if (isDev || rootDomain.includes("localhost")) {
    const baseDevUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
    return {
      verified: true,
      subdomain,
      domain: targetFqdn,
      isRegistered: true,
      dnsResolved: true,
      sslReady: true,
      directFallbackUrl: `${baseDevUrl}/${subdomain}/dashboard`,
      targetDashboardUrl: `${baseDevUrl}/${subdomain}/dashboard`,
      message: "Development environment: local SSL verified."
    };
  }

  // 2. Check DNS resolution for the internal subdomain
  let dnsResolved = false;
  try {
    const addresses = await dns.promises.resolve4(targetFqdn);
    dnsResolved = !!(addresses && addresses.length > 0);
  } catch {
    dnsResolved = false;
  }

  // 3. Perform quick internal ping check against the new subdomain over secure https://
  let sslReady = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const pingUrl = `https://${targetFqdn}/api/tenants/status?subdomain=${subdomain}`;

    const res = await fetch(pingUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { "x-ssl-health-check": "1" }
    });
    clearTimeout(timeoutId);

    // If HTTP status is 200 or redirect 307/308, the TLS handshake succeeded and certificate is bound!
    if (res.ok || res.status === 200 || res.status === 307 || res.status === 308) {
      sslReady = true;
    }
  } catch (err: any) {
    // Handshake in progress or unrecognized name alert
    sslReady = false;
  }

  return {
    verified: true,
    subdomain,
    domain: targetFqdn,
    isRegistered: true,
    dnsResolved,
    sslReady,
    directFallbackUrl: directFallback,
    targetDashboardUrl: targetDashboard,
    message: sslReady
      ? "SSL certificate verified and bound to subdomain."
      : "Awaiting reverse proxy SSL handshake completion."
  };
}


