"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { SessionPayload, UserRole } from "./auth";
import { isFinanceRole, isAcademicRole, isAdminExecutive, isSuperAdmin as checkSuperAdmin, getDevMockRoleConfig } from "./permissions";

interface SessionContextType {
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
});

export function SessionProvider({
  session,
  children,
}: {
  session: SessionPayload | null;
  children: ReactNode;
}) {
  const isDev = process.env.NODE_ENV === "development";
  const devMockRoleSetting = isDev ? process.env.NEXT_PUBLIC_DEV_MOCK_ROLE : null;
  const mockConfig = isDev && devMockRoleSetting && !session ? getDevMockRoleConfig(devMockRoleSetting) : null;

  const role = (mockConfig?.role || session?.role || "").trim().toUpperCase();
  const staffRole = mockConfig?.staffRole || session?.staffRole;
  const isSuperAdmin = checkSuperAdmin(role, staffRole);
  const isAuthorizedAdmin = isAdminExecutive(role, staffRole);
  const isSchoolAdmin = isAuthorizedAdmin && !isSuperAdmin;
  const isFinance = isFinanceRole(role, staffRole);
  const isAcademic = isAcademicRole(role, staffRole);
  const isStudent = role === "STUDENT";
  const isStaff = !isStudent && !isSuperAdmin;
  // Strict evaluation: only SUPER_ADMIN or SCHOOL_ADMIN / Top Executive are allowed to view/top up wallet balance
  const isWalletAuthorized = isAuthorizedAdmin;

  return (
    <SessionContext.Provider
      value={{
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
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
