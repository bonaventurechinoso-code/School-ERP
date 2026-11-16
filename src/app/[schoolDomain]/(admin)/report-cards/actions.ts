"use server";

import {
  saveAcademicRecord,
  compileClassReportCards,
  compileStudentReportCard,
  getStudentReportCard,
  getClassResultSheet,
  SaveAssessmentPayload,
  CompileClassPayload,
  CompileStudentPayload,
} from "@/lib/report-card-service";
import { revalidatePath } from "next/cache";

function safeRevalidate(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful fallback when invoked outside Next.js request/action context
  }
}

/**
 * Server Action: Save continuous assessments or narrative records
 * Dynamically routed to the correct database (Primary vs Secondary vs Nursery).
 */
export async function saveAcademicRecordAction(payload: SaveAssessmentPayload) {
  try {
    const result = await saveAcademicRecord(payload);
    safeRevalidate("/[schoolDomain]/report-cards", "page");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("[saveAcademicRecordAction] Error:", error);
    return { success: false, error: error.message || "Failed to save academic record." };
  }
}

/**
 * Server Action: Batch compile class report cards with automatic position calculation
 * and administrative remarks.
 */
export async function compileClassReportCardsAction(payload: CompileClassPayload) {
  try {
    const result = await compileClassReportCards(payload);
    safeRevalidate("/[schoolDomain]/report-cards", "page");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("[compileClassReportCardsAction] Error:", error);
    return { success: false, error: error.message || "Failed to compile class report cards." };
  }
}

/**
 * Server Action: Compile individual student report card
 */
export async function compileSingleReportCardAction(payload: CompileStudentPayload) {
  try {
    const result = await compileStudentReportCard(payload);
    safeRevalidate("/[schoolDomain]/report-cards", "page");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("[compileSingleReportCardAction] Error:", error);
    return { success: false, error: error.message || "Failed to compile report card." };
  }
}

/**
 * Server Action: Fetch class result sheet / broadsheet
 */
export async function fetchClassResultSheetAction(
  schoolId: string,
  className: string,
  term: string,
  academicYear: string,
  tierName?: string
) {
  try {
    const result = await getClassResultSheet(
      schoolId,
      className,
      term,
      academicYear,
      tierName
    );
    return { success: true, data: result };
  } catch (error: any) {
    console.error("[fetchClassResultSheetAction] Error:", error);
    return { success: false, error: error.message || "Failed to fetch class result sheet." };
  }
}

/**
 * Server Action: Fetch student report card
 */
export async function fetchStudentReportCardAction(
  schoolId: string,
  studentId: string,
  term: string,
  academicYear: string,
  tierName?: string
) {
  try {
    const result = await getStudentReportCard(
      schoolId,
      studentId,
      term,
      academicYear,
      tierName
    );
    return { success: true, data: result };
  } catch (error: any) {
    console.error("[fetchStudentReportCardAction] Error:", error);
    return { success: false, error: error.message || "Failed to fetch student report card." };
  }
}

/**
 * Server Action: Principal approval and lock of class report cards
 */
export async function approveClassReportCardsAction(
  schoolId: string,
  className: string,
  term: string,
  academicYear: string,
  shouldLock: boolean = true
) {
  try {
    const { basePrisma } = await import("@/lib/tenant-prisma");
    const newStatus = shouldLock ? "LOCKED" : "APPROVED";
    const updated = await basePrisma.reportCard.updateMany({
      where: {
        schoolId,
        className,
        term,
        academicYear,
      },
      data: {
        status: newStatus,
      },
    });

    await basePrisma.auditLog.create({
      data: {
        schoolId,
        action: shouldLock ? "PRINCIPAL_LOCK_REPORT_CARDS" : "PRINCIPAL_REPORT_CARD_APPROVAL",
        target: `${className} (${term})`,
        metadata: {
          approvedAt: new Date().toISOString(),
          status: newStatus,
          count: updated.count,
        },
      },
    });

    safeRevalidate("/[schoolDomain]/report-cards", "page");
    return { success: true, count: updated.count, status: newStatus };
  } catch (error: any) {
    console.error("[approveClassReportCardsAction] Error:", error);
    return { success: false, error: error.message || "Failed to approve class report cards." };
  }
}

/**
 * Server Action: Principal / Head Teacher returns class report cards with comment for revisions
 */
export async function returnClassReportCardsAction(
  schoolId: string,
  className: string,
  term: string,
  academicYear: string,
  comment: string
) {
  try {
    if (!comment || !comment.trim()) {
      return { success: false, error: "A return comment/reason must be provided when returning report cards." };
    }

    const { basePrisma } = await import("@/lib/tenant-prisma");
    const updated = await basePrisma.reportCard.updateMany({
      where: {
        schoolId,
        className,
        term,
        academicYear,
      },
      data: {
        status: "RETURNED",
        principalRemarks: `Returned for revision: ${comment.trim()}`,
      },
    });

    await basePrisma.auditLog.create({
      data: {
        schoolId,
        action: "PRINCIPAL_RETURN_REPORT_CARDS",
        target: `${className} (${term})`,
        metadata: {
          returnedAt: new Date().toISOString(),
          comment: comment.trim(),
          count: updated.count,
        },
      },
    });

    safeRevalidate("/[schoolDomain]/report-cards", "page");
    return { success: true, count: updated.count };
  } catch (error: any) {
    console.error("[returnClassReportCardsAction] Error:", error);
    return { success: false, error: error.message || "Failed to return class report cards." };
  }
}

/**
 * Server Action: Head Teacher / Principal unlocks locked class grades for teacher editing (Requires Audit Log)
 */
export async function unlockClassReportCardsAction(
  schoolId: string,
  className: string,
  term: string,
  academicYear: string,
  reason: string = "Unlocked for grade corrections"
) {
  try {
    const { basePrisma } = await import("@/lib/tenant-prisma");
    const updated = await basePrisma.reportCard.updateMany({
      where: {
        schoolId,
        className,
        term,
        academicYear,
      },
      data: {
        status: "COMPILED",
      },
    });

    await basePrisma.auditLog.create({
      data: {
        schoolId,
        action: "HEAD_TEACHER_UNLOCK_GRADES",
        target: `${className} (${term})`,
        metadata: {
          unlockedAt: new Date().toISOString(),
          reason: reason.trim(),
          count: updated.count,
        },
      },
    });

    safeRevalidate("/[schoolDomain]/report-cards", "page");
    return { success: true, count: updated.count };
  } catch (error: any) {
    console.error("[unlockClassReportCardsAction] Error:", error);
    return { success: false, error: error.message || "Failed to unlock class report cards." };
  }
}
