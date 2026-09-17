"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTenant } from "@/lib/tenant-context";
import {
  resolveTierType,
  getTierConfig,
  TIER_CONFIG_MATRIX,
  filterClassesForTier,
  getClassesForTier,
  filterStudentsForTier,
  filterInvoicesForTier,
  filterFeeTemplatesForTier,
  AcademicTierType,
  TierConfig,
} from "@/lib/tier-config";

/**
 * Hook to dynamically resolve the active tier and isolation configuration
 * directly in client components based on URL query params and global tenant context.
 */
export function useClientTier(customTierIdentifier?: string | null) {
  const searchParams = useSearchParams();
  const tenant = useTenant();

  const activeTierParam = searchParams?.get("tier");
  const tenantTier = tenant?.preciseTier || tenant?.institutionType;

  const resolvedType = useMemo(() => {
    return resolveTierType(customTierIdentifier || activeTierParam || tenantTier);
  }, [customTierIdentifier, activeTierParam, tenantTier]);

  const tierConfig = useMemo(() => {
    return TIER_CONFIG_MATRIX[resolvedType];
  }, [resolvedType]);

  return {
    activeTier: resolvedType,
    tierConfig,
    isDaycare: resolvedType === "DAYCARE_NURSERY",
    isPrimary: resolvedType === "PRIMARY",
    isSecondary: resolvedType === "SECONDARY",
    isTertiary: resolvedType === "TERTIARY",
    filterClasses: (classes: string[]) => filterClassesForTier(classes, resolvedType),
    getClasses: (custom?: string[]) => getClassesForTier(resolvedType, custom),
    filterStudents: <T extends { currentClass?: string | null; tierId?: string | null; tier?: { name?: string; id?: string } | null }>(
      students: T[],
      activeTierId?: string
    ) => filterStudentsForTier(students, resolvedType, activeTierId),
    filterInvoices: <T extends { student?: { currentClass?: string | null; tierId?: string | null; tier?: { name?: string; id?: string } | null } | null }>(
      invoices: T[],
      activeTierId?: string
    ) => filterInvoicesForTier(invoices, resolvedType, activeTierId),
    filterFeeTemplates: <T extends { name: string; billingType?: string | null }>(templates: T[]) =>
      filterFeeTemplatesForTier(templates, resolvedType),
  };
}

// Export alias for seamless compatibility
export const useActiveTierConfig = useClientTier;
