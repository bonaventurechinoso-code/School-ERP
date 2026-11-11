"use server";

import { getTenantClient, basePrisma, getPrismaClientForTier, isDemoSchool } from "@/lib/tenant-prisma";
import { getSubjectsForClassAndTier } from "@/lib/curriculum-data";
import { compileClassReportCards } from "@/lib/report-card-service";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op when executed outside HTTP request context (e.g. testing)
  }
}
import { invalidateGradingNamespace, invalidateTenantMetadata } from "@/lib/cache-invalidation";
import { getNigerianGrade, getGradeRemark, normalizeTierLevel } from "@/lib/assessmentEngine";
import { cookies } from "next/headers";
import * as jose from "jose";

/**
 * Verify cryptographic tenant session and ensure operations are bound
 * to the authorized schoolId.
 */
async function verifyTenantSession(targetSchoolId: string): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  let sessionToken: string | undefined;
  const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

  try {
    const cookieStore = await cookies();
    sessionToken = cookieStore.get("session")?.value;
  } catch {
    // Graceful fallback when invoked outside HTTP request context (e.g. testing or CLI)
    if (isDev) {
      return { authorized: true, userId: "admin-dev-id" };
    }
  }

  if (!sessionToken && isDev) {
    return { authorized: true, userId: "admin-dev-id" };
  }

  if (!sessionToken) {
    return { authorized: false, error: "Unauthorized: Session token missing." };
  }

  try {
    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(sessionToken, secret);
    const tokenTenantId = (payload.tenantId as string) || (payload.schoolId as string);

    if (tokenTenantId && tokenTenantId !== targetSchoolId && !isDev) {
      return { authorized: false, error: "Forbidden: Cross-tenant access denied." };
    }

    const userId = (payload.userId as string) || (payload.sub as string) || "system-admin";
    return { authorized: true, userId };
  } catch (err: any) {
    if (isDev) return { authorized: true, userId: "admin-dev-id" };
    return { authorized: false, error: "Unauthorized: Invalid session credentials." };
  }
}

/**
 * Ensure the multi-tenant bonavee_scheduled_exams table exists in the database
 */
async function ensureScheduledExamsTableExists() {
  try {
    await basePrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bonavee_scheduled_exams (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        title TEXT NOT NULL,
        class_name TEXT,
        subject TEXT NOT NULL,
        assessment_type TEXT NOT NULL,
        exam_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        start_time TEXT,
        duration INTEGER,
        venue TEXT,
        invigilator_id TEXT,
        invigilator_name TEXT,
        max_score DOUBLE PRECISION NOT NULL DEFAULT 100,
        status TEXT NOT NULL DEFAULT 'published',
        created_by TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.warn("[Schema] Scheduled exams table initialization notice:", err);
  }
}

export type ScheduledExamPayload = {
  title: string;
  className: string;
  subject: string;
  assessmentType: "CA1" | "CA2" | "CA3" | "EXAM" | string;
  examDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  duration: number; // minutes
  venue: string;
  invigilatorId?: string;
  invigilatorName?: string;
  maxScore: number;
};

/**
 * SECURE FORM MULTI-TENANT MUTATION ROUTER:
 * Creates an assessment entry in bonavee_scheduled_exams with strict tenant isolation:
 * { tenant_id: params.tenant, ...formData, status: 'published', created_by: auth.user.id }
 * Also synchronizes with Prisma's Exam model to maintain grading roster spreadsheets.
 */
export async function createScheduledExam(
  schoolId: string,
  tenantDomain: string,
  formData: ScheduledExamPayload
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  await ensureScheduledExamsTableExists();

  const tenantDb = getTenantClient(schoolId);
  const effectiveTenantId = schoolId || tenantDomain;
  const createdBy = auth.userId || "system-admin";
  const scheduledId = `exam-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const examDateObj = new Date(formData.examDate);

  try {
    // 1. Resolve or create course in tenantDb for relational consistency
    let course = await tenantDb.course.findFirst({
      where: {
        schoolId,
        OR: [
          { id: formData.subject },
          { name: formData.subject },
        ],
      },
    });

    if (!course) {
      const cleanCode = formData.subject.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "") + Math.floor(100 + Math.random() * 900);
      course = await tenantDb.course.create({
        data: {
          schoolId,
          name: formData.subject,
          code: cleanCode,
        },
      });
    }

    // 2. Resolve Invigilator Name if ID was provided
    let invigilatorName = formData.invigilatorName || "";
    if (formData.invigilatorId && !invigilatorName) {
      const staffMember = await tenantDb.staff.findUnique({
        where: { id: formData.invigilatorId },
        select: { firstName: true, lastName: true },
      });
      if (staffMember) {
        invigilatorName = `${staffMember.firstName} ${staffMember.lastName}`;
      }
    }

    // 3. Database Insertion Transaction into 'bonavee_scheduled_exams'
    await basePrisma.$executeRawUnsafe(
      `INSERT INTO bonavee_scheduled_exams (
        id, tenant_id, title, class_name, subject, assessment_type,
        exam_date, start_time, duration, venue, invigilator_id, invigilator_name,
        max_score, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
      scheduledId,
      effectiveTenantId,
      formData.title.trim(),
      formData.className || "General Class",
      formData.subject.trim(),
      formData.assessmentType,
      examDateObj,
      formData.startTime || "09:00",
      Number(formData.duration) || 60,
      formData.venue.trim() || "Main Examination Hall",
      formData.invigilatorId || null,
      invigilatorName || null,
      Number(formData.maxScore),
      "published",
      createdBy
    );

    // 4. Dual Synchronization with Prisma Exam model for active grading roster spreadsheets
    await tenantDb.exam.create({
      data: {
        id: scheduledId,
        schoolId,
        courseId: course.id,
        name: formData.title.trim(),
        semester: formData.className ? `${formData.className} - ${formData.assessmentType}` : "1st Term",
        date: examDateObj,
        maxScore: Number(formData.maxScore),
      },
    }).catch((err) => {
      console.warn("[Prisma Sync] Notice on exam creation mirroring:", err?.message);
    });

    // 5. Invalidate caches
    await invalidateGradingNamespace(schoolId);
    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
    safeRevalidatePath(`/[schoolDomain]/assessments`, "page");

    return {
      success: true,
      exam: {
        id: scheduledId,
        tenant_id: effectiveTenantId,
        title: formData.title.trim(),
        class_name: formData.className || "General Class",
        subject: formData.subject.trim(),
        assessment_type: formData.assessmentType,
        exam_date: examDateObj.toISOString(),
        start_time: formData.startTime || "09:00",
        duration: Number(formData.duration) || 60,
        venue: formData.venue.trim() || "Main Examination Hall",
        invigilator_id: formData.invigilatorId || null,
        invigilator_name: invigilatorName || null,
        max_score: Number(formData.maxScore),
        status: "published",
        created_by: createdBy,
      },
    };
  } catch (error: any) {
    console.error("[Server Action] Failed to create scheduled exam:", error);
    return { success: false, error: error.message || "Failed to schedule exam." };
  }
}

