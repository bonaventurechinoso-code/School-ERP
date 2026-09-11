"use server";

import { getTenantClient } from "@/lib/tenant-prisma";

export async function getDashboardMetrics(schoolId: string) {
  const tenantDb = getTenantClient(schoolId);
  
  const [enrolledStudents, activeStaff, pendingApplications, tiers, classrooms, paymentSum, recentStudents] = await Promise.all([
    tenantDb.student.count({ where: { status: "ENROLLED" } }),
    tenantDb.staff.count({ where: { status: "ACTIVE" } }),
    tenantDb.admissionLead.count({ where: { status: { notIn: ["ENROLLED", "REJECTED"] } } }),
    tenantDb.academicTier.findMany({ orderBy: { level: 'asc' } }),
    tenantDb.classroom.findMany({ orderBy: { name: 'asc' } }),
    tenantDb.payment.aggregate({ _sum: { amountPaid: true } }),
    tenantDb.student.findMany({
      where: { status: "ENROLLED" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    enrolledStudents,
    activeStaff,
    pendingApplications,
    tiers,
    classrooms,
    termlyRevenue: paymentSum._sum.amountPaid || 0,
    recentStudents,
  };
}

export async function createAdmissionLead(
  schoolId: string,
  data: {
    applicantName: string;
    parentName?: string;
    parentContact: string;
    parentEmail?: string;
    targetGrade: string;
    source?: string;
    tierId: string;
  }
) {
  const tenantDb = getTenantClient(schoolId);
  await tenantDb.admissionLead.create({
    data: {
      schoolId,
      ...data,
      status: "INQUIRY",
    },
  });
}
