"use server";

import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { compileClassReportCards } from "@/lib/report-card-service";
import { invalidateGradingNamespace } from "@/lib/cache-invalidation";
import { isCrecheClass, resolveCrecheConfig, mapCrecheScoreToGrade } from "@/lib/creche-config";
import { isNurseryClass, resolveNurseryConfig, mapNurseryScoreToGrade } from "@/lib/nursery-config";
import { isTertiaryClass, resolveTertiaryCourse, mapTertiaryScoreToGrade } from "@/lib/tertiary-config";
import { getTierForClass } from "@/lib/school-tier-classes";
import { getSession } from "@/lib/auth";

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
 * 0. Resolves all classrooms and subjects strictly assigned to a staff member across all tiers.
 */
export async function getStaffAssignedClassesAndSubjects(
  schoolId: string,
  staffId: string
): Promise<{ assignedClasses: string[]; assignedSubjects: string[] }> {
  const assignedClassesSet = new Set<string>();
  const assignedSubjectsSet = new Set<string>();

  try {
    // 1. StaffAssignment records (Primary ClassTeacher / SubjectTeacher, Secondary FormTutor / SubjectTeacher, Creche Caregiver, Tertiary Lecturer, etc.)
    const assignments = await basePrisma.staffAssignment.findMany({
      where: { schoolId, staffId },
      include: { classroom: true, course: true },
    });

    for (const a of assignments) {
      if (a.classroom?.name) {
        assignedClassesSet.add(a.classroom.name.trim());
      } else if (a.classroomId) {
        const cls = await basePrisma.classroom.findUnique({
          where: { id: a.classroomId },
          select: { name: true },
        });
        if (cls?.name) assignedClassesSet.add(cls.name.trim());
      }

      if (a.course?.name) {
        assignedSubjectsSet.add(a.course.name.trim());
      }

      if (a.metadata) {
        try {
          const meta = typeof a.metadata === "string" ? JSON.parse(a.metadata) : a.metadata;
          if (meta.className) assignedClassesSet.add(String(meta.className).trim());
          if (meta.playgroupName) assignedClassesSet.add(String(meta.playgroupName).trim());
          if (meta.assignedClass) assignedClassesSet.add(String(meta.assignedClass).trim());
          if (meta.displayLabel) assignedClassesSet.add(String(meta.displayLabel).trim());
          if (Array.isArray(meta.classes)) {
            meta.classes.forEach((c: any) => c && assignedClassesSet.add(String(c).trim()));
          }
          if (Array.isArray(meta.classesTaught)) {
            meta.classesTaught.forEach((c: any) => c && assignedClassesSet.add(String(c).trim()));
          }
          if (Array.isArray(meta.assignedClasses)) {
            meta.assignedClasses.forEach((c: any) => c && assignedClassesSet.add(String(c).trim()));
          }
          if (Array.isArray(meta.subjects)) {
            meta.subjects.forEach((s: any) => s && assignedSubjectsSet.add(String(s).trim()));
          }
        } catch { }
      }
    }

    // 2. Timetable records
    const timetable = await basePrisma.timetable.findMany({
      where: { schoolId, staffId },
      include: { classroom: true, course: true },
    });

    for (const t of timetable) {
      if (t.classroom?.name) assignedClassesSet.add(t.classroom.name.trim());
      if (t.course?.name) assignedSubjectsSet.add(t.course.name.trim());
    }

    // 3. bonavee_staff_metadata check
    try {
      const metaRows = await basePrisma.$queryRawUnsafe<any[]>(
        `SELECT assigned_class, assigned_subjects, designation FROM bonavee_staff_metadata WHERE staff_id = $1 LIMIT 1`,
        staffId
      );
      if (metaRows && metaRows.length > 0) {
        const row = metaRows[0];
        if (row.assigned_class && typeof row.assigned_class === "string" && row.assigned_class.trim()) {
          assignedClassesSet.add(row.assigned_class.trim());
        }
        if (row.assigned_subjects && typeof row.assigned_subjects === "string" && row.assigned_subjects.trim()) {
          const parts = row.assigned_subjects.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean);
          parts.forEach((p: string) => assignedSubjectsSet.add(p));
        }
      }
    } catch { }
  } catch (err) {
    console.warn("[getStaffAssignedClassesAndSubjects] Warning:", err);
  }

  return {
    assignedClasses: Array.from(assignedClassesSet).filter(Boolean),
    assignedSubjects: Array.from(assignedSubjectsSet).filter(Boolean),
  };
}

