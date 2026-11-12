"use client";

import { signOut } from "next-auth/react";

export interface TenantLogoutOptions {
  schoolDomain?: string;
  redirectUrl?: string;
}

const AUTH_COOKIE_NAMES = [
  "session",
  "accessToken",
  "refreshToken",
  "auth_token",
  "guest_session",
  "applicant_token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "activeTier",
  "auth_guard_status",
  "schoolerp_tenant",
];

/**
 * Universal client-side logout utility that completely invalidates:
 * 1. The database session and refresh token records via server logout endpoints.
 * 2. NextAuth session token via signOut({ redirect: false }).
 * 3. All client-side storage (localStorage, sessionStorage).
 * 4. Auth cookies across accessible document.cookie paths.
 * 5. Full hard navigation to the tenant's login screen (/schoolDomain/login?logout=1&loggedOut=true).
 */
export async function performTenantLogout(
  options: string | TenantLogoutOptions = "",
): Promise<void> {
  const schoolDomain =
    typeof options === "string" ? options : options.schoolDomain;
  let targetUrl =
    typeof options === "object" && options.redirectUrl
      ? options.redirectUrl
      : "";

  if (!targetUrl) {
    if (schoolDomain && schoolDomain !== "admin" && schoolDomain !== "root") {
      targetUrl = `/${schoolDomain.toLowerCase().trim()}/login?logout=1&loggedOut=true`;
    } else {
      targetUrl = `/login?logout=1&loggedOut=true`;
    }
  }

  // 1. Clear accessible cookies from document.cookie
  try {
    if (typeof document !== "undefined") {
      for (const name of AUTH_COOKIE_NAMES) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;`;
      }
    }
  } catch {}

  // 2. Clear client storage
  try {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
  } catch {}

  // 3. Invalidate on server via both logout endpoints
  try {
    await Promise.allSettled([
      fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      }),
      fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      }),
    ]);
  } catch {}

  // 4. Invalidate NextAuth session state
  try {
    await signOut({ redirect: false });
  } catch {}

  // 5. Hard replace navigation to prevent back-button resurrecting cached state
  if (typeof window !== "undefined") {
    window.location.replace(targetUrl);
  }
}