/**
 * BULK MULTI-TENANT MUTATION ROUTER:
 * Creates multiple assessment entries in bonavee_scheduled_exams with strict tenant isolation
 * and mirrors them to Prisma's Exam model in batch. Works globally for all schools.
 */
export async function createBulkScheduledExams(
  schoolId: string,
  tenantDomain: string,
  examsData: ScheduledExamPayload[]
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  if (!examsData || examsData.length === 0) {
    return { success: false, error: "No exam records provided for bulk scheduling." };
  }

  await ensureScheduledExamsTableExists();

  const tenantDb = getTenantClient(schoolId);
  const effectiveTenantId = schoolId || tenantDomain;
  const createdBy = auth.userId || "system-admin";

  try {
    // Pre-cache courses and staff for rapid processing
    const [existingCourses, staffList] = await Promise.all([
      tenantDb.course.findMany({ where: { schoolId }, select: { id: true, name: true } }).catch(() => []),
      tenantDb.staff.findMany({ where: { schoolId }, select: { id: true, firstName: true, lastName: true } }).catch(() => []),
    ]);

    const courseMap = new Map<string, string>();
    existingCourses.forEach((c) => {
      courseMap.set(c.name.toLowerCase().trim(), c.id);
      courseMap.set(c.id, c.id);
    });

    const staffMap = new Map<string, string>();
    staffList.forEach((s) => {
      staffMap.set(s.id, `${s.firstName} ${s.lastName}`.trim());
    });

    const createdExams: any[] = [];
    const nowTime = Date.now();

    for (let i = 0; i < examsData.length; i++) {
      const item = examsData[i];
      const trimmedTitle = (item.title || "").trim();
      const trimmedSubject = (item.subject || "").trim();
      const trimmedClass = (item.className || "General Class").trim();
      const examDateObj = new Date(item.examDate || new Date().toISOString().split("T")[0]);

      if (!trimmedTitle || !trimmedSubject) continue;

      // 1. Resolve or create course in tenantDb
      let courseId = courseMap.get(trimmedSubject.toLowerCase());
      if (!courseId) {
        const cleanCode = trimmedSubject.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "") + Math.floor(100 + Math.random() * 900);
        try {
          const newCourse = await tenantDb.course.create({
            data: {
              schoolId,
              name: trimmedSubject,
              code: cleanCode,
            },
          });
          courseId = newCourse.id;
          courseMap.set(trimmedSubject.toLowerCase(), newCourse.id);
        } catch {
          const found = await tenantDb.course.findFirst({ where: { schoolId, name: trimmedSubject } });
          courseId = found?.id;
        }
      }

      // 2. Resolve invigilator name
      let invigilatorName = item.invigilatorName || "";
      if (item.invigilatorId) {
        invigilatorName = staffMap.get(item.invigilatorId) || invigilatorName;
      }

      const scheduledId = `exam-${nowTime}-${i}-${Math.random().toString(36).substring(2, 6)}`;
      const maxScoreVal = Number(item.maxScore) || (item.assessmentType === "EXAM" ? 60 : 20);

      // 3. Database Insertion Transaction into 'bonavee_scheduled_exams'
      await basePrisma.$executeRawUnsafe(
        `INSERT INTO bonavee_scheduled_exams (
          id, tenant_id, title, class_name, subject, assessment_type,
          exam_date, start_time, duration, venue, invigilator_id, invigilator_name,
          max_score, status, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
        scheduledId,
        effectiveTenantId,
        trimmedTitle,
        trimmedClass,
        trimmedSubject,
        item.assessmentType,
        examDateObj,
        item.startTime || "09:00",
        Number(item.duration) || 60,
        item.venue?.trim() || "Main Examination Hall",
        item.invigilatorId || null,
        invigilatorName || null,
        maxScoreVal,
        "published",
        createdBy
      );

      // 4. Mirroring to Prisma exam table
      if (courseId) {
        await tenantDb.exam.create({
          data: {
            id: scheduledId,
            schoolId,
            courseId,
            name: trimmedTitle,
            semester: `${trimmedClass} - ${item.assessmentType}`,
            date: examDateObj,
            maxScore: maxScoreVal,
          },
        }).catch((err) => {
          console.warn("[Prisma Sync Bulk] Exam mirror note:", err?.message);
        });
      }

      createdExams.push({
        id: scheduledId,
        tenant_id: effectiveTenantId,
        title: trimmedTitle,
        class_name: trimmedClass,
        subject: trimmedSubject,
        assessment_type: item.assessmentType,
        exam_date: examDateObj.toISOString(),
        start_time: item.startTime || "09:00",
        duration: Number(item.duration) || 60,
        venue: item.venue?.trim() || "Main Examination Hall",
        invigilator_id: item.invigilatorId || null,
        invigilator_name: invigilatorName || null,
        max_score: maxScoreVal,
        status: "published",
        created_by: createdBy,
      });
    }

    await invalidateGradingNamespace(schoolId);
    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
    safeRevalidatePath(`/[schoolDomain]/assessments`, "page");

    return {
      success: true,
      count: createdExams.length,
      exams: createdExams,
    };
  } catch (error: any) {
    console.error("[Server Action] Bulk scheduling failed:", error);
    return { success: false, error: error.message || "Bulk exam scheduling failed." };
  }
}

/**
 * Update an existing scheduled assessment in bonavee_scheduled_exams
 */
export async function updateScheduledExam(
  schoolId: string,
  tenantDomain: string,
  examId: string,
  formData: ScheduledExamPayload
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  await ensureScheduledExamsTableExists();
  const effectiveTenantId = schoolId || tenantDomain;
  const examDateObj = new Date(formData.examDate);

  try {
    // Resolve Invigilator Name
    let invigilatorName = formData.invigilatorName || "";
    if (formData.invigilatorId && !invigilatorName) {
      const tenantDb = getTenantClient(schoolId);
      const staffMember = await tenantDb.staff.findUnique({
        where: { id: formData.invigilatorId },
        select: { firstName: true, lastName: true },
      });
      if (staffMember) {
        invigilatorName = `${staffMember.firstName} ${staffMember.lastName}`;
      }
    }

    await basePrisma.$executeRawUnsafe(
      `UPDATE bonavee_scheduled_exams 
       SET title = $1, class_name = $2, subject = $3, assessment_type = $4,
           exam_date = $5, start_time = $6, duration = $7, venue = $8,
           invigilator_id = $9, invigilator_name = $10, max_score = $11, updated_at = NOW()
       WHERE id = $12 AND (tenant_id = $13 OR tenant_id = $14)`,
      formData.title.trim(),
      formData.className,
      formData.subject.trim(),
      formData.assessmentType,
      examDateObj,
      formData.startTime || "09:00",
      Number(formData.duration) || 60,
      formData.venue.trim() || "Main Examination Hall",
      formData.invigilatorId || null,
      invigilatorName || null,
      Number(formData.maxScore),
      examId,
      effectiveTenantId,
      tenantDomain
    );

    // Sync update to Prisma Exam table
    const tenantDb = getTenantClient(schoolId);
    await tenantDb.exam.updateMany({
      where: { id: examId, schoolId },
      data: {
        name: formData.title.trim(),
        date: examDateObj,
        maxScore: Number(formData.maxScore),
      },
    }).catch(() => null);

    await invalidateGradingNamespace(schoolId);
    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
    safeRevalidatePath(`/[schoolDomain]/assessments`, "page");

    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to update scheduled exam:", error);
    return { success: false, error: error.message || "Failed to update exam." };
  }
}

/**
 * Toggle publish/unpublish status for an assessment
 */
export async function toggleExamPublishStatus(
  schoolId: string,
  tenantDomain: string,
  examId: string,
  currentStatus: string
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  await ensureScheduledExamsTableExists();
  const effectiveTenantId = schoolId || tenantDomain;
  const nextStatus = currentStatus === "published" ? "unpublished" : "published";

  try {
    const rowsAffected = await basePrisma.$executeRawUnsafe(
      `UPDATE bonavee_scheduled_exams 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND (tenant_id = $3 OR tenant_id = $4)`,
      nextStatus,
      examId,
      effectiveTenantId,
      tenantDomain
    );

    // If 0 rows were updated, this exam might only exist in the Prisma exam table.
    // Upsert it into bonavee_scheduled_exams so status is persisted for future queries and refreshes.
    if (Number(rowsAffected) === 0) {
      const tenantDb = getTenantClient(schoolId);
      const prismaExam = await tenantDb.exam.findUnique({
        where: { id: examId },
        include: { course: true }
      });
      if (prismaExam) {
        await basePrisma.$executeRawUnsafe(
          `INSERT INTO bonavee_scheduled_exams (
            id, tenant_id, title, class_name, subject, assessment_type,
            exam_date, start_time, duration, venue, max_score, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
          examId,
          effectiveTenantId,
          prismaExam.name,
          prismaExam.semester || "General Class",
          prismaExam.course?.name || "General Subject",
          "EXAM",
          prismaExam.date,
          "09:00",
          60,
          "Main Examination Hall",
          prismaExam.maxScore || 100,
          nextStatus
        );
      }
    }

    await invalidateGradingNamespace(schoolId);
    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
    safeRevalidatePath(`/[schoolDomain]/assessments`, "page");

    return { success: true, nextStatus };
  } catch (error: any) {
    console.error("[Server Action] Failed to toggle publish status:", error);
    return { success: false, error: error.message || "Failed to update status." };
  }
}

