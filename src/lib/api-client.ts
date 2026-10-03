"use client";

/**
 * Frontend API Client & Request Interceptor for SchoolERP
 * 
 * Ensures requests to authenticated endpoints (particularly /api/v1/auth/session)
 * do not eagerly fire before the freshly generated token is completely available
 * in headers, cookies, or browser storage.
 */

export const STORAGE_SESSION_KEY = "schoolerp_session";
export const STORAGE_TOKEN_KEY = "schoolerp_auth_token";
export const AUTH_UPDATE_EVENT = "auth-session-update";

// In-memory token cache for fast access
let activeAuthToken: string | null = null;
let isTokenReadyPromise: Promise<string | null> | null = null;
let resolveTokenReady: ((token: string | null) => void) | null = null;

/**
 * Dynamically resolves the active production multi-tenant API base URL.
 * Prioritizes configured environment strings, live production hosts,
 * or persistent local storage configuration over static local fallbacks.
 */
export function getProductionBaseUrl(): string {
  if (typeof window !== "undefined") {
    // 1. If running in a browser context matching production platform or Render
    const origin = window.location.origin;
    if (origin.includes("bonaveeict.com.ng") || origin.includes("onrender.com")) {
      return origin.replace(/\/$/, "");
    }

    // 2. Check if persistent PWA configuration has established a live production URL
    const storedBase = window.localStorage.getItem("schoolerp_api_base_url");
    if (storedBase && storedBase.startsWith("http")) {
      return storedBase.replace(/\/$/, "");
    }
  }

  // 3. Fallback to production environment strings or production apex
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl.replace(/\/$/, "");
  }

  return "https://bonaveeict.com.ng";
}

/**
 * Resolves any API route path against the live production base URL
 * when running inside the PWA container or external wrappers.
 */
export function resolveApiUrl(input: RequestInfo | URL): string {
  const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  // If already an absolute URL with protocol, preserve it
  if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
    return urlStr;
  }

  // If executing in standard production browser on apex/subdomain, relative URLs naturally route to origin
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();
    const isProdHost = hostname.includes("bonaveeict.com.ng") || hostname.includes("onrender.com");
    if (isProdHost) {
      return urlStr;
    }
  }

  // Bind to live production base URL for PWA/PWP container environments
  const baseUrl = getProductionBaseUrl();
  const normalizedPath = urlStr.startsWith("/") ? urlStr : `/${urlStr}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Sets the active authentication token in memory and storage,
 * signaling to waiting interceptors that the freshly generated token is ready.
 */
export function setAuthToken(token: string | null, sessionTokenId?: string | null): void {
  activeAuthToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
      window.localStorage.setItem(STORAGE_TOKEN_KEY, token);
      if (sessionTokenId) {
        window.sessionStorage.setItem("schoolerp_session_token_id", sessionTokenId);
        window.localStorage.setItem("schoolerp_session_token_id", sessionTokenId);
      }
    } else {
      window.sessionStorage.removeItem(STORAGE_TOKEN_KEY);
      window.localStorage.removeItem(STORAGE_TOKEN_KEY);
      window.sessionStorage.removeItem("schoolerp_session_token_id");
      window.localStorage.removeItem("schoolerp_session_token_id");
    }
  }

  if (resolveTokenReady) {
    resolveTokenReady(token);
    isTokenReadyPromise = null;
    resolveTokenReady = null;
  }
}

/**
 * Gets the active auth token from memory or browser storage
 */
export function getAuthToken(): string | null {
  if (activeAuthToken) return activeAuthToken;
  if (typeof window !== "undefined") {
    const stored =
      window.sessionStorage.getItem(STORAGE_TOKEN_KEY) ||
      window.localStorage.getItem(STORAGE_TOKEN_KEY);
    if (stored) {
      activeAuthToken = stored;
      return stored;
    }
    // Check if embedded in persisted session object
    try {
      const sessionRaw =
        window.sessionStorage.getItem(STORAGE_SESSION_KEY) ||
        window.localStorage.getItem(STORAGE_SESSION_KEY);
      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw);
        const t = parsed?.token || parsed?.sessionToken;
        if (t) {
          activeAuthToken = t;
          return t;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Prepares a readiness gate when a login or token generation cycle is in progress,
 * preventing eager API requests from firing before the token is committed.
 */
export function beginTokenWait(): void {
  if (!isTokenReadyPromise) {
    isTokenReadyPromise = new Promise((resolve) => {
      resolveTokenReady = resolve;
      // Safety timeout after 3.5 seconds to prevent indefinite blocking
      setTimeout(() => {
        if (resolveTokenReady) {
          resolveTokenReady(getAuthToken());
          isTokenReadyPromise = null;
          resolveTokenReady = null;
        }
      }, 3500);
    });
  }
}

// In-flight request deduplication map for GET requests
const inFlightRequests = new Map<string, Promise<Response>>();

/**
 * Custom Fetch Helper with Request Interceptor:
 * - Dynamically binds production base URL for PWA/PWP container environments
 * - Awaits token readiness if a token generation cycle is in progress
 * - Automatically injects Authorization, x-session-token, and multi-tenant context headers
 * - Deduplicates concurrent GET requests to avoid rapid polling loops
 */
export async function customFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const resolvedTarget = resolveApiUrl(rawUrl);
  const method = (init?.method || "GET").toUpperCase();

  // If waiting for freshly generated token, await readiness before firing session queries
  if (isTokenReadyPromise && rawUrl.includes("/api/v1/auth/session")) {
    await isTokenReadyPromise;
  }

  // Deduplicate identical in-flight GET requests
  const isDeduplicatable = method === "GET";
  if (isDeduplicatable && inFlightRequests.has(resolvedTarget)) {
    const activePromise = inFlightRequests.get(resolvedTarget)!;
    return activePromise.then((res) => res.clone());
  }

  // Build headers with request interceptor
  const headers = new Headers(init?.headers);
  const token = getAuthToken();

  if (token) {
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.has("x-session-token")) {
      headers.set("x-session-token", token);
    }
  }

  // Synchronize multi-tenant context headers from persistent storage
  if (typeof window !== "undefined") {
    const storedTenant =
      window.localStorage.getItem("schoolerp_tenant") ||
      window.localStorage.getItem("schoolDomain") ||
      window.localStorage.getItem("tenantId") ||
      window.localStorage.getItem("schoolId");

    if (storedTenant) {
      if (!headers.has("x-tenant-slug")) {
        headers.set("x-tenant-slug", storedTenant);
      }
      if (!headers.has("x-tenant-id")) {
        headers.set("x-tenant-id", storedTenant);
      }
    }
  }

  // Ensure no-cache headers for session and authentication verification
  if (rawUrl.includes("/api/v1/auth/session") || rawUrl.includes("/api/auth/session")) {
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
  }

  const fetchPromise = fetch(resolvedTarget, {
    ...init,
    headers,
    credentials: init?.credentials || "include",
  }).finally(() => {
    if (isDeduplicatable) {
      inFlightRequests.delete(resolvedTarget);
    }
  });

  if (isDeduplicatable) {
    inFlightRequests.set(resolvedTarget, fetchPromise);
  }

  return fetchPromise;
}

export const apiClient = {
  get: (url: string, init?: RequestInit) => customFetch(url, { ...init, method: "GET" }),
  post: (url: string, body?: any, init?: RequestInit) =>
    customFetch(url, {
      ...init,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),
  put: (url: string, body?: any, init?: RequestInit) =>
    customFetch(url, {
      ...init,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),
  delete: (url: string, init?: RequestInit) => customFetch(url, { ...init, method: "DELETE" }),
};
