"use server";

import { getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op when executed outside HTTP request context (e.g. testing)
  }
}

// --- TIMETABLE ACTIONS ---

export async function createTimetableEntry(
  schoolId: string,
  data: {
    courseId: string;
    classroomId: string;
    staffId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    // 1. Check for Teacher Double-Booking Conflict
    const staffConflict = await tenantDb.timetable.findFirst({
      where: {
        schoolId,
        staffId: data.staffId,
        dayOfWeek: data.dayOfWeek,
        startTime: { lt: data.endTime },
        endTime: { gt: data.startTime }
      },
      include: { course: true }
    });

    if (staffConflict) {
      return { success: false, error: `Conflict: Teacher is already booked for ${staffConflict.course.name} during this time slot.` };
    }

    // 2. Check for Room Double-Booking Conflict
    const roomConflict = await tenantDb.timetable.findFirst({
      where: {
        schoolId,
        classroomId: data.classroomId,
        dayOfWeek: data.dayOfWeek,
        startTime: { lt: data.endTime },
        endTime: { gt: data.startTime }
      },
      include: { course: true }
    });

    if (roomConflict) {
      return { success: false, error: `Conflict: Room is already booked for ${roomConflict.course.name} during this time.` };
    }

    await tenantDb.timetable.create({
      data: {
        schoolId,
        ...data
      }
    });

    safeRevalidatePath(`/[schoolDomain]/scheduling`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to create timetable entry:", error);
    return { success: false, error: error.message || "Failed to create timetable entry." };
  }
}

export async function deleteTimetableEntry(schoolId: string, id: string) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    await tenantDb.timetable.delete({
      where: { id }
    });

    safeRevalidatePath(`/[schoolDomain]/scheduling`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete timetable entry:", error);
    return { success: false, error: error.message || "Failed to delete timetable entry." };
  }
}

// --- ATTENDANCE ACTIONS ---

export async function markStudentAttendance(
  schoolId: string,
  studentId: string,
  dateString: string, // YYYY-MM-DD
  status: string,
  notes?: string
) {
  const tenantDb = getTenantClient(schoolId);
  const date = new Date(dateString);
  date.setUTCHours(0,0,0,0); // Ensure it's midnight UTC for consistent daily matching
  
  try {
    await tenantDb.studentAttendance.upsert({
      where: {
        schoolId_studentId_date: {
          schoolId,
          studentId,
          date
        }
      },
      update: {
        status,
        notes
      },
      create: {
        schoolId,
        studentId,
        date,
        status,
        notes
      }
    });

    safeRevalidatePath(`/[schoolDomain]/scheduling`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to mark student attendance:", error);
    return { success: false, error: error.message || "Failed to mark student attendance." };
  }
}

export async function markStaffAttendance(
  schoolId: string,
  staffId: string,
  dateString: string, // YYYY-MM-DD
  status: string,
  notes?: string
) {
  const tenantDb = getTenantClient(schoolId);
  const date = new Date(dateString);
  date.setUTCHours(0,0,0,0);
  
  try {
    await tenantDb.staffAttendance.upsert({
      where: {
        schoolId_staffId_date: {
          schoolId,
          staffId,
          date
        }
      },
      update: {
        status,
        notes
      },
      create: {
        schoolId,
        staffId,
        date,
        status,
        notes
      }
    });

    safeRevalidatePath(`/[schoolDomain]/scheduling`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to mark staff attendance:", error);
    return { success: false, error: error.message || "Failed to mark staff attendance." };
  }
}
