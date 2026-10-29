/**
 * Single Source of Truth for Tenant Suspension Logic
 */

export function isTenantSuspended(tenant: any): boolean {
  if (!tenant) return false;
  return (
    tenant.isSuspended === true ||
    String(tenant.status || "").toUpperCase() === "SUSPENDED" ||
    String(tenant.subscriptionStatus || "").toUpperCase() === "SUSPENDED"
  );
}

export function getTenantExpiry(tenant: any): Date {
  if (!tenant) {
    return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }
  const expiry =
    tenant.subscriptionExpiresAt ||
    tenant.trialEndDate ||
    tenant.trialEndsAt;

  if (expiry) {
    return new Date(expiry);
  }

  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
}

