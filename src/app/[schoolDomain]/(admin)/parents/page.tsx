import React from "react";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import ParentsTableClient from "./ParentsTableClient";

export interface ParentsPageProps {
  params: Promise<{ schoolDomain: string }>;
}

export default async function ParentsPage({ params: paramsPromise }: ParentsPageProps) {
  const params = await paramsPromise;
  const schoolDomain = params.schoolDomain;

  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: schoolDomain },
        { slug: schoolDomain },
        { id: schoolDomain },
      ],
      isActive: true,
      deletedAt: null,
    },
  });

  if (!school) {
    notFound();
  }

  // Fetch all registered parents for this school along with their linked children
  const parents = await basePrisma.parent.findMany({
    where: {
      schoolId: school.id,
    },
    include: {
      students: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              currentClass: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const formattedParents = parents.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone || "",
    relationship: p.relationship,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    childrenCount: p.students.length,
    children: p.students.map((sp) => ({
      id: sp.student.id,
      name: `${sp.student.firstName} ${sp.student.lastName}`.trim(),
      admissionNumber: sp.student.admissionNumber || "",
      grade: sp.student.currentClass || "N/A",
      status: sp.student.status,
    })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Parents & Guardians Directory
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage registered parents, monitor portal access, and view linked students across {school.name}.
          </p>
        </div>
      </div>

      <ParentsTableClient initialParents={formattedParents} schoolDomain={schoolDomain} schoolName={school.name} />
    </div>
  );
}
