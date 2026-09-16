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
 * - Awaits token readiness if a token generation cycle is in progress
 * - Automatically injects Authorization & x-session-token headers
 * - Deduplicates concurrent GET requests to avoid rapid polling loops
 */
export async function customFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method || "GET").toUpperCase();

  // Guard: Do not execute /api/v1/auth/session on unauthenticated layouts when no token exists
  if (url.includes("/api/v1/auth/session") && typeof window !== "undefined") {
    const path = window.location.pathname.toLowerCase();
    const isUnauthRoute =
      path.includes("/login") ||
      path.includes("/register") ||
      path.includes("/apply") ||
      path.includes("/access-denied") ||
      path.includes("/trial-expired");
    if (isUnauthRoute && !getAuthToken()) {
      return new Response(
        JSON.stringify({ success: false, authenticated: false, session: null }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // If waiting for freshly generated token, await readiness before firing session queries
  if (isTokenReadyPromise && url.includes("/api/v1/auth/session")) {
    await isTokenReadyPromise;
  }

  // Deduplicate identical in-flight GET requests
  const isDeduplicatable = method === "GET";
  if (isDeduplicatable && inFlightRequests.has(url)) {
    const activePromise = inFlightRequests.get(url)!;
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

  // Ensure no-cache headers for session verification
  if (url.includes("/api/v1/auth/session")) {
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
  }

  const fetchPromise = fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials || "include",
  }).finally(() => {
    if (isDeduplicatable) {
      inFlightRequests.delete(url);
    }
  });

  if (isDeduplicatable) {
    inFlightRequests.set(url, fetchPromise);
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
};
