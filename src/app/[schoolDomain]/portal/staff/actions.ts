"use server";

import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

export interface AttendanceRecordPayload {
  studentId: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | string;
  notes?: string;
}

export interface GradeEntryPayload {
  studentId: string;
  ca1: number;
  ca2: number;
  exam: number;
  totalScore: number;
  teacherRemarks?: string;
}

/**
 * 1. Fetch all classrooms, tiers, courses, and active students for a tenant
 */
export async function fetchStaffPortalInitialData(schoolId: string) {
  try {
    const [school, classrooms, courses, students] = await Promise.all([
      basePrisma.school.findUnique({
        where: { id: schoolId },
        include: {
          academicTiers: {
            orderBy: { level: "asc" },
          },
        },
      }),
      basePrisma.classroom.findMany({
        where: { schoolId },
        orderBy: { name: "asc" },
      }),
      basePrisma.course.findMany({
        where: { schoolId },
        orderBy: { name: "asc" },
      }),
      basePrisma.student.findMany({
        where: {
          schoolId,
          status: { in: ["ENROLLED", "ACTIVE"] },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          currentClass: true,
          tierId: true,
          status: true,
          parentPhone: true,
          dynamicFields: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);

    return {
      success: true,
      tiers: school?.academicTiers || [],
      classrooms,
      courses,
      students,
    };
  } catch (error: any) {
    console.error("[fetchStaffPortalInitialData Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to load staff portal data",
      tiers: [],
      classrooms: [],
      courses: [],
      students: [],
    };
  }
}

/**
 * 2. Fetch daily attendance records for a class on a specific date
 */
export async function fetchClassroomAttendance(
  schoolId: string,
  dateString: string
) {
  try {
    const targetDate = new Date(dateString);
    // Normalized to midnight UTC for uniform comparison
    const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const attendanceRecords = await basePrisma.studentAttendance.findMany({
      where: {
        schoolId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        studentId: true,
        status: true,
        notes: true,
        date: true,
      },
    });

    return {
      success: true,
      records: attendanceRecords,
    };
  } catch (error: any) {
    console.error("[fetchClassroomAttendance Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to load attendance",
      records: [],
    };
  }
}

/**
 * 3. Save or update daily attendance records for students
 */
export async function saveClassroomAttendance(
  schoolId: string,
  dateString: string,
  records: AttendanceRecordPayload[]
) {
  try {
    const targetDate = new Date(dateString);
    const normalizedDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));

    // Execute atomic batch upserts
    await basePrisma.$transaction(
      records.map((r) =>
        basePrisma.studentAttendance.upsert({
          where: {
            schoolId_studentId_date: {
              schoolId,
              studentId: r.studentId,
              date: normalizedDate,
            },
          },
          update: {
            status: r.status,
            notes: r.notes || null,
            updatedAt: new Date(),
          },
          create: {
            schoolId,
            studentId: r.studentId,
            date: normalizedDate,
            status: r.status,
            notes: r.notes || null,
          },
        })
      )
    );

    return { success: true, count: records.length };
  } catch (error: any) {
    console.error("[saveClassroomAttendance Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to save attendance records",
    };
  }
}

/**
 * 4. Fetch grade records for a cohort, subject, and term
 */
export async function fetchClassroomGrades(
  schoolId: string,
  className: string,
  subject: string,
  term: string
) {
  try {
    const grades = await basePrisma.gradeRecord.findMany({
      where: {
        schoolId,
        className,
        subject,
        term,
      },
    });

    return {
      success: true,
      grades,
    };
  } catch (error: any) {
    console.error("[fetchClassroomGrades Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch grades",
      grades: [],
    };
  }
}

/**
 * 5. Save or update assessment grade records (synced to GradeRecord and AcademicRecord)
 */
export async function saveClassroomGrades(
  schoolId: string,
  className: string,
  subject: string,
  term: string,
  academicYear: string,
  grades: GradeEntryPayload[]
) {
  try {
    // Helper to resolve grade letter
    function getGradeLetter(total: number): string {
      if (total >= 75) return "A1";
      if (total >= 70) return "B2";
      if (total >= 65) return "B3";
      if (total >= 60) return "C4";
      if (total >= 55) return "C5";
      if (total >= 50) return "C6";
      if (total >= 45) return "D7";
      if (total >= 40) return "E8";
      return "F9";
    }

    await basePrisma.$transaction(async (tx) => {
      for (const item of grades) {
        const ca1 = Math.min(20, Math.max(0, item.ca1 || 0));
        const ca2 = Math.min(20, Math.max(0, item.ca2 || 0));
        const exam = Math.min(60, Math.max(0, item.exam || 0));
        const total = ca1 + ca2 + exam;
        const letter = getGradeLetter(total);

        // 1. Upsert GradeRecord
        await tx.gradeRecord.upsert({
          where: {
            schoolId_studentId_term_className_subject: {
              schoolId,
              studentId: item.studentId,
              term,
              className,
              subject,
            },
          },
          update: {
            ca1,
            ca2,
            exam,
            totalScore: total,
            updatedAt: new Date(),
          },
          create: {
            schoolId,
            studentId: item.studentId,
            className,
            subject,
            term,
            ca1,
            ca2,
            exam,
            totalScore: total,
          },
        });

        // 2. Upsert AcademicRecord
        await tx.academicRecord.upsert({
          where: {
            schoolId_studentId_subject_term_academicYear: {
              schoolId,
              studentId: item.studentId,
              subject,
              term,
              academicYear,
            },
          },
          update: {
            className,
            test1: ca1,
            test2: ca2,
            finalExam: exam,
            totalScore: total,
            gradeLetter: letter,
            isPassed: total >= 40,
            teacherRemarks: item.teacherRemarks || null,
            updatedAt: new Date(),
          },
          create: {
            schoolId,
            studentId: item.studentId,
            subject,
            term,
            academicYear,
            className,
            test1: ca1,
            test2: ca2,
            finalExam: exam,
            totalScore: total,
            gradeLetter: letter,
            isPassed: total >= 40,
            teacherRemarks: item.teacherRemarks || null,
          },
        });
      }
    });

    return { success: true, count: grades.length };
  } catch (error: any) {
    console.error("[saveClassroomGrades Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to save grades",
    };
  }
}
