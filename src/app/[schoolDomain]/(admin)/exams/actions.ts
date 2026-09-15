"use server";

import { getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { invalidateGradingNamespace } from "@/lib/cache-invalidation";

export async function createExam(
  schoolId: string,
  data: {
    courseId: string;
    name: string;
    semester: string;
    date: string; // YYYY-MM-DD
    maxScore: number;
  }
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    const examDate = new Date(data.date);
    let resolvedCourseId = data.courseId;

    // Resolve or automatically link course by ID or name
    const existingCourse = await tenantDb.course.findFirst({
      where: {
        schoolId,
        OR: [
          { id: data.courseId },
          { name: data.courseId }
        ]
      }
    });

    if (existingCourse) {
      resolvedCourseId = existingCourse.id;
    } else if (data.courseId) {
      // Create course record so foreign key constraint succeeds seamlessly
      const cleanCode = data.courseId.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "") + Math.floor(100 + Math.random() * 900);
      const newCourse = await tenantDb.course.create({
        data: {
          schoolId,
          name: data.courseId,
          code: cleanCode,
        }
      });
      resolvedCourseId = newCourse.id;
    }

    await tenantDb.exam.create({
      data: {
        schoolId,
        courseId: resolvedCourseId,
        name: data.name,
        semester: data.semester,
        date: examDate,
        maxScore: data.maxScore,
      }
    });

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);

    revalidatePath(`/[schoolDomain]/exams`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to create exam:", error);
    return { success: false, error: error.message || "Failed to create exam." };
  }
}

export async function deleteExam(schoolId: string, id: string) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    await tenantDb.exam.delete({
      where: { id }
    });

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);

    revalidatePath(`/[schoolDomain]/exams`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete exam:", error);
    return { success: false, error: error.message || "Failed to delete exam." };
  }
}

export async function upsertExamResult(
  schoolId: string,
  examId: string,
  studentId: string,
  score: number,
  ca1Score?: number,
  ca2Score?: number,
  examScore?: number,
  letterGrade?: string,
  remarks?: string
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    await tenantDb.examResult.upsert({
      where: {
        schoolId_examId_studentId: {
          schoolId,
          examId,
          studentId
        }
      },
      update: {
        score,
        ca1Score,
        ca2Score,
        examScore,
        letterGrade,
        remarks
      },
      create: {
        schoolId,
        examId,
        studentId,
        score,
        ca1Score,
        ca2Score,
        examScore,
        letterGrade,
        remarks
      }
    });

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);

    revalidatePath(`/[schoolDomain]/exams`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to upsert exam result:", error);
    return { success: false, error: error.message || "Failed to upsert exam result." };
  }
}
