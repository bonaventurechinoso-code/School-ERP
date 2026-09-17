"use server";

import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { compileClassReportCards } from "@/lib/report-card-service";

function safeRevalidate(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful fallback when invoked outside Next.js request/action context (e.g. testing)
  }
}

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

export interface StaffProfileData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department: string;
  baseSalary: number;
  bankName: string;
  bankAccountNumber: string;
  accountName: string;
  status: string;
}

export interface PayrollRecordItem {
  id: string;
  amount: number;
  status: string;
  payDate: Date | string;
  receiptCode?: string | null;
}

export interface TimetablePeriodItem {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  course: {
    id: string;
    name: string;
    code: string;
  };
  classroom: {
    id: string;
    name: string;
  };
}

/**
 * 1. Fetch all classrooms, tiers, courses, active students, and current faculty profile for a tenant
 */
export async function fetchStaffPortalInitialData(schoolId: string, staffEmail?: string) {
  try {
    // 1. Resolve logged-in staff member or active faculty
    let currentStaff: any = null;
    if (staffEmail) {
      currentStaff = await basePrisma.staff.findFirst({
        where: { schoolId, email: staffEmail },
        include: {
          department: true,
          PayrollRecord: {
            orderBy: { payDate: "desc" },
          },
          Timetable: {
            include: {
              course: true,
              classroom: true,
            },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          },
        },
      });
    }

    if (!currentStaff) {
      currentStaff = await basePrisma.staff.findFirst({
        where: { schoolId },
        include: {
          department: true,
          PayrollRecord: {
            orderBy: { payDate: "desc" },
          },
          Timetable: {
            include: {
              course: true,
              classroom: true,
            },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          },
        },
      });
    }

    const [school, classrooms, courses, students, lessonNotes, leaveRequests] = await Promise.all([
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
      currentStaff ? fetchStaffLessonNotesAction(schoolId, currentStaff.id) : Promise.resolve([]),
      currentStaff ? fetchStaffLeaveRequestsAction(schoolId, currentStaff.id) : Promise.resolve([]),
    ]);

    return {
      success: true,
      tiers: school?.academicTiers || [],
      classrooms,
      courses,
      students,
      lessonNotes,
      leaveRequests,
      staffProfile: currentStaff
        ? {
            id: currentStaff.id,
            firstName: currentStaff.firstName,
            lastName: currentStaff.lastName,
            email: currentStaff.email,
            role: currentStaff.role,
            department: currentStaff.department?.name || "Academics",
            baseSalary: currentStaff.baseSalary || 0,
            bankName: currentStaff.bankName || "First Bank of Nigeria",
            bankAccountNumber: currentStaff.bankAccountNumber || "N/A",
            accountName: currentStaff.accountName || `${currentStaff.firstName} ${currentStaff.lastName}`,
            status: currentStaff.status,
          }
        : null,
      payrollRecords: currentStaff?.PayrollRecord || [],
      timetable: currentStaff?.Timetable || [],
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
      lessonNotes: [],
      leaveRequests: [],
      staffProfile: null,
      payrollRecords: [],
      timetable: [],
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

/**
 * 6. Batch compile class report cards from staff portal
 */
export async function compileClassReportCardsFromStaffPortal(
  schoolId: string,
  className: string,
  term: string,
  academicYear: string,
  tierName?: string
) {
  try {
    const result = await compileClassReportCards({
      schoolId,
      className,
      term,
      academicYear,
      tierName,
    });
    safeRevalidate("/[schoolDomain]/portal/staff", "page");
    return {
      success: true,
      compiledCount: result.totalCompiled,
      data: result,
      message: `Successfully compiled ${result.totalCompiled} report cards for ${className} (${term}, ${academicYear}).`,
    };
  } catch (error: any) {
    console.error("[compileClassReportCardsFromStaffPortal Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to compile report cards.",
    };
  }
}

// ---------------------------------------------------------------------------
// 7. LESSON NOTES & SCHEME OF WORK SUBMISSIONS
// ---------------------------------------------------------------------------

export interface LessonNoteData {
  id?: string;
  weekNumber: number;
  subject: string;
  className: string;
  topic: string;
  subTopic?: string;
  objectives: string;
  instructionalMaterials?: string;
  introduction?: string;
  presentationSteps?: string;
  evaluation?: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REVISION_REQUESTED";
  submittedAt?: string;
  feedback?: string;
  supervisorFeedback?: string;
}

export async function fetchStaffLessonNotesAction(schoolId: string, staffId: string): Promise<LessonNoteData[]> {
  try {
    const notices = await basePrisma.notice.findMany({
      where: {
        schoolId,
        authorId: staffId,
        targetAudience: "LESSON_NOTE",
      },
      orderBy: { createdAt: "desc" },
    });

    return notices.map((n) => {
      try {
        const parsed = JSON.parse(n.content);
        return {
          ...parsed,
          id: n.id,
          status: (n.priority as any) || parsed.status || "DRAFT",
          submittedAt: n.createdAt.toISOString(),
        };
      } catch {
        return {
          id: n.id,
          weekNumber: 1,
          subject: "General",
          className: "Class",
          topic: n.title,
          objectives: n.content,
          status: (n.priority as any) || "DRAFT",
          submittedAt: n.createdAt.toISOString(),
        };
      }
    });
  } catch (err) {
    console.error("[fetchStaffLessonNotesAction Error]:", err);
    return [];
  }
}

export async function submitLessonNoteAction(
  schoolId: string,
  staffId: string,
  note: LessonNoteData
) {
  try {
    const title = `Week ${note.weekNumber}: ${note.topic} (${note.subject} - ${note.className})`;
    const content = JSON.stringify(note);
    const priority = note.status || "SUBMITTED";

    if (note.id) {
      const updated = await basePrisma.notice.update({
        where: { id: note.id },
        data: {
          title,
          content,
          priority,
          updatedAt: new Date(),
        },
      });
      safeRevalidate("/[schoolDomain]/portal/staff", "page");
      return { success: true, id: updated.id, note: { ...note, id: updated.id } };
    } else {
      const created = await basePrisma.notice.create({
        data: {
          schoolId,
          authorId: staffId,
          targetAudience: "LESSON_NOTE",
          title,
          content,
          priority,
        },
      });
      safeRevalidate("/[schoolDomain]/portal/staff", "page");
      return { success: true, id: created.id, note: { ...note, id: created.id } };
    }
  } catch (err: any) {
    console.error("[submitLessonNoteAction Error]:", err);
    return { success: false, error: err.message || "Failed to submit lesson note" };
  }
}

// ---------------------------------------------------------------------------
// 8. FACULTY LEAVE & ABSENCE REQUESTS
// ---------------------------------------------------------------------------

export interface LeaveRequestData {
  id?: string;
  leaveType: "ANNUAL" | "SICK" | "MATERNITY" | "CASUAL" | "STUDY" | string;
  startDate: string;
  endDate: string;
  reason: string;
  reliefTeacher?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  appliedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  adminNotes?: string;
}

export async function fetchStaffLeaveRequestsAction(schoolId: string, staffId: string): Promise<LeaveRequestData[]> {
  try {
    const notices = await basePrisma.notice.findMany({
      where: {
        schoolId,
        authorId: staffId,
        targetAudience: "LEAVE_REQUEST",
      },
      orderBy: { createdAt: "desc" },
    });

    return notices.map((n) => {
      try {
        const parsed = JSON.parse(n.content);
        return {
          ...parsed,
          id: n.id,
          status: (n.priority as any) || parsed.status || "PENDING",
          appliedAt: n.createdAt.toISOString(),
        };
      } catch {
        return {
          id: n.id,
          leaveType: "CASUAL",
          startDate: n.createdAt.toISOString().split("T")[0],
          endDate: n.createdAt.toISOString().split("T")[0],
          reason: n.content,
          status: (n.priority as any) || "PENDING",
          appliedAt: n.createdAt.toISOString(),
        };
      }
    });
  } catch (err) {
    console.error("[fetchStaffLeaveRequestsAction Error]:", err);
    return [];
  }
}

export async function submitLeaveRequestAction(
  schoolId: string,
  staffId: string,
  request: LeaveRequestData
) {
  try {
    const title = `${request.leaveType} Leave Request (${request.startDate} to ${request.endDate})`;
    const content = JSON.stringify(request);
    const priority = request.status || "PENDING";

    if (request.id) {
      const updated = await basePrisma.notice.update({
        where: { id: request.id },
        data: {
          title,
          content,
          priority,
          updatedAt: new Date(),
        },
      });
      safeRevalidate("/[schoolDomain]/portal/staff", "page");
      return { success: true, id: updated.id, leave: { ...request, id: updated.id }, request: { ...request, id: updated.id } };
    } else {
      const created = await basePrisma.notice.create({
        data: {
          schoolId,
          authorId: staffId,
          targetAudience: "LEAVE_REQUEST",
          title,
          content,
          priority,
        },
      });
      safeRevalidate("/[schoolDomain]/portal/staff", "page");
      return { success: true, id: created.id, leave: { ...request, id: created.id }, request: { ...request, id: created.id } };
    }
  } catch (err: any) {
    console.error("[submitLeaveRequestAction Error]:", err);
    return { success: false, error: err.message || "Failed to submit leave request" };
  }
}
