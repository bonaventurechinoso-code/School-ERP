"use server";

import { basePrisma, getTenantClient, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import * as jose from "jose";

async function resolveDbForAction(schoolId: string, tierContext?: string, tierId?: string) {
  let activeTier = tierContext;

  if (!activeTier && tierId) {
    try {
      const tier = await basePrisma.academicTier.findUnique({
        where: { id: tierId },
        select: { name: true, databaseUrl: true },
      });
      if (tier?.name) activeTier = tier.name;
    } catch {}
  }

  if (!activeTier) {
    try {
      const cookieStore = await cookies();
      activeTier = cookieStore.get("activeTier")?.value;
    } catch {}
  }

  return getPrismaClientForTier(schoolId, activeTier || "");
}

export async function createStudent(
  schoolId: string,
  data: { 
    firstName: string; lastName: string; email: string; status: string; tierId: string; dynamicFields?: any;
    admissionNumber?: string; currentClass?: string; dateOfBirth?: Date; stateOfOrigin?: string;
    parentName?: string; parentOccupation?: string; parentEmail?: string; parentPhone?: string; parentWhatsApp?: string;
  },
  tierContext?: string
) {
  // RBAC GUARD
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    if (!sessionToken) return { success: false, error: "HTTP 401 Unauthorized" };
    
    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(sessionToken, secret);
    
    if (payload.role === "TEACHER") {
      return { success: false, error: "HTTP 403 Forbidden: Teachers are not permitted to manually register new students." };
    }
  } catch (err) {
    return { success: false, error: "HTTP 401 Unauthorized" };
  }

  const tenantDb = await resolveDbForAction(schoolId, tierContext, data.tierId);
  
  try {
    const timestampData: any = {};
    if (data.status === "PROSPECT") timestampData.prospectAt = new Date();
    if (data.status === "APPLICANT") timestampData.applicantAt = new Date();
    if (data.status === "SCREENED") timestampData.screenedAt = new Date();
    if (data.status === "ENROLLED") timestampData.enrolledAt = new Date();

    let finalAdmissionNumber = data.admissionNumber;
    if (!finalAdmissionNumber) {
      const school = await basePrisma.school.findUnique({ where: { id: schoolId } });
      const studentCount = await tenantDb.student.count();
      const prefix = school ? school.subdomain.toUpperCase() : "SCH";
      const year = new Date().getFullYear();
      const seq = String(studentCount + 1).padStart(3, '0');
      finalAdmissionNumber = `${prefix}/${year}/${seq}`;
    }

    await tenantDb.student.create({
      data: {
        schoolId,
        tierId: data.tierId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        status: data.status,
        dynamicFields: data.dynamicFields || null,
        admissionNumber: finalAdmissionNumber,
        currentClass: data.currentClass || null,
        dateOfBirth: data.dateOfBirth || null,
        stateOfOrigin: data.stateOfOrigin || null,
        parentName: data.parentName || null,
        parentOccupation: data.parentOccupation || null,
        parentEmail: data.parentEmail || null,
        parentPhone: data.parentPhone || null,
        parentWhatsApp: data.parentWhatsApp || null,
        ...timestampData
      }
    });

    revalidatePath(`/[schoolDomain]/students`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to create student:", error);
    return { success: false, error: error.message || "Failed to create student." };
  }
}

export async function updateStudent(
  schoolId: string,
  studentId: string,
  data: { 
    firstName: string; lastName: string; email: string; tierId: string; dynamicFields?: any;
    admissionNumber?: string; currentClass?: string; dateOfBirth?: Date; stateOfOrigin?: string;
    parentName?: string; parentOccupation?: string; parentEmail?: string; parentPhone?: string; parentWhatsApp?: string;
  },
  tierContext?: string
) {
  const tenantDb = await resolveDbForAction(schoolId, tierContext, data.tierId);
  
  try {
    await tenantDb.student.update({
      where: { id: studentId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        tierId: data.tierId,
        dynamicFields: data.dynamicFields || null,
        admissionNumber: data.admissionNumber || null,
        currentClass: data.currentClass || null,
        dateOfBirth: data.dateOfBirth || null,
        stateOfOrigin: data.stateOfOrigin || null,
        parentName: data.parentName || null,
        parentOccupation: data.parentOccupation || null,
        parentEmail: data.parentEmail || null,
        parentPhone: data.parentPhone || null,
        parentWhatsApp: data.parentWhatsApp || null,
      }
    });

    revalidatePath(`/[schoolDomain]/students`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to update student:", error);
    return { success: false, error: error.message || "Failed to update student." };
  }
}

export async function deleteStudent(schoolId: string, studentId: string, tierContext?: string) {
  const tenantDb = await resolveDbForAction(schoolId, tierContext);
  
  try {
    await tenantDb.student.delete({
      where: { id: studentId }
    });

    revalidatePath(`/[schoolDomain]/students`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete student:", error);
    return { success: false, error: error.message || "Failed to delete student." };
  }
}

export async function updateStudentStatus(
  schoolId: string,
  studentId: string,
  newStatus: string,
  tierContext?: string
) {
  const tenantDb = await resolveDbForAction(schoolId, tierContext);
  
  try {
    const data: any = { status: newStatus };
    
    switch (newStatus) {
      case "PROSPECT":
        data.prospectAt = new Date();
        break;
      case "APPLICANT":
        data.applicantAt = new Date();
        break;
      case "SCREENED":
        data.screenedAt = new Date();
        break;
      case "ENROLLED":
        data.enrolledAt = new Date();
        break;
      case "SUSPENDED":
        data.suspendedAt = new Date();
        break;
      case "EXPELLED":
        data.expelledAt = new Date();
        break;
      case "ALUMNI":
        data.alumniAt = new Date();
        break;
    }

    await tenantDb.student.update({
      where: { id: studentId },
      data
    });

    revalidatePath(`/[schoolDomain]/students`, "page");
  } catch (error) {
    console.error("[Server Action] Failed to update student status:", error);
    throw new Error("Failed to update student status.");
  }
}

export async function bulkGraduateClass(schoolId: string, className: string, tierContext?: string) {
  const tenantDb = await resolveDbForAction(schoolId, tierContext);
  try {
    const result = await tenantDb.student.updateMany({
      where: { 
        currentClass: className,
        status: { not: "ALUMNI" }
      },
      data: {
        status: "ALUMNI",
        alumniAt: new Date()
      }
    });

    revalidatePath(`/[schoolDomain]/students`, "page");
    return { success: true, count: result.count };
  } catch (error: any) {
    console.error("[Server Action] Failed to bulk graduate class:", error);
    return { success: false, error: error.message || "Failed to bulk graduate class." };
  }
}

export async function bulkGraduateStudents(schoolId: string, studentIds: string[], tierContext?: string) {
  const tenantDb = await resolveDbForAction(schoolId, tierContext);
  try {
    const result = await tenantDb.student.updateMany({
      where: { 
        id: { in: studentIds },
        status: { not: "ALUMNI" }
      },
      data: {
        status: "ALUMNI",
        alumniAt: new Date()
      }
    });

    revalidatePath(`/[schoolDomain]/students`, "page");
    return { success: true, count: result.count };
  } catch (error: any) {
    console.error("[Server Action] Failed to bulk graduate students:", error);
    return { success: false, error: error.message || "Failed to graduate students." };
  }
}