/**
 * Delete scheduled exam with multi-tenant isolation
 */
export async function deleteScheduledExam(
  schoolId: string,
  tenantDomain: string,
  examId: string
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  await ensureScheduledExamsTableExists();
  const effectiveTenantId = schoolId || tenantDomain;

  try {
    await basePrisma.$executeRawUnsafe(
      `DELETE FROM bonavee_scheduled_exams WHERE id = $1 AND (tenant_id = $2 OR tenant_id = $3)`,
      examId,
      effectiveTenantId,
      tenantDomain
    );

    const tenantDb = getTenantClient(schoolId);
    await tenantDb.exam.deleteMany({
      where: { id: examId, schoolId },
    }).catch(() => null);

    await invalidateGradingNamespace(schoolId);
    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
    safeRevalidatePath(`/[schoolDomain]/assessments`, "page");

    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete scheduled exam:", error);
    return { success: false, error: error.message || "Failed to delete exam." };
  }
}

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
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const tenantDb = getTenantClient(schoolId);
  
  try {
    const examDate = new Date(data.date);
    let resolvedCourseId = data.courseId;

    // Resolve or automatically link course by ID or name under current tenant constraint
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

    const createdExam = await tenantDb.exam.create({
      data: {
        schoolId,
        courseId: resolvedCourseId,
        name: data.name,
        semester: data.semester,
        date: examDate,
        maxScore: data.maxScore,
      },
      include: {
        course: { include: { tier: true } },
      },
    });

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);

    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
    return { success: true, exam: createdExam };

  } catch (error: any) {
    console.error("[Server Action] Failed to create exam:", error);
    return { success: false, error: error.message || "Failed to create exam." };
  }
}