/**
 * Verifies whether a teacher is authorized to access, record attendance, or submit grades for a class.
 */
export async function verifyTeacherClassAccess(
  schoolId: string,
  staffEmail: string | undefined,
  targetClass: string
): Promise<boolean> {
  if (!targetClass || !targetClass.trim()) return false;
  if (!staffEmail) return false;
  try {
    const staff = await basePrisma.staff.findFirst({
      where: { schoolId, email: staffEmail },
      select: { id: true, user: { select: { role: true } } },
    });
    if (!staff) return false;

    const userRole = (staff.user?.role || "").toUpperCase();
    if (["PRINCIPAL", "HEADMASTER"].includes(userRole)) {
      return true;
    }

    const { assignedClasses } = await getStaffAssignedClassesAndSubjects(schoolId, staff.id);
    const targetNorm = targetClass.trim().toLowerCase();

    return assignedClasses.some((cls) => {
      const clsNorm = cls.trim().toLowerCase();
      return (
        clsNorm === targetNorm ||
        targetNorm.startsWith(clsNorm + " ") ||
        clsNorm.startsWith(targetNorm + " ")
      );
    });
  } catch (err) {
    console.error("[verifyTeacherClassAccess] Error:", err);
    return false;
  }
}

/**
 * 1. Fetch classrooms, tiers, courses, active students, and current faculty profile strictly scoped to assigned classes
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
          user: { select: { role: true } },
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
          assignments: {
            include: {
              classroom: true,
              course: true,
            },
          },
        },
      });
    }

    if (!currentStaff && staffEmail) {
      const userRecord = await basePrisma.user.findFirst({
        where: { schoolId, email: staffEmail },
      });
      if (userRecord) {
        currentStaff = await basePrisma.staff.findFirst({
          where: { schoolId, userId: userRecord.id },
          include: {
            department: true,
            user: { select: { role: true } },
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
            assignments: {
              include: {
                classroom: true,
                course: true,
              },
            },
          },
        });
      }
    }

    // Strictly restrict colleague fallback to the public demo tenant when no staff email is provided
    if (!currentStaff && !staffEmail) {
      const schoolEntity = await basePrisma.school.findUnique({
        where: { id: schoolId },
        select: { subdomain: true },
      });
      if (schoolEntity?.subdomain?.toLowerCase() === "demo") {
        currentStaff = await basePrisma.staff.findFirst({
          where: { schoolId },
          include: {
            department: true,
            user: { select: { role: true } },
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
            assignments: {
              include: {
                classroom: true,
                course: true,
              },
            },
          },
        });
      }
    }

    // Resolve teacher's strictly assigned classes and subjects
    const { assignedClasses, assignedSubjects } = currentStaff
      ? await getStaffAssignedClassesAndSubjects(schoolId, currentStaff.id)
      : { assignedClasses: [], assignedSubjects: [] };

    const effectiveRole = (currentStaff?.user?.role || currentStaff?.role || "TEACHER").toUpperCase();
    const isTeacherRole = ["TEACHER", "STAFF", "INSTRUCTOR", "LECTURER", "PROFESSOR", "CLASS_TEACHER"].some((r) =>
      effectiveRole.includes(r)
    );

    const [school, lessonNotes, leaveRequests] = await Promise.all([
      basePrisma.school.findUnique({
        where: { id: schoolId },
        include: {
          academicTiers: {
            orderBy: { level: "asc" },
          },
        },
      }),
      currentStaff ? fetchStaffLessonNotesAction(schoolId, currentStaff.id) : Promise.resolve([]),
      currentStaff ? fetchStaffLeaveRequestsAction(schoolId, currentStaff.id) : Promise.resolve([]),
    ]);

    let classrooms: any[] = [];
    let courses: any[] = [];
    let students: any[] = [];

    if (isTeacherRole) {
      // STRICT TEACHER CLASS RESTRICTION:
      // If the teacher has assigned classes, they ONLY see their assigned classes and students in those classes.
      // If the teacher has NO assigned classes, they get 0 classes and 0 students.
      if (assignedClasses.length > 0) {
        const matchedClassrooms = await basePrisma.classroom.findMany({
          where: {
            schoolId,
            OR: assignedClasses.map((cls) => ({
              name: { equals: cls, mode: "insensitive" },
            })),
          },
          orderBy: { name: "asc" },
        });

        const classroomMap = new Map<string, any>();
        matchedClassrooms.forEach((c) => classroomMap.set(c.name.toLowerCase(), c));
        assignedClasses.forEach((clsName) => {
          if (!classroomMap.has(clsName.toLowerCase())) {
            classroomMap.set(clsName.toLowerCase(), {
              id: clsName,
              schoolId,
              name: clsName,
              capacity: 35,
              tierId: school?.academicTiers?.[0]?.id || null,
            });
          }
        });
        classrooms = Array.from(classroomMap.values());

        // Strictly query ONLY students enrolled in the teacher's assigned classes
        students = await basePrisma.student.findMany({
          where: {
            schoolId,
            status: { in: ["ENROLLED", "ACTIVE"] },
            OR: assignedClasses.flatMap((cls) => [
              { currentClass: { equals: cls, mode: "insensitive" } },
              { currentClass: { startsWith: cls + " ", mode: "insensitive" } },
            ]),
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
        });

        // Courses: filter to courses assigned to teacher or school courses matching teacher subjects
        if (assignedSubjects.length > 0) {
          courses = await basePrisma.course.findMany({
            where: {
              schoolId,
              OR: assignedSubjects.map((sub) => ({
                name: { equals: sub, mode: "insensitive" },
              })),
            },
            orderBy: { name: "asc" },
          });
          const existingCourseNames = new Set(courses.map((c) => c.name.toLowerCase()));
          assignedSubjects.forEach((subName) => {
            if (!existingCourseNames.has(subName.toLowerCase())) {
              courses.push({
                id: subName,
                schoolId,
                name: subName,
                code: subName.substring(0, 4).toUpperCase(),
              });
            }
          });
        } else {
          courses = await basePrisma.course.findMany({
            where: { schoolId },
            orderBy: { name: "asc" },
            take: 10,
          });
        }
      } else {
        // Teacher has no assigned classes yet: STRICT RESTRICTION - ZERO classrooms and ZERO students
        classrooms = [];
        students = [];
        courses = [];
      }
    } else {
      // Non-teaching or administrative oversight roles (Principal, Headmaster, etc.)
      const [allCls, allCourses, allStudents] = await Promise.all([
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
      classrooms = allCls;
      courses = allCourses;
      students = allStudents;
    }

    return {
      success: true,
      tiers: school?.academicTiers || [],
      classrooms,
      courses,
      students,
      lessonNotes,
      leaveRequests,
      assignedClasses,
      assignedSubjects,
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
      assignedClasses: [],
      assignedSubjects: [],
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
  records: AttendanceRecordPayload[],
  className?: string
) {
  try {
    const session = await getSession();
    if (session && session.email && className) {
      const allowed = await verifyTeacherClassAccess(schoolId, session.email, className);
      if (!allowed) {
        return {
          success: false,
          error: `Access Denied: You are not assigned to class "${className}". Teachers are strictly restricted to their assigned classes.`,
        };
      }
    }

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
 * Helper to get all term string variants to avoid mismatch between "1st Term" and "First Term"
 */
