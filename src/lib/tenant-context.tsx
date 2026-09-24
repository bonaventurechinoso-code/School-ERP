"use client";

import React, { createContext, useContext, ReactNode } from "react";

// ------------------------------------------------------
// 1. TENANT DATA TYPES
// ------------------------------------------------------

export interface TenantData {
  id: string;          // The actual database ID (schoolId) for queries
  name: string;        // Display name of the School (e.g., "Green Valley High")
  subdomain: string;   // The unique subdomain identifier
  institutionType: "K12" | "HIGHER_ED";
  preciseTier: "PRIMARY" | "SECONDARY" | "PRIMARY_SECONDARY" | "NURSERY" | "UNIVERSITY" | "POLYTECHNIC" | "COLLEGE_OF_EDUCATION" | string;
  branding: {
    primaryColor: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
  subscriptionPlan?: string;
  subscriptionStatus?: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" | string;
  subscriptionExpiresAt?: Date | string | null;
  userRole?: string;
  session?: any;
  permissions?: string[];
  activeTiers?: string[];
  isMultiDbEnabled?: boolean;
  tierDatabases?: Array<{ tierName: string; databaseName: string; databaseUrl: string }>;
  platformBank?: {
    bankName: string;
    accountNumber: string;
  };
}


// ------------------------------------------------------
// 2. URL EXTRACTION UTILITY
// ------------------------------------------------------

/**
 * Extracts the active school's subdomain from a raw host string.
 * This is an isomorphic function that can be used safely in Middleware,
 * Server Components (via next/headers), or Client Components.
 * 
 * @param host The request host (e.g., "greenvalley.bonaveeict.com.ng")
 * @returns The extracted subdomain or null
 */
export function extractSubdomainFromHost(host: string | null): string | null {
  if (!host) return null;
  
  // Fallback for local development
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return "greenvalley"; // Hardcoded default tenant for dev testing
  }
  
  const parts = host.split(".");
  
  // Assumes a structure like "subdomain.domain.com"
  if (parts.length >= 3) {
    return parts[0];
  }
  
  return null;
}

// ------------------------------------------------------
// 3. REACT CONTEXT & PROVIDER
// ------------------------------------------------------

const TenantContext = createContext<TenantData | undefined>(undefined);

interface TenantProviderProps {
  children: ReactNode;
  tenant: TenantData;
}

export function TenantProvider({ children, tenant }: TenantProviderProps) {
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}

// ------------------------------------------------------
// 4. CUSTOM HOOK
// ------------------------------------------------------

/**
 * Global hook to access the active school's context across the ERP.
 * Must be used within a component wrapped by <TenantProvider>.
 */
export function useTenant() {
  const context = useContext(TenantContext);
  
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider wrapper.");
  }
  
  return context;
}