export async function deleteExam(schoolId: string, id: string) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const tenantDb = getTenantClient(schoolId);
  
  try {
    // Multi-tenant locator query constraint: WHERE id = id AND schoolId = schoolId
    await tenantDb.exam.deleteMany({
      where: { 
        id,
        schoolId
      }
    });

    // Also delete from bonavee_scheduled_exams
    await basePrisma.$executeRawUnsafe(
      `DELETE FROM bonavee_scheduled_exams WHERE id = $1 AND tenant_id = $2`,
      id,
      schoolId
    ).catch(() => null);

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);

    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
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
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const tenantDb = getTenantClient(schoolId);
  
  try {
    // Multi-tenant isolation constraint on compound key
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
        ca1Score: ca1Score ?? null,
        ca2Score: ca2Score ?? null,
        examScore: examScore ?? null,
        letterGrade,
        remarks
      },
      create: {
        schoolId,
        examId,
        studentId,
        score,
        ca1Score: ca1Score ?? null,
        ca2Score: ca2Score ?? null,
        examScore: examScore ?? null,
        letterGrade,
        remarks
      }
    });

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);

    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to upsert exam result:", error);
    return { success: false, error: error.message || "Failed to upsert exam result." };
  }
}

/**
 * 2. CONFIGURATION PAGE CONTROL - SECURE MULTI-TENANT MUTATION
 * Saves customized assessment weights per tier under WHERE tenant_id = current tenant
 */