function getTermVariants(term: string): string[] {
  const t = (term || "").trim().toLowerCase();
  if (t.includes("1") || t.includes("first")) {
    return ["1st Term", "First Term", "Term 1", "first term", "1st term"];
  }
  if (t.includes("2") || t.includes("second")) {
    return ["2nd Term", "Second Term", "Term 2", "second term", "2nd term"];
  }
  if (t.includes("3") || t.includes("third")) {
    return ["3rd Term", "Third Term", "Term 3", "third term", "3rd term"];
  }
  return [term];
}

/**
 * 4. Fetch grade records for a cohort, subject, and term
 * Searches both GradeRecord and AcademicRecord with term-variant resilience.
 */
export async function fetchClassroomGrades(
  schoolId: string,
  className: string,
  subject: string,
  term: string
) {
  try {
    const session = await getSession();
    if (session && session.email) {
      const allowed = await verifyTeacherClassAccess(schoolId, session.email, className);
      if (!allowed) {
        return {
          success: false,
          error: `Access Denied: You are not assigned to class "${className}". Teachers are strictly restricted to their assigned classes.`,
          grades: [],
        };
      }
    }

    const termVariants = getTermVariants(term);

    // Fetch from GradeRecord and AcademicRecord in parallel
    const [gradeRecords, academicRecords] = await Promise.all([
      basePrisma.gradeRecord.findMany({
        where: {
          schoolId,
          className,
          subject: { equals: subject, mode: "insensitive" },
          term: { in: termVariants },
        },
      }),
      basePrisma.academicRecord.findMany({
        where: {
          schoolId,
          className,
          subject: { equals: subject, mode: "insensitive" },
          term: { in: termVariants },
        },
      }),
    ]);

    // Map by studentId, prioritizing GradeRecord, with fallback to AcademicRecord
    const mergedMap = new Map<string, any>();

    for (const ar of academicRecords) {
      mergedMap.set(ar.studentId, {
        id: ar.id,
        studentId: ar.studentId,
        className: ar.className || className,
        subject: ar.subject,
        term: ar.term,
        ca1: Number(ar.test1) || 0,
        ca2: Number(ar.test2) || 0,
        exam: Number(ar.finalExam) || 0,
        totalScore: Number(ar.totalScore) || ((Number(ar.test1) || 0) + (Number(ar.test2) || 0) + (Number(ar.finalExam) || 0)),
        teacherRemarks: ar.teacherRemarks || "",
      });
    }

    for (const gr of gradeRecords) {
      const existing = mergedMap.get(gr.studentId);
      mergedMap.set(gr.studentId, {
        id: gr.id,
        studentId: gr.studentId,
        className: gr.className,
        subject: gr.subject,
        term: gr.term,
        ca1: Number(gr.ca1) || 0,
        ca2: Number(gr.ca2) || 0,
        exam: Number(gr.exam) || 0,
        totalScore: Number(gr.totalScore) || ((Number(gr.ca1) || 0) + (Number(gr.ca2) || 0) + (Number(gr.exam) || 0)),
        teacherRemarks: existing?.teacherRemarks || "",
      });
    }

    return {
      success: true,
      grades: Array.from(mergedMap.values()),
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
 * 5. Save or update assessment grade records (synced to GradeRecord, AcademicRecord, and ExamResult)
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
    // School Admin Authorization Check: Admins cannot record grades in teacher gradebooks
    const session = await getSession();
    if (session) {
      const role = (session.role || session.userRole || "").toUpperCase();
      if (["SCHOOL_ADMIN", "TENANT_ADMIN", "ADMIN"].includes(role)) {
        return {
          success: false,
          error: "Permission Denied: School Administrators do not have access to record or edit marks in teacher gradebooks.",
        };
      }
      if (session.email) {
        const allowed = await verifyTeacherClassAccess(schoolId, session.email, className);
        if (!allowed) {
          return {
            success: false,
            error: `Access Denied: You are not assigned to class "${className}". Teachers are strictly restricted to their assigned classes.`,
          };
        }
      }
    }

    // 1. Lock Check: If Head Teacher / Principal approved or locked, reject edit
    const lockedReport = await basePrisma.reportCard.findFirst({
      where: {
        schoolId,
        className,
        term,
        status: { in: ["APPROVED", "LOCKED"] },
      },
    });
    if (lockedReport) {
      return {
        success: false,
        error: `Grades for ${className} (${term}) have been approved and locked by the Head Teacher / Principal. Modification requires administrative unlock.`,
      };
    }

    const classTier = getTierForClass(className);
    const isCreche = isCrecheClass(className);
    const isNursery = !isCreche && (isNurseryClass(className) || classTier.category === "NURSERY");
    const isSecondary = classTier.category === "SECONDARY";
    const isTertiary = classTier.category === "TERTIARY" || isTertiaryClass(className);
    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { tierDatabasesConfig: true, tier: true },
    });
    const crecheConfig = resolveCrecheConfig(school);
    const nurseryConfig = resolveNurseryConfig(school);
    const tertiaryCourse = isTertiary ? resolveTertiaryCourse(subject) : null;
    const isPrimary = !isCreche && !isNursery && !isSecondary && !isTertiary;

    // Validation
    if (isTertiary && tertiaryCourse) {
      for (const item of grades) {
        if (item.ca1 !== undefined && item.ca1 !== null && (item.ca1 < 0 || item.ca1 > tertiaryCourse.caWeight)) {
          return {
            success: false,
            error: `Validation Error: CA score (${item.ca1}) is out of range for ${tertiaryCourse.code}. Allowed range is 0 - ${tertiaryCourse.caWeight}.`,
          };
        }
        if (item.exam !== undefined && item.exam !== null && (item.exam < 0 || item.exam > tertiaryCourse.examWeight)) {
          return {
            success: false,
            error: `Validation Error: Exam score (${item.exam}) is out of range for ${tertiaryCourse.code}. Allowed range is 0 - ${tertiaryCourse.examWeight}.`,
          };
        }
      }
    } else if (isNursery) {
      for (const item of grades) {
        if (item.ca1 !== undefined && item.ca1 !== null && (item.ca1 < 0 || item.ca1 > nurseryConfig.ca1Max)) {
          return {
            success: false,
            error: `Validation Error: ${nurseryConfig.ca1Name} score (${item.ca1}) is out of range. Allowed range is 0 - ${nurseryConfig.ca1Max}.`,
          };
        }
        if (item.ca2 !== undefined && item.ca2 !== null && (item.ca2 < 0 || item.ca2 > nurseryConfig.ca2Max)) {
          return {
            success: false,
            error: `Validation Error: ${nurseryConfig.ca2Name} score (${item.ca2}) is out of range. Allowed range is 0 - ${nurseryConfig.ca2Max}.`,
          };
        }
        if (nurseryConfig.hasExam) {
          if (item.exam !== undefined && item.exam !== null && (item.exam < 0 || item.exam > nurseryConfig.examMax)) {
            return {
              success: false,
              error: `Validation Error: Exam score (${item.exam}) is out of range. Allowed range is 0 - ${nurseryConfig.examMax}.`,
            };
          }
        }
      }
    } else if (isCreche) {
      for (const item of grades) {
        if (item.ca1 !== undefined && item.ca1 !== null && (item.ca1 < 0 || item.ca1 > crecheConfig.ca1Max)) {
          return {
            success: false,
            error: `Validation Error: ${crecheConfig.ca1Name} score (${item.ca1}) is out of range. Allowed range is 0 - ${crecheConfig.ca1Max}.`,
          };
        }
        if (item.ca2 !== undefined && item.ca2 !== null && (item.ca2 < 0 || item.ca2 > crecheConfig.ca2Max)) {
          return {
            success: false,
            error: `Validation Error: ${crecheConfig.ca2Name} score (${item.ca2}) is out of range. Allowed range is 0 - ${crecheConfig.ca2Max}.`,
          };
        }
        if (crecheConfig.hasExam) {
          if (item.exam !== undefined && item.exam !== null && (item.exam < 0 || item.exam > crecheConfig.examMax)) {
            return {
              success: false,
              error: `Validation Error: Exam score (${item.exam}) is out of range. Allowed range is 0 - ${crecheConfig.examMax}.`,
            };
          }
        }
      }
    } else {
      // Primary & Secondary NERDC Validation: 1st CA (0-20), 2nd CA (0-20), Exam (0-60)
      for (const item of grades) {
        if (item.ca1 !== undefined && item.ca1 !== null && (item.ca1 < 0 || item.ca1 > 20)) {
          return {
            success: false,
            error: `Validation Error: 1st CA score (${item.ca1}) is out of range. Allowed range is 0 - 20.`,
          };
        }
        if (item.ca2 !== undefined && item.ca2 !== null && (item.ca2 < 0 || item.ca2 > 20)) {
          return {
            success: false,
            error: `Validation Error: 2nd CA score (${item.ca2}) is out of range. Allowed range is 0 - 20.`,
          };
        }
        if (item.exam !== undefined && item.exam !== null && (item.exam < 0 || item.exam > 60)) {
          return {
            success: false,
            error: `Validation Error: Exam score (${item.exam}) is out of range. Allowed range is 0 - 60.`,
          };
        }
      }
    }

    const tenantDb = getTenantClient(schoolId);

    // Helper to resolve grade letter
    function getGradeLetter(total: number): string {
      if (isTertiary) {
        return mapTertiaryScoreToGrade(total, "4.0").letter;
      }
      if (isNursery) {
        return mapNurseryScoreToGrade(total).letter;
      }
      if (isCreche) {
        return mapCrecheScoreToGrade(total).letter;
      }
      if (isSecondary) {
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
      if (isPrimary) {
        if (total >= 75) return "Distinction";
        if (total >= 65) return "Very Good";
        if (total >= 50) return "Credit";
        if (total >= 40) return "Pass";
        return "Fail";
      }
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

    // 1. Resolve or create Course & Exam in tenantDb for legacy exam broadsheet consistency
    let examRec: any = null;
    try {
      let course = await tenantDb.course.findFirst({
        where: {
          schoolId,
          OR: [{ name: { equals: subject, mode: "insensitive" } }, { id: subject }],
        },
      });
      if (!course) {
        course = await tenantDb.course.create({
          data: {
            schoolId,
            name: subject,
            code: subject.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "") + "101",
          },
        });
      }

      examRec = await tenantDb.exam.findFirst({
        where: {
          schoolId,
          courseId: course.id,
          semester: term,
        },
      });
      if (!examRec) {
        examRec = await tenantDb.exam.create({
          data: {
            schoolId,
            courseId: course.id,
            name: `${subject} (${term})`,
            semester: term,
            date: new Date(),
            maxScore: 100,
          },
        });
      }
    } catch (e) {
      console.warn("[saveClassroomGrades] Course/Exam link fallback notice:", e);
    }

    await basePrisma.$transaction(async (tx) => {
      for (const item of grades) {
        const ca1 = isNursery
          ? Math.min(nurseryConfig.ca1Max, Math.max(0, Number(item.ca1) || 0))
          : (isCreche
            ? Math.min(crecheConfig.ca1Max, Math.max(0, Number(item.ca1) || 0))
            : (isTertiary
              ? Math.min(tertiaryCourse?.caWeight || 30, Math.max(0, Number(item.ca1) || 0))
              : Math.min(20, Math.max(0, Number(item.ca1) || 0))));
        const ca2 = isTertiary
          ? 0 // ca2 NOT USED for Tertiary
          : (isNursery
            ? Math.min(nurseryConfig.ca2Max, Math.max(0, Number(item.ca2) || 0))
            : (isCreche
              ? Math.min(crecheConfig.ca2Max, Math.max(0, Number(item.ca2) || 0))
              : Math.min(20, Math.max(0, Number(item.ca2) || 0))));
        const exam = isNursery
          ? (nurseryConfig.hasExam ? Math.min(nurseryConfig.examMax, Math.max(0, Number(item.exam) || 0)) : 0)
          : (isCreche
            ? (crecheConfig.hasExam ? Math.min(crecheConfig.examMax, Math.max(0, Number(item.exam) || 0)) : 0)
            : (isTertiary
              ? Math.min(tertiaryCourse?.examWeight || 70, Math.max(0, Number(item.exam) || 0))
              : Math.min(60, Math.max(0, Number(item.exam) || 0))));
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

        // 3. Upsert ExamResult if examRec exists
        if (examRec) {
          await tx.examResult.upsert({
            where: {
              schoolId_examId_studentId: {
                schoolId,
                examId: examRec.id,
                studentId: item.studentId,
              },
            },
            update: {
              score: total,
              ca1Score: ca1,
              ca2Score: ca2,
              examScore: exam,
              letterGrade: letter,
              remarks: item.teacherRemarks || null,
              updatedAt: new Date(),
            },
            create: {
              schoolId,
              examId: examRec.id,
              studentId: item.studentId,
              score: total,
              ca1Score: ca1,
              ca2Score: ca2,
              examScore: exam,
              letterGrade: letter,
              remarks: item.teacherRemarks || null,
            },
          }).catch(() => { });
        }
      }
    });

    const now = new Date();
    const timestampStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    // Record Grade Audit Log
    try {
      await basePrisma.auditLog.create({
        data: {
          schoolId,
          action: "GRADE_RECORD_SAVE",
          target: `${className} - ${subject} (${term})`,
          metadata: {
            className,
            subject,
            term,
            academicYear,
            studentCount: grades.length,
            timestamp: now.toISOString(),
          },
        },
      });
    } catch (auditErr) {
      console.warn("[saveClassroomGrades] Audit log fallback:", auditErr);
    }

    // Invalidate caches & revalidate paths so Admin broadsheet immediately reflects
    await invalidateGradingNamespace(schoolId);
    safeRevalidate(`/[schoolDomain]/exams`, "page");
    safeRevalidate(`/[schoolDomain]/portal/staff`, "page");
    safeRevalidate(`/[schoolDomain]/report-cards`, "page");

    return { success: true, count: grades.length, timestamp: timestampStr };
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
    const session = await getSession();
    if (session && session.email) {
      const allowed = await verifyTeacherClassAccess(schoolId, session.email, className);
      if (!allowed) {
        return {
          success: false,
          error: `Access Denied: You are not assigned to class "${className}". Teachers are strictly restricted to their assigned classes.`,
        };
      }
    }

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
    const session = await getSession();
    if (session && session.email && note.className) {
      const allowed = await verifyTeacherClassAccess(schoolId, session.email, note.className);
      if (!allowed) {
        return {
          success: false,
          error: `Access Denied: You are not assigned to class "${note.className}". Teachers are strictly restricted to their assigned classes.`,
        };
      }
    }

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
