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

/**
 * Server Action: Save continuous assessments or narrative records
 * Dynamically routed to the correct database (Primary vs Secondary vs Nursery).
 */
export async function saveAcademicRecordAction(payload: SaveAssessmentPayload) {
  try {
    const result = await saveAcademicRecord(payload);
    revalidatePath("/[schoolDomain]/report-cards", "page");
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
    revalidatePath("/[schoolDomain]/report-cards", "page");
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
    revalidatePath("/[schoolDomain]/report-cards", "page");
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