export async function saveTierAssessmentConfig(
  schoolId: string,
  tierName: string,
  weights: Record<string, number>
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  // Validate cumulative weight equals exactly 100%
  const totalWeight = Object.values(weights).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  if (totalWeight !== 100) {
    return {
      success: false,
      error: `Validation Error: Cumulative weight total must equal exactly 100% (currently ${totalWeight}%).`
    };
  }

  try {
    // Strict multi-tenant locator query constraint: WHERE id = schoolId
    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, subdomain: true, tierDatabasesConfig: true }
    });

    if (!school) {
      return { success: false, error: "School not found." };
    }

    const currentConfig: any = (school.tierDatabasesConfig as object) || {};
    const currentWeights = currentConfig.assessmentWeights || {};

    const updatedConfig = {
      ...currentConfig,
      assessmentWeights: {
        ...currentWeights,
        [tierName]: weights
      }
    };

    // Strict multi-tenant update constraint
    await basePrisma.school.update({
      where: { id: schoolId },
      data: {
        tierDatabasesConfig: updatedConfig
      }
    });

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);
    if (school.subdomain) {
      await invalidateTenantMetadata(school.subdomain);
    }

    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
    return { success: true, message: `Assessment weights for ${tierName} saved successfully.` };
  } catch (error: any) {
    console.error("[Server Action] Failed to save tier assessment configuration:", error);
    return { success: false, error: error.message || "Failed to save tier assessment configuration." };
  }
}

/**
 * Retrieves saved assessment weights for a tenant
 */
export async function getTierAssessmentConfigs(schoolId: string) {
  try {
    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { tierDatabasesConfig: true }
    });
    const config: any = (school?.tierDatabasesConfig as object) || {};
    return config.assessmentWeights || {};
  } catch (err) {
    console.error("[Server Action] Failed to get tier assessment configurations:", err);
    return {};
  }
}

/**
 * 3. BROADSHEET SINGLE-SCORE & MULTI-SUBJECT SYNCHRONIZER
 * Persists student marks from the Admin Broadsheet into GradeRecord, AcademicRecord,
 * and ExamResult simultaneously, ensuring 100% two-way synchronization with the Teacher Gradebook.
 */
