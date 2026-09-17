"use server";

import { basePrisma, getTenantClient, getPrismaClientForTier } from "@/lib/tenant-prisma";
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
  },
  schoolDomain?: string,
  tierName?: string
) {
  const tenantDb = tierName ? await getPrismaClientForTier(schoolId, tierName) : getTenantClient(schoolId);
  
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
      return { 
        success: false, 
        error: `Conflict: Teacher is already booked for ${staffConflict.course.name} during this time slot (${data.startTime} - ${data.endTime}).` 
      };
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
      return { 
        success: false, 
        error: `Conflict: Room is already booked for ${roomConflict.course.name} during this time (${data.startTime} - ${data.endTime}).` 
      };
    }

    await tenantDb.timetable.create({
      data: {
        schoolId,
        ...data
      }
    });

    if (schoolDomain) {
      safeRevalidatePath(`/${schoolDomain}/scheduling`, "page");
    } else {
      safeRevalidatePath(`/scheduling`, "page");
    }
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to create timetable entry:", error);
    return { success: false, error: error.message || "Failed to create timetable entry." };
  }
}

export async function deleteTimetableEntry(schoolId: string, id: string, schoolDomain?: string, tierName?: string) {
  const tenantDb = tierName ? await getPrismaClientForTier(schoolId, tierName) : getTenantClient(schoolId);
  
  try {
    await tenantDb.timetable.delete({
      where: { id }
    });

    if (schoolDomain) {
      safeRevalidatePath(`/${schoolDomain}/scheduling`, "page");
    } else {
      safeRevalidatePath(`/scheduling`, "page");
    }
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
  notes?: string,
  schoolDomain?: string,
  tierName?: string
) {
  const tenantDb = tierName ? await getPrismaClientForTier(schoolId, tierName) : getTenantClient(schoolId);
  const date = new Date(dateString);
  date.setUTCHours(0, 0, 0, 0); // Ensure it's midnight UTC for consistent daily matching
  
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

    if (schoolDomain) {
      safeRevalidatePath(`/${schoolDomain}/scheduling`, "page");
    } else {
      safeRevalidatePath(`/scheduling`, "page");
    }
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to mark student attendance:", error);
    return { success: false, error: error.message || "Failed to mark student attendance." };
  }
}

/**
 * Batch Action: Mark all active students in a given class as "PRESENT" for a specific date
 */
export async function markAllClassPresentAction(
  schoolId: string,
  classFilter: string,
  dateString: string,
  schoolDomain?: string,
  tierName?: string
) {
  const tenantDb = tierName ? await getPrismaClientForTier(schoolId, tierName) : getTenantClient(schoolId);
  const date = new Date(dateString);
  date.setUTCHours(0, 0, 0, 0);

  try {
    const whereClause: any = {
      schoolId,
      status: { in: ["ENROLLED", "ACTIVE"] }
    };
    if (classFilter && classFilter !== "ALL") {
      whereClause.currentClass = classFilter;
    }

    const students = await tenantDb.student.findMany({
      where: whereClause,
      select: { id: true }
    });

    if (students.length === 0) {
      return { success: true, count: 0, message: "No enrolled students found in this class." };
    }

    // Upsert attendance for each student in batch
    await Promise.all(
      students.map((student) =>
        tenantDb.studentAttendance.upsert({
          where: {
            schoolId_studentId_date: {
              schoolId,
              studentId: student.id,
              date
            }
          },
          update: {
            status: "PRESENT"
          },
          create: {
            schoolId,
            studentId: student.id,
            date,
            status: "PRESENT"
          }
        })
      )
    );

    if (schoolDomain) {
      safeRevalidatePath(`/${schoolDomain}/scheduling`, "page");
    } else {
      safeRevalidatePath(`/scheduling`, "page");
    }
    return { success: true, count: students.length };
  } catch (error: any) {
    console.error("[Server Action] Failed to batch mark students present:", error);
    return { success: false, error: error.message || "Failed to batch mark students present." };
  }
}

export async function markStaffAttendance(
  schoolId: string,
  staffId: string,
  dateString: string, // YYYY-MM-DD
  status: string,
  notes?: string,
  schoolDomain?: string,
  tierName?: string
) {
  const tenantDb = tierName ? await getPrismaClientForTier(schoolId, tierName) : getTenantClient(schoolId);
  const date = new Date(dateString);
  date.setUTCHours(0, 0, 0, 0);
  
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

    if (schoolDomain) {
      safeRevalidatePath(`/${schoolDomain}/scheduling`, "page");
    } else {
      safeRevalidatePath(`/scheduling`, "page");
    }
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to mark staff attendance:", error);
    return { success: false, error: error.message || "Failed to mark staff attendance." };
  }
}
