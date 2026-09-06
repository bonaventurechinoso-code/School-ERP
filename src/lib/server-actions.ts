"use server";

import { getTenantClient } from "@/lib/tenant-prisma";

export interface DashboardMetrics {
  enrolledStudents: number;
  activeStaff: number;
  pendingApplications: number;
}

export async function getDashboardMetrics(schoolId: string): Promise<DashboardMetrics> {
  const tenantDb = getTenantClient(schoolId);

  try {
    const [enrolledStudents, activeStaff, pendingApplications] = await Promise.all([
      tenantDb.student.count({
        where: {
          status: "ENROLLED",
        },
      }),
      tenantDb.staff.count({
        where: {
          status: "ACTIVE",
        },
      }),
      tenantDb.student.count({
        where: {
          status: "APPLICANT",
        },
      }),
    ]);

    return {
      enrolledStudents,
      activeStaff,
      pendingApplications,
    };
    
  } catch (error) {
    console.error(`[Server Action] Failed to fetch metrics for school ${schoolId}:`, error);
    throw new Error("Failed to load administrative overview metrics.");
  }
}
