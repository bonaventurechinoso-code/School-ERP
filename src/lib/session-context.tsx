"use client";

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback, useMemo } from "react";
import { SessionPayload, UserRole } from "./auth";
import { isFinanceRole, isAcademicRole, isAdminExecutive, isSuperAdmin as checkSuperAdmin, getDevMockRoleConfig } from "./permissions";

export const STORAGE_SESSION_KEY = "schoolerp_session";
export const STORAGE_TOKEN_KEY = "schoolerp_auth_token";
export const AUTH_UPDATE_EVENT = "auth-session-update";

export interface SessionContextType {
  session: SessionPayload | null;
  role: string;
  staffRole?: string;
  isSuperAdmin: boolean;
  isSchoolAdmin: boolean;
  isAuthorizedAdmin: boolean;
  isFinance: boolean;
  isAcademic: boolean;
  isStaff: boolean;
  isStudent: boolean;
  isWalletAuthorized: boolean;
  permissions: string[];
  activeTiers: string[];
  loading: boolean;
  status: "loading" | "authenticated" | "unauthenticated";
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType>({
  session: null,
  role: "",
  staffRole: undefined,
  isSuperAdmin: false,
  isSchoolAdmin: false,
  isAuthorizedAdmin: false,
  isFinance: false,
  isAcademic: false,
  isStaff: false,
  isStudent: false,
  isWalletAuthorized: false,
  permissions: [],
  activeTiers: [],
  loading: true,
  status: "loading",
  refreshSession: async () => {},
});

/**
 * Safely extracts stored session data from browser storage (sessionStorage / localStorage)
 */
export function getStoredSession(): SessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const rawSession = window.sessionStorage.getItem(STORAGE_SESSION_KEY) || window.localStorage.getItem(STORAGE_SESSION_KEY);
    if (!rawSession) return null;
    const parsed = JSON.parse(rawSession);
    if (parsed && typeof parsed === "object" && (parsed.role || parsed.userId)) {
      return parsed as SessionPayload;
    }
  } catch (err) {
    console.warn("[SessionContext] Failed to parse stored session:", err);
  }
  return null;
}

/**
 * Stores session payload into both sessionStorage and localStorage
 */
export function persistStoredSession(sessionPayload: SessionPayload | null): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionPayload) {
      const serialized = JSON.stringify(sessionPayload);
      window.sessionStorage.setItem(STORAGE_SESSION_KEY, serialized);
      window.localStorage.setItem(STORAGE_SESSION_KEY, serialized);
    } else {
      window.sessionStorage.removeItem(STORAGE_SESSION_KEY);
      window.localStorage.removeItem(STORAGE_SESSION_KEY);
      window.localStorage.removeItem(STORAGE_TOKEN_KEY);
    }
  } catch (err) {
    console.warn("[SessionContext] Failed to persist session to storage:", err);
  }
}

export function SessionProvider({
  session: initialSession,
  children,
}: {
  session: SessionPayload | null;
  children: ReactNode;
}) {
  const isDev = process.env.NODE_ENV === "development";
  const devMockRoleSetting = isDev ? process.env.NEXT_PUBLIC_DEV_MOCK_ROLE : null;
  const mockConfig = isDev && devMockRoleSetting && !initialSession ? getDevMockRoleConfig(devMockRoleSetting) : null;

  // 1. Reactive State
  const [session, setSession] = useState<SessionPayload | null>(initialSession);
  const [loading, setLoading] = useState<boolean>(() => {
    if (initialSession || mockConfig) return false;
    return true;
  });

  // Sync state if server prop changes
  useEffect(() => {
    if (initialSession) {
      setSession(initialSession);
      setLoading(false);
      persistStoredSession(initialSession);
    }
  }, [initialSession]);

  // 2. Imperative Session Refresh
  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/session", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.session) {
          setSession(data.session);
          persistStoredSession(data.session);
          setLoading(false);
          return;
        }
      }

      // If API indicates unauthenticated, verify if storage has a valid session before clearing
      const stored = getStoredSession();
      if (stored) {
        setSession(stored);
        setLoading(false);
      } else {
        setSession(null);
        setLoading(false);
      }
    } catch (error) {
      console.warn("[SessionContext] Background session check failed:", error);
      const stored = getStoredSession();
      if (stored) {
        setSession(stored);
      }
      setLoading(false);
    }
  }, []);

  // 3. Client Hydration & Storage Event Synchronization
  useEffect(() => {
    // Immediate hydration from browser storage if server prop was not present
    if (!session && !mockConfig) {
      const stored = getStoredSession();
      if (stored) {
        setSession(stored);
        setLoading(false);
      }
    }

    // Background validation
    refreshSession();

    // Event listener for in-app login/logout dispatches
    const handleAuthEvent = () => {
      const stored = getStoredSession();
      if (stored) {
        setSession(stored);
        setLoading(false);
      }
      refreshSession();
    };

    // Cross-tab storage synchronization
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_SESSION_KEY) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            setSession(parsed);
            setLoading(false);
          } catch {}
        } else {
          setSession(null);
          setLoading(false);
        }
      }
    };

    window.addEventListener(AUTH_UPDATE_EVENT, handleAuthEvent);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener(AUTH_UPDATE_EVENT, handleAuthEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [session, mockConfig, refreshSession]);

  // 4. Role & Permission Calculations
  const role = useMemo(() => {
    return (mockConfig?.role || session?.role || "").trim().toUpperCase();
  }, [mockConfig?.role, session?.role]);

  const staffRole = useMemo(() => {
    return mockConfig?.staffRole || session?.staffRole;
  }, [mockConfig?.staffRole, session?.staffRole]);

  const isSuperAdmin = useMemo(() => checkSuperAdmin(role, staffRole), [role, staffRole]);
  const isAuthorizedAdmin = useMemo(() => isAdminExecutive(role, staffRole), [role, staffRole]);
  const isSchoolAdmin = useMemo(() => isAuthorizedAdmin && !isSuperAdmin, [isAuthorizedAdmin, isSuperAdmin]);
  const isFinance = useMemo(() => isFinanceRole(role, staffRole), [role, staffRole]);
  const isAcademic = useMemo(() => isAcademicRole(role, staffRole), [role, staffRole]);
  const isStudent = useMemo(() => role === "STUDENT", [role]);
  const isStaff = useMemo(() => !isStudent && !isSuperAdmin, [isStudent, isSuperAdmin]);
  const isWalletAuthorized = useMemo(() => isAuthorizedAdmin, [isAuthorizedAdmin]);

  const status: "loading" | "authenticated" | "unauthenticated" = useMemo(() => {
    if (loading && !session && !mockConfig) return "loading";
    if (session || mockConfig || role) return "authenticated";
    return "unauthenticated";
  }, [loading, session, mockConfig, role]);

  const contextValue = useMemo(
    () => ({
      session,
      role,
      staffRole,
      isSuperAdmin,
      isSchoolAdmin,
      isAuthorizedAdmin,
      isFinance,
      isAcademic,
      isStaff,
      isStudent,
      isWalletAuthorized,
      permissions: session?.permissions || [],
      activeTiers: session?.activeTiers || [],
      loading,
      status,
      refreshSession,
    }),
    [
      session,
      role,
      staffRole,
      isSuperAdmin,
      isSchoolAdmin,
      isAuthorizedAdmin,
      isFinance,
      isAcademic,
      isStaff,
      isStudent,
      isWalletAuthorized,
      loading,
      status,
      refreshSession,
    ]
  );

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