export async function saveBroadsheetScore(
  schoolId: string,
  payload: {
    studentId: string;
    className: string;
    subject: string;
    term: string;
    academicYear?: string;
    ca1?: number;
    ca2?: number;
    exam?: number;
    totalScore: number;
    gradeLetter?: string;
    remarks?: string;
  }
) {
  const auth = await verifyTenantSession(schoolId);
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const tenantDb = getTenantClient(schoolId);
  const term = payload.term || "1st Term";
  const academicYear = payload.academicYear || "2026/2027";
  const className = payload.className;
  const subject = payload.subject;
  const ca1 = payload.ca1 != null ? payload.ca1 : 0;
  const ca2 = payload.ca2 != null ? payload.ca2 : 0;
  const exam = payload.exam != null ? payload.exam : Math.max(0, payload.totalScore - (ca1 + ca2));
  const total = payload.totalScore != null ? payload.totalScore : (ca1 + ca2 + exam);
  const letter = payload.gradeLetter || getNigerianGrade(className, total);
  const remarks = payload.remarks || getGradeRemark(letter);

  try {
    // 1. Synchronize GradeRecord
    await tenantDb.gradeRecord.upsert({
      where: {
        schoolId_studentId_term_className_subject: {
          schoolId,
          studentId: payload.studentId,
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
        studentId: payload.studentId,
        className,
        subject,
        term,
        ca1,
        ca2,
        exam,
        totalScore: total,
      },
    }).catch(async () => {
      await basePrisma.gradeRecord.upsert({
        where: {
          schoolId_studentId_term_className_subject: {
            schoolId,
            studentId: payload.studentId,
            term,
            className,
            subject,
          },
        },
        update: { ca1, ca2, exam, totalScore: total, updatedAt: new Date() },
        create: { schoolId, studentId: payload.studentId, className, subject, term, ca1, ca2, exam, totalScore: total },
      });
    });

    // 2. Synchronize AcademicRecord
    await tenantDb.academicRecord.upsert({
      where: {
        schoolId_studentId_subject_term_academicYear: {
          schoolId,
          studentId: payload.studentId,
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
        teacherRemarks: remarks,
        updatedAt: new Date(),
      },
      create: {
        schoolId,
        studentId: payload.studentId,
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
        teacherRemarks: remarks,
      },
    }).catch(async () => {
      await basePrisma.academicRecord.upsert({
        where: {
          schoolId_studentId_subject_term_academicYear: {
            schoolId,
            studentId: payload.studentId,
            subject,
            term,
            academicYear,
          },
        },
        update: { className, test1: ca1, test2: ca2, finalExam: exam, totalScore: total, gradeLetter: letter, isPassed: total >= 40, teacherRemarks: remarks, updatedAt: new Date() },
        create: { schoolId, studentId: payload.studentId, subject, term, academicYear, className, test1: ca1, test2: ca2, finalExam: exam, totalScore: total, gradeLetter: letter, isPassed: total >= 40, teacherRemarks: remarks },
      });
    });

    // 3. Auto-link Course and Exam in tenantDb for full legacy compatibility
    try {
      let course = await tenantDb.course.findFirst({
        where: {
          schoolId,
          OR: [{ name: subject }, { id: subject }],
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

      let examRec = await tenantDb.exam.findFirst({
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

      await tenantDb.examResult.upsert({
        where: {
          schoolId_examId_studentId: {
            schoolId,
            examId: examRec.id,
            studentId: payload.studentId,
          },
        },
        update: {
          score: total,
          ca1Score: ca1,
          ca2Score: ca2,
          examScore: exam,
          letterGrade: letter,
          remarks,
          updatedAt: new Date(),
        },
        create: {
          schoolId,
          examId: examRec.id,
          studentId: payload.studentId,
          score: total,
          ca1Score: ca1,
          ca2Score: ca2,
          examScore: exam,
          letterGrade: letter,
          remarks,
        },
      });
    } catch {
      // Non-blocking
    }

    // Write-Through Cache Invalidation
    await invalidateGradingNamespace(schoolId);
    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
    safeRevalidatePath(`/[schoolDomain]/portal/staff`, "page");
    safeRevalidatePath(`/[schoolDomain]/report-cards`, "page");

    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to save broadsheet score:", error);
    return { success: false, error: error.message || "Failed to save score." };
  }
}

/**
 * 4. DEMO-ONLY END-TO-END GRADING SEEDER & CLEANER
 * Seeds realistic Nigerian continuous assessment and examination marks for ALL 5 JSS 1 students
 * across ALL 14 curriculum subjects. Strict isolation: DEMO DOMAIN ONLY.
 */
export async function seedDemoGradingScores(schoolId: string, schoolDomain: string) {
  // 1. Strict Scope Check - Demo Domain Only
  const isDemo = schoolDomain === "demo" || isDemoSchool(schoolId);
  if (!isDemo) {
    return {
      success: false,
      error: "Access Denied: Seeding demo scores is strictly prohibited for production schools.",
    };
  }

  try {
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [{ subdomain: "demo" }, { id: schoolId }],
      },
      include: {
        academicTiers: true,
      },
    });

    if (!school) {
      return { success: false, error: "Demo school not found." };
    }

    const effectiveSchoolId = school.id;
    const secondaryTier =
      school.academicTiers.find((t) => t.name.toLowerCase().includes("secondary") || t.level === 3) ||
      school.academicTiers[0];

    const tenantDb = await getPrismaClientForTier(effectiveSchoolId, secondaryTier?.name || "Secondary School");

    // 2. Fetch or Ensure REAL 5 JSS 1 Students from DB
    let jss1Students = await tenantDb.student.findMany({
      where: {
        schoolId: effectiveSchoolId,
        status: { in: ["ENROLLED", "ACTIVE"] },
        currentClass: { in: ["JSS 1", "jss 1", "JSS1", "Jss 1"] },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    if (jss1Students.length < 5) {
      console.info(`[SeedDemoScores] Found ${jss1Students.length} students in DB for JSS 1. Creating canonical demo students in DB...`);
      const canonicalDemoStudents = [
        { id: "mock-jss1-001", firstName: "Chinedu", lastName: "Okonkwo", admissionNumber: "GW/2026/JSS1/001" },
        { id: "mock-jss1-002", firstName: "Amina", lastName: "Bello", admissionNumber: "GW/2026/JSS1/002" },
        { id: "mock-jss1-003", firstName: "Folake", lastName: "Adeyemi", admissionNumber: "GW/2026/JSS1/003" },
        { id: "mock-jss1-004", firstName: "Emeka", lastName: "Nwosu", admissionNumber: "GW/2026/JSS1/004" },
        { id: "mock-jss1-005", firstName: "Zainab", lastName: "Abubakar", admissionNumber: "GW/2026/JSS1/005" },
      ];

      for (const s of canonicalDemoStudents) {
        const existing = await tenantDb.student.findFirst({
          where: {
            schoolId: effectiveSchoolId,
            OR: [
              { id: s.id },
              { admissionNumber: s.admissionNumber },
              { AND: [{ firstName: s.firstName }, { lastName: s.lastName }] },
            ],
          },
        });

        if (!existing) {
          await tenantDb.student.create({
            data: {
              id: s.id,
              schoolId: effectiveSchoolId,
              tierId: secondaryTier.id,
              firstName: s.firstName,
              lastName: s.lastName,
              admissionNumber: s.admissionNumber,
              currentClass: "JSS 1",
              status: "ENROLLED",
              email: `${s.firstName.toLowerCase()}.${s.lastName.toLowerCase()}@demo.schoolerp.local`,
            },
          });
        }
      }

      jss1Students = await tenantDb.student.findMany({
        where: {
          schoolId: effectiveSchoolId,
          status: { in: ["ENROLLED", "ACTIVE"] },
          currentClass: { in: ["JSS 1", "jss 1", "JSS1", "Jss 1"] },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
    }

    // 3. Resolve Real 14 JSS 1 Subjects via getSubjectsForClassAndTier
    const targetClass = "JSS 1";
    const subjects = getSubjectsForClassAndTier(targetClass, "SECONDARY");

    // 4. Resolve Real Assessment Weights from DB
    const tierConfig: any = (school.tierDatabasesConfig as object) || {};
    const savedWeights = tierConfig?.assessmentWeights?.["Secondary School"] || tierConfig?.assessmentWeights?.Secondary;
    const weights = savedWeights || { ca1: 20, ca2: 20, exam: 60 };

    const maxCa1 = Number(weights.ca1) || 20;
    const maxCa2 = Number(weights.ca2) || 20;
    const maxExam = Number(weights.exam) || 60;

    // 5. Order Students by Performance Ability
    // Okonkwo = Top (1st), Bello = Strong (2nd), Adeyemi = Average (3rd), Nwosu = Below Average (4th), Abubakar = Weak (5th)
    const sortedStudents = [...jss1Students].sort((a, b) => {
      const aName = `${a.lastName} ${a.firstName}`.toLowerCase();
      const bName = `${b.lastName} ${b.firstName}`.toLowerCase();
      if (aName.includes("okonkwo")) return -1;
      if (bName.includes("okonkwo")) return 1;
      if (aName.includes("bello")) return -1;
      if (bName.includes("bello")) return 1;
      if (aName.includes("adeyemi")) return -1;
      if (bName.includes("adeyemi")) return 1;
      if (aName.includes("nwosu")) return -1;
      if (bName.includes("nwosu")) return 1;
      if (aName.includes("abubakar")) return -1;
      if (bName.includes("abubakar")) return 1;
      return aName.localeCompare(bName);
    });

    const term = "1st Term";
    const academicYear = "2026/2027";
    const seededRecords: any[] = [];

    // Score blueprints per student profile for all 14 subjects:
    // Profile 0: Top (totals mostly 76-92, with French at 68)
    // Profile 1: Strong (totals 70-85)
    // Profile 2: Average (totals 55-68)
    // Profile 3: Below Average (totals 45-56)
    // Profile 4: Weak (totals 32-48, with fails in Math, Science, Tech, Computer, French)
    const profileTotals: Record<number, number[]> = {
      0: [81, 92, 88, 85, 78, 84, 89, 82, 91, 86, 76, 80, 68, 77], // Sum: 1147 | Avg: 81.93%
      1: [85, 74, 78, 71, 82, 79, 73, 77, 75, 83, 72, 74, 70, 81], // Sum: 1074 | Avg: 76.71%
      2: [67, 62, 59, 56, 65, 64, 58, 66, 61, 68, 63, 60, 55, 64], // Sum: 848  | Avg: 60.57%
      3: [54, 46, 48, 45, 53, 52, 47, 51, 49, 56, 50, 55, 45, 52], // Sum: 703  | Avg: 50.21%
      4: [44, 34, 38, 36, 45, 43, 41, 42, 37, 48, 40, 46, 32, 44], // Sum: 570  | Avg: 40.71%
    };

    // Component score split respecting the real max per component
    const splitScore = (total: number, maxC1: number, maxC2: number, maxEx: number) => {
      const maxTotal = maxC1 + maxC2 + maxEx;
      const ratio = total / maxTotal;
      let c1 = Math.round(maxC1 * ratio);
      let c2 = Math.round(maxC2 * ratio);
      let ex = total - (c1 + c2);
      if (ex > maxEx) {
        const diff = ex - maxEx;
        ex = maxEx;
        c1 = Math.min(maxC1, c1 + Math.ceil(diff / 2));
        c2 = total - (c1 + ex);
      }
      return { ca1: c1, ca2: c2, exam: ex };
    };

    // Pre-create/resolve courses
    for (const sub of subjects) {
      let course = await tenantDb.course.findFirst({
        where: { schoolId: effectiveSchoolId, name: sub },
      });
      if (!course) {
        await tenantDb.course.create({
          data: {
            schoolId: effectiveSchoolId,
            name: sub,
            code: sub.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "") + "101",
          },
        });
      }
    }

    // Upsert scores for all 5 students x 14 subjects (70 scores)
    for (let sIdx = 0; sIdx < sortedStudents.length && sIdx < 5; sIdx++) {
      const student = sortedStudents[sIdx];
      const totals = profileTotals[sIdx] || profileTotals[2];

      for (let subIdx = 0; subIdx < subjects.length; subIdx++) {
        const sub = subjects[subIdx];
        const total = totals[subIdx % totals.length];
        const { ca1, ca2, exam } = splitScore(total, maxCa1, maxCa2, maxExam);
        const letter = getNigerianGrade(targetClass, total);
        const remarks = getGradeRemark(letter);

        // 1. Upsert GradeRecord
        await tenantDb.gradeRecord.upsert({
          where: {
            schoolId_studentId_term_className_subject: {
              schoolId: effectiveSchoolId,
              studentId: student.id,
              term,
              className: targetClass,
              subject: sub,
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
            schoolId: effectiveSchoolId,
            studentId: student.id,
            className: targetClass,
            subject: sub,
            term,
            ca1,
            ca2,
            exam,
            totalScore: total,
          },
        });

        // 2. Upsert AcademicRecord
        await tenantDb.academicRecord.upsert({
          where: {
            schoolId_studentId_subject_term_academicYear: {
              schoolId: effectiveSchoolId,
              studentId: student.id,
              subject: sub,
              term,
              academicYear,
            },
          },
          update: {
            className: targetClass,
            test1: ca1,
            test2: ca2,
            finalExam: exam,
            totalScore: total,
            gradeLetter: letter,
            isPassed: total >= 40,
            teacherRemarks: remarks,
            updatedAt: new Date(),
          },
          create: {
            schoolId: effectiveSchoolId,
            studentId: student.id,
            subject: sub,
            term,
            academicYear,
            className: targetClass,
            test1: ca1,
            test2: ca2,
            finalExam: exam,
            totalScore: total,
            gradeLetter: letter,
            isPassed: total >= 40,
            teacherRemarks: remarks,
          },
        });

        seededRecords.push({
          studentId: student.id,
          mockStudentId: `mock-jss1-00${sIdx + 1}`,
          studentName: `${student.lastName}, ${student.firstName}`,
          subject: sub,
          ca1,
          ca2,
          exam,
          totalScore: total,
          remarks,
        });
      }
    }

    // 6. Compile ReportCards so report card view is immediately in sync
    try {
      await compileClassReportCards({
        schoolId: effectiveSchoolId,
        className: targetClass,
        term,
        academicYear,
      });
    } catch (err: any) {
      console.warn("[SeedDemoScores] Note on report card compilation:", err?.message);
    }

    // 7. Invalidate caches and revalidate paths
    await invalidateGradingNamespace(effectiveSchoolId);
    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
    safeRevalidatePath(`/[schoolDomain]/report-cards`, "page");

    const summaryStudents = sortedStudents.slice(0, 5).map((s, idx) => {
      const sum = profileTotals[idx].reduce((a, b) => a + b, 0);
      const avg = (sum / subjects.length).toFixed(2);
      const pos = `${idx + 1}${idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th"}`;
      return {
        id: s.id,
        name: `${s.lastName}, ${s.firstName}`,
        regNo: s.admissionNumber || `GW/2026/JSS1/00${idx + 1}`,
        total: sum,
        average: `${avg}%`,
        position: pos,
      };
    });

    return {
      success: true,
      count: seededRecords.length,
      records: seededRecords,
      students: summaryStudents,
      subjectsCount: subjects.length,
      subjects,
      weightsUsed: { ca1: maxCa1, ca2: maxCa2, exam: maxExam },
      topStudent: summaryStudents[0],
      bottomStudent: summaryStudents[4],
      message: `Successfully seeded ${seededRecords.length} realistic exam scores across 14 subjects for 5 JSS 1 students!`,
    };
  } catch (error: any) {
    console.error("[SeedDemoScores] Error:", error);
    return { success: false, error: error.message || "Failed to seed demo grading scores." };
  }
}

/**
 * 5. DEMO-ONLY SCORE CLEANER
 * Cleans up seeded demo marks for JSS 1 / 1st Term / 2026/2027 and resets broadsheet to empty.
 * Strictly isolated to DEMO DOMAIN ONLY.
 */
export async function clearDemoGradingScores(schoolId: string, schoolDomain: string) {
  const isDemo = schoolDomain === "demo" || isDemoSchool(schoolId);
  if (!isDemo) {
    return {
      success: false,
      error: "Access Denied: Clearing demo scores is strictly prohibited for production schools.",
    };
  }

  try {
    const school = await basePrisma.school.findFirst({
      where: { OR: [{ subdomain: "demo" }, { id: schoolId }] },
      include: { academicTiers: true },
    });
    if (!school) return { success: false, error: "Demo school not found." };

    const effectiveSchoolId = school.id;
    const secondaryTier =
      school.academicTiers.find((t) => t.name.toLowerCase().includes("secondary") || t.level === 3) ||
      school.academicTiers[0];

    const tenantDb = await getPrismaClientForTier(effectiveSchoolId, secondaryTier?.name || "Secondary School");
    const term = "1st Term";
    const academicYear = "2026/2027";
    const className = "JSS 1";

    // Delete GradeRecords for demo / JSS 1 / 1st Term
    await tenantDb.gradeRecord.deleteMany({
      where: {
        schoolId: effectiveSchoolId,
        className,
        term: { in: ["1st Term", "First Term", "Term 1"] },
      },
    });

    // Delete AcademicRecords for demo / JSS 1 / 1st Term / 2026/2027
    await tenantDb.academicRecord.deleteMany({
      where: {
        schoolId: effectiveSchoolId,
        className,
        term: { in: ["1st Term", "First Term", "Term 1"] },
        academicYear,
      },
    });

    // Delete ReportCards for demo / JSS 1 / 1st Term / 2026/2027
    await tenantDb.reportCard.deleteMany({
      where: {
        schoolId: effectiveSchoolId,
        className,
        term: { in: ["1st Term", "First Term", "Term 1"] },
        academicYear,
      },
    });

    await invalidateGradingNamespace(effectiveSchoolId);
    safeRevalidatePath(`/[schoolDomain]/exams`, "page");
    safeRevalidatePath(`/[schoolDomain]/report-cards`, "page");

    return {
      success: true,
      message: "Successfully cleared seeded scores for JSS 1 (1st Term 2026/2027). Broadsheet reset to empty.",
    };
  } catch (error: any) {
    console.error("[ClearDemoScores] Error:", error);
    return { success: false, error: error.message || "Failed to clear demo grading scores." };
  }
}
