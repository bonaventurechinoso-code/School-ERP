"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { SessionPayload, UserRole } from "./auth";

interface SessionContextType {
  session: SessionPayload | null;
  role: string;
  isSuperAdmin: boolean;
  isSchoolAdmin: boolean;
  isAuthorizedAdmin: boolean;
  isStaff: boolean;
  isStudent: boolean;
  isWalletAuthorized: boolean;
  permissions: string[];
  activeTiers: string[];
}

const SessionContext = createContext<SessionContextType>({
  session: null,
  role: "",
  isSuperAdmin: false,
  isSchoolAdmin: false,
  isAuthorizedAdmin: false,
  isStaff: false,
  isStudent: false,
  isWalletAuthorized: false,
  permissions: [],
  activeTiers: [],
});

export function SessionProvider({
  session,
  children,
}: {
  session: SessionPayload | null;
  children: ReactNode;
}) {
  const role = (session?.role || "").trim().toUpperCase();
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isSchoolAdmin = role === "SCHOOL_ADMIN" || role === "ADMIN";
  const isAuthorizedAdmin = isSuperAdmin || isSchoolAdmin;
  const isStaff = role === "STAFF" || role === "TEACHER" || role === "BURSAR";
  const isStudent = role === "STUDENT";
  // Strict evaluation: only SUPER_ADMIN or SCHOOL_ADMIN are allowed to view/top up wallet balance
  const isWalletAuthorized = role === "SUPER_ADMIN" || role === "SCHOOL_ADMIN";

  return (
    <SessionContext.Provider
      value={{
        session,
        role,
        isSuperAdmin,
        isSchoolAdmin,
        isAuthorizedAdmin,
        isStaff,
        isStudent,
        isWalletAuthorized,
        permissions: session?.permissions || [],
        activeTiers: session?.activeTiers || [],
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
