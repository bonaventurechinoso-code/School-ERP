"use server";

import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { cookies } from "next/headers";

export async function getDashboardMetrics(schoolId: string, tierContext?: string) {
  let activeTier = tierContext;
  if (!activeTier) {
    try {
      const cookieStore = await cookies();
      activeTier = cookieStore.get("activeTier")?.value;
    } catch {}
  }

  const tenantDb = await getPrismaClientForTier(schoolId, activeTier || "");
  
  const [enrolledStudents, activeStaff, pendingApplications, tiers, classrooms, paymentSum, recentStudents] = await Promise.all([
    tenantDb.student.count({ where: { status: "ENROLLED" } }),
    tenantDb.staff.count({ where: { status: "ACTIVE" } }),
    tenantDb.admissionLead.count({ where: { status: { notIn: ["ENROLLED", "REJECTED"] } } }),
    basePrisma.academicTier.findMany({ where: { schoolId }, orderBy: { level: 'asc' } }),
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
  },
  tierContext?: string
) {
  let activeTier = tierContext;
  if (!activeTier && data.tierId) {
    try {
      const tier = await basePrisma.academicTier.findUnique({
        where: { id: data.tierId },
        select: { name: true },
      });
      if (tier?.name) activeTier = tier.name;
    } catch {}
  }

  const tenantDb = await getPrismaClientForTier(schoolId, activeTier || "");
  await tenantDb.admissionLead.create({
    data: {
      schoolId,
      ...data,
      status: "INQUIRY",
    },
  });
}
