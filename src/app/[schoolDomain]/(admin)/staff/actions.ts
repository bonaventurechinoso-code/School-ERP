"use server";

import { getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { cacheAside, buildCacheKey } from "@/lib/cache";
import { executeCursorPagination, CursorPaginationResult } from "@/lib/pagination";
import { invalidateStaffNamespace } from "@/lib/cache-invalidation";

/**
 * High-performance cursor-based fetching for Staff Directory wrapped in Smart Cache-Aside.
 * Flat lookup times across millions of staff/teacher records.
 */
export async function fetchStaffPaginated(
  schoolId: string,
  options?: {
    role?: string;
    status?: string;
    cursor?: string | null;
    limit?: number;
    search?: string;
  }
): Promise<CursorPaginationResult<any>> {
  const role = options?.role;
  const status = options?.status;
  const cursor = options?.cursor;
  const limit = options?.limit || 25;
  const search = options?.search;

  const cacheKey = buildCacheKey({
    tenantId: schoolId,
    table: "staff",
    action: "paginated",
    cursor,
    limit,
    filters: { role, status, search },
  });

  return cacheAside<CursorPaginationResult<any>>({
    key: cacheKey,
    ttlSeconds: 1800, // 30 minutes safe sliding TTL
    fetchFn: async () => {
      const tenantDb = getTenantClient(schoolId);
      const whereClause: any = {
        schoolId,
        ...(status && status !== "ALL" ? { status } : {}),
        ...(role && role !== "ALL" ? { role } : {}),
      };

      if (search && search.trim()) {
        const query = search.trim();
        whereClause.OR = [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ];
      }

      return executeCursorPagination(async (args) => {
        return tenantDb.staff.findMany({
          ...args,
          where: whereClause,
          orderBy: { createdAt: "desc" },
          include: { department: true },
        });
      }, { cursor, limit });
    },
  });
}

export async function createStaff(
  schoolId: string,
  data: { firstName: string; lastName: string; email: string; role: string; status: string }
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    const timestampData: any = {};
    if (data.status === "ONBOARDING") timestampData.onboardingAt = new Date();
    if (data.status === "ACTIVE") timestampData.activeAt = new Date();

    await tenantDb.staff.create({
      data: {
        schoolId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role,
        status: data.status,
        ...timestampData
      }
    });

    // Write-Through Cache Invalidation
    await invalidateStaffNamespace(schoolId);

    revalidatePath(`/[schoolDomain]/staff`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to create staff:", error);
    return { success: false, error: error.message || "Failed to create staff." };
  }
}

export async function updateStaff(
  schoolId: string,
  staffId: string,
  data: { firstName: string; lastName: string; email: string; role: string }
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    await tenantDb.staff.update({
      where: { id: staffId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role,
      }
    });

    // Write-Through Cache Invalidation
    await invalidateStaffNamespace(schoolId);

    revalidatePath(`/[schoolDomain]/staff`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to update staff:", error);
    return { success: false, error: error.message || "Failed to update staff." };
  }
}

export async function deleteStaff(schoolId: string, staffId: string) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    await tenantDb.staff.delete({
      where: { id: staffId }
    });

    // Write-Through Cache Invalidation
    await invalidateStaffNamespace(schoolId);

    revalidatePath(`/[schoolDomain]/staff`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete staff:", error);
    return { success: false, error: error.message || "Failed to delete staff." };
  }
}

export async function updateStaffStatus(
  schoolId: string,
  staffId: string,
  newStatus: string
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    const data: any = { status: newStatus };
    
    switch (newStatus) {
      case "ONBOARDING":
        data.onboardingAt = new Date();
        break;
      case "ACTIVE":
        data.activeAt = new Date();
        break;
      case "LEAVE":
        data.leaveAt = new Date();
        break;
      case "OFFBOARDED":
        data.offboardedAt = new Date();
        break;
      case "TERMINATED":
        data.terminatedAt = new Date();
        break;
    }

    await tenantDb.staff.update({
      where: { id: staffId },
      data
    });

    // Write-Through Cache Invalidation
    await invalidateStaffNamespace(schoolId);

    revalidatePath(`/[schoolDomain]/staff`, "page");
  } catch (error) {
    console.error("[Server Action] Failed to update staff status:", error);
    throw new Error("Failed to update staff status.");
  }
}
