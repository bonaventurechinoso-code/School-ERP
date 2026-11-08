/**
 * Single Source of Truth for Tenant Suspension and Trial Expiry Logic
 */

export function isTenantSuspended(tenant: any): boolean {
  if (!tenant) return false;
  return (
    tenant.isSuspended === true ||
    tenant.isActive === false ||
    String(tenant.status || "").toUpperCase() === "SUSPENDED" ||
    String(tenant.subscriptionStatus || "").toUpperCase() === "SUSPENDED"
  );
}

export function isTrialExpired(tenant: any): boolean {
  if (!tenant) return false;
  const isTrial =
    tenant.isTrial === true ||
    String(tenant.status || "").toLowerCase() === "trial" ||
    String(tenant.subscriptionStatus || "").toUpperCase() === "TRIALING" ||
    String(tenant.subscriptionStatus || "").toUpperCase() === "FREE TRIAL";

  if (!isTrial) return false;

  const expiry = tenant.trialEndDate || tenant.trialEndsAt;
  if (!expiry) return false;

  return new Date(expiry).getTime() < Date.now();
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

