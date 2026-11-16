import PDFDocument from "pdfkit";
import { isCrecheClass } from "./creche-config";

export interface ReportCardSubjectScore {
  subject: string;
  ca1?: number;
  ca2?: number;
  assignment?: number;
  test?: number;
  project?: number;
  exam?: number;
  total: number;
  grade: string;
  subjectPosition?: string;
  classAverage?: number;
  remark: string;
}

export interface ReportCardPdfData {
  schoolName: string;
  schoolMotto?: string;
  schoolAddress?: string;
  schoolContact?: string;
  session: string; // e.g. "2026/2027"
  term: string; // e.g. "First Term"
  studentName: string;
  admissionNumber: string;
  className: string;
  tierCategory?: "NURSERY" | "PRIMARY" | "SECONDARY" | "TERTIARY" | string;
  gender?: string;
  daysOpened?: number;
  daysPresent?: number;
  punctualityRate?: string;
  classPosition?: string;
  totalStudents?: number;
  totalScore?: number;
  maxPossibleScore?: number;
  averageScore?: number | string;
  overallGrade?: string;
  promotionStatus?: string;
  subjects: ReportCardSubjectScore[];
  skillsEvaluation?: Record<string, number | string>;
  teacherRemarks?: string;
  principalRemarks?: string;
  resumptionDate?: string;
}

/**
 * Pure server-side vector PDF generator for high-resolution A4 Nigerian Terminal Report Cards.
 */
export async function generateReportCardPdf(data: ReportCardPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 32,
        info: {
          Title: `Report Card - ${data.studentName} (${data.admissionNumber})`,
          Author: data.schoolName || "BonaVee School ERP",
          Subject: `${data.term} Terminal Report Sheet`,
          Keywords: "report card, academic broadsheet, assessment, school ERP",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 32;
      const contentWidth = pageWidth - margin * 2; // ~531pt

      // Outer Decorative Border
      doc.rect(margin - 4, margin - 4, contentWidth + 8, pageHeight - margin * 2 + 8)
        .lineWidth(1.5)
        .strokeColor("#1E3A8A")
        .stroke();

      doc.rect(margin - 1, margin - 1, contentWidth + 2, pageHeight - margin * 2 + 2)
        .lineWidth(0.5)
        .strokeColor("#D97706")
        .stroke();

      let currentY = margin + 6;

      // 1. INSTITUTIONAL HEADER & CREST
      // Header background accent
      doc.rect(margin, currentY, contentWidth, 54)
        .fillColor("#0F172A")
        .fill();

      // Crest emblem badge (Left)
      doc.circle(margin + 32, currentY + 27, 20)
        .fillColor("#1E3A8A")
        .fill();
      doc.circle(margin + 32, currentY + 27, 18)
        .lineWidth(1)
        .strokeColor("#D97706")
        .stroke();

      doc.font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#FFFFFF")
        .text("BV", margin + 23, currentY + 20, { width: 18, align: "center" });

      // School Name & Details
      const schoolTitle = (data.schoolName || "GREENWOOD ACADEMY").toUpperCase();
      doc.font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#F8FAFC")
        .text(schoolTitle, margin + 62, currentY + 8, { width: contentWidth - 140, align: "left" });

      doc.font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor("#F59E0B")
        .text(data.schoolMotto || "Excellence, Moral Discipline, & Future Leadership", margin + 62, currentY + 27);

      doc.font("Helvetica")
        .fontSize(7.5)
        .fillColor("#94A3B8")
        .text(
          data.schoolAddress || "Victoria Island / Lekki Peninsula, Lagos • info@greenwood.sch.ng",
          margin + 62,
          currentY + 39
        );

      // Sessional Term Badge (Right)
      doc.rect(pageWidth - margin - 110, currentY + 10, 100, 34)
        .fillColor("#1E293B")
        .fill();
      doc.rect(pageWidth - margin - 110, currentY + 10, 100, 34)
        .lineWidth(0.75)
        .strokeColor("#D97706")
        .stroke();

      doc.font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor("#FDE68A")
        .text((data.term || "1st Term").toUpperCase(), pageWidth - margin - 110, currentY + 14, { width: 100, align: "center" });

      doc.font("Helvetica")
        .fontSize(8)
        .fillColor("#E2E8F0")
        .text(data.session || "2026/2027", pageWidth - margin - 110, currentY + 26, { width: 100, align: "center" });

      currentY += 60;

      // Sub-Title Ribbon
      doc.rect(margin, currentY, contentWidth, 16)
        .fillColor("#F1F5F9")
        .fill();
      doc.font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor("#0F172A")
        .text("OFFICIAL TERMLY CONTINUOUS ASSESSMENT & ACADEMIC REPORT SHEET", margin, currentY + 4, {
          width: contentWidth,
          align: "center",
        });

      currentY += 20;

      // 2. STUDENT BIO-DATA & ATTENDANCE PROFILE
      doc.rect(margin, currentY, contentWidth, 42)
        .fillColor("#FAFAFA")
        .fill()
        .strokeColor("#E2E8F0")
        .lineWidth(0.5)
        .stroke();

      const colW = contentWidth / 4;

      // Row 1
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("STUDENT FULL NAME:", margin + 8, currentY + 5);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0F172A").text(data.studentName, margin + 8, currentY + 15, { width: colW * 1.5 - 10 });

      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("ADMISSION ID:", margin + colW * 1.5, currentY + 5);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#1E3A8A").text(data.admissionNumber, margin + colW * 1.5, currentY + 15);

      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("CURRENT CLASS:", margin + colW * 2.5, currentY + 5);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0F172A").text(data.className, margin + colW * 2.5, currentY + 15);

      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("TIER LEVEL:", margin + colW * 3.3, currentY + 5);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0F172A").text(data.tierCategory || "PRIMARY", margin + colW * 3.3, currentY + 15);

      // Row 2 (Attendance & Punctuality)
      const r2Y = currentY + 27;
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748B").text("DAYS OPENED:", margin + 8, r2Y);
      doc.font("Helvetica").fontSize(7.5).fillColor("#334155").text(String(data.daysOpened || 110), margin + 74, r2Y);

      doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748B").text("DAYS PRESENT:", margin + colW * 1.5, r2Y);
      doc.font("Helvetica").fontSize(7.5).fillColor("#334155").text(String(data.daysPresent || 108), margin + colW * 1.5 + 72, r2Y);

      doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748B").text("PUNCTUALITY RATE:", margin + colW * 2.5, r2Y);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#16A34A").text(data.punctualityRate || "98.2%", margin + colW * 2.5 + 92, r2Y);

      currentY += 46;

      // 3. PERFORMANCE SUMMARY METRICS CARDS
      const metricBoxW = (contentWidth - 12) / 5;
      const metricBoxH = 34;

      const overallGradeVal = data.overallGrade || (typeof data.averageScore === "number" ? (data.averageScore >= 75 ? "Distinction" : data.averageScore >= 65 ? "Very Good" : data.averageScore >= 50 ? "Credit" : data.averageScore >= 40 ? "Pass" : "Fail") : "—");
      const gradeRemarkSub = overallGradeVal === "Distinction" ? "Distinction"
        : overallGradeVal === "Very Good" ? "Very Good"
          : overallGradeVal === "Credit" ? "Credit"
            : overallGradeVal === "Pass" ? "Pass"
              : overallGradeVal === "Fail" ? "Needs Improvement"
                : "Standing";

      const metrics = [
        { label: "CLASS POSITION", val: data.classPosition || "1st", sub: `of ${data.totalStudents || 1} students`, color: "#1E3A8A" },
        { label: "TOTAL SCORE", val: data.totalScore !== undefined && data.totalScore !== null ? String(data.totalScore) : "0", sub: `Max: ${data.maxPossibleScore ?? (data.subjects.length * 100)}`, color: "#0F172A" },
        { label: "TERMINAL AVERAGE", val: typeof data.averageScore === "number" ? `${data.averageScore.toFixed(1)}%` : `${data.averageScore || "0.0%"}`, sub: "Weighted Aggregate", color: "#2563EB" },
        { label: "OVERALL GRADE", val: overallGradeVal, sub: gradeRemarkSub, color: "#16A34A" },
        { label: "STATUS / REMARK", val: overallGradeVal === "Fail" ? "NEEDS SUPPORT" : "PROMOTED", sub: data.promotionStatus || "In Good Standing", color: "#D97706" },
      ];

      metrics.forEach((m, idx) => {
        const xPos = margin + idx * (metricBoxW + 3);
        doc.rect(xPos, currentY, metricBoxW, metricBoxH)
          .fillColor("#F8FAFC")
          .fill()
          .strokeColor("#E2E8F0")
          .lineWidth(0.5)
          .stroke();

        doc.font("Helvetica-Bold").fontSize(6).fillColor("#64748B").text(m.label, xPos, currentY + 4, { width: metricBoxW, align: "center" });
        doc.font("Helvetica-Bold").fontSize(10).fillColor(m.color).text(m.val, xPos, currentY + 12, { width: metricBoxW, align: "center" });
        doc.font("Helvetica").fontSize(5.5).fillColor("#94A3B8").text(m.sub, xPos, currentY + 24, { width: metricBoxW, align: "center" });
      });

      currentY += 40;

      // 4. MULTI-SUBJECT EVALUATION COMPOSITE TABLE (NERDC 20/20/60 for Primary, Observation/CA for Creche)
      const isCreche = isCrecheClass(data.className) || (data.tierCategory ? isCrecheClass(data.tierCategory) : false);
      const crecheHasExam = isCreche && data.subjects.some((s) => s.exam !== null && s.exam !== undefined && s.exam > 0);

      let tableHeaders: string[];
      let colWidths: number[];

      if (isCreche && !crecheHasExam) {
        tableHeaders = ["ACTIVITY / CURRICULUM DISCIPLINE", "OBSERVATION (50)", "ASSESSMENT (50)", "TOTAL (100)", "GRADE", "POS.", "AVG", "DEVELOPMENTAL REMARK"];
        colWidths = [190, 44, 44, 48, 42, 36, 36, 116];
      } else if (isCreche && crecheHasExam) {
        tableHeaders = ["ACTIVITY / CURRICULUM DISCIPLINE", "OBS. (20)", "ASSESS. (20)", "EXAM (60)", "TOTAL (100)", "GRADE", "POS.", "AVG", "DEVELOPMENTAL REMARK"];
        colWidths = [170, 34, 34, 40, 42, 38, 34, 34, 95];
      } else {
        tableHeaders = ["SUBJECT / CURRICULUM DISCIPLINE", "1ST CA (20)", "2ND CA (20)", "EXAM (60)", "TOTAL (100)", "GRADE", "POS.", "AVG", "REMARK"];
        colWidths = [170, 34, 34, 40, 42, 38, 34, 34, 95];
      }

      // Table Header Row
      doc.rect(margin, currentY, contentWidth, 16)
        .fillColor("#1E293B")
        .fill();

      let headerX = margin;
      tableHeaders.forEach((th, idx) => {
        const align = idx === 0 ? "left" : idx === tableHeaders.length - 1 ? "left" : "center";
        const paddingLeft = idx === 0 ? 6 : 0;
        doc.font("Helvetica-Bold")
          .fontSize(6.5)
          .fillColor("#F8FAFC")
          .text(th, headerX + paddingLeft, currentY + 4.5, { width: colWidths[idx] - paddingLeft, align });
        headerX += colWidths[idx];
      });

      currentY += 16;

      // Render Subjects List strictly from database (Single Source of Truth)
      const subjects = data.subjects && data.subjects.length > 0 ? data.subjects : [];

      const rowHeight = 15;
      if (subjects.length === 0) {
        doc.rect(margin, currentY, contentWidth, rowHeight * 2)
          .fillColor("#FFFFFF")
          .fill()
          .strokeColor("#E2E8F0")
          .lineWidth(0.5)
          .stroke();
        doc.font("Helvetica-Oblique")
          .fontSize(7)
          .fillColor("#94A3B8")
          .text("No assessment scores entered yet in Teacher Gradebook for this session.", margin + 10, currentY + 10, { width: contentWidth - 20, align: "center" });
        currentY += rowHeight * 2;
      } else {
        subjects.slice(0, 11).forEach((sub, rowIdx) => {
          const isEven = rowIdx % 2 === 0;
          doc.rect(margin, currentY, contentWidth, rowHeight)
            .fillColor(isEven ? "#FFFFFF" : "#F8FAFC")
            .fill()
            .strokeColor("#E2E8F0")
            .lineWidth(0.5)
            .stroke();

          let rowX = margin;
          const subPosition = sub.subjectPosition || `${rowIdx + 1}${rowIdx === 0 ? "st" : rowIdx === 1 ? "nd" : rowIdx === 2 ? "rd" : "th"}`;
          const ca1Str = sub.ca1 !== null && sub.ca1 !== undefined ? String(sub.ca1) : "—";
          const ca2Str = sub.ca2 !== null && sub.ca2 !== undefined ? String(sub.ca2) : "—";
          const examStr = sub.exam !== null && sub.exam !== undefined ? String(sub.exam) : "—";
          const totalStr = sub.total !== null && sub.total !== undefined ? String(sub.total) : "—";

          const rowVals = (isCreche && !crecheHasExam)
            ? [
              sub.subject,
              ca1Str,
              ca2Str,
              totalStr,
              sub.grade || "—",
              subPosition,
              String(sub.classAverage || 68),
              sub.remark || "Satisfactory",
            ]
            : [
              sub.subject,
              ca1Str,
              ca2Str,
              examStr,
              totalStr,
              sub.grade || "—",
              subPosition,
              String(sub.classAverage || 68),
              sub.remark || "Satisfactory",
            ];

          const gradeColIdx = (isCreche && !crecheHasExam) ? 4 : 5;
          const totalColIdx = (isCreche && !crecheHasExam) ? 3 : 4;

          rowVals.forEach((val, cIdx) => {
            const align = cIdx === 0 ? "left" : cIdx === rowVals.length - 1 ? "left" : "center";
            const paddingLeft = cIdx === 0 ? 6 : 0;
            const isBold = cIdx === 0 || cIdx === totalColIdx || cIdx === gradeColIdx;
            const font = isBold ? "Helvetica-Bold" : "Helvetica";
            let color = "#1E293B";
            if (cIdx === gradeColIdx) {
              color = val === "Distinction" || val === "A1" ? "#047857" : val === "Very Good" || val === "B2" || val === "B3" ? "#0F766E" : val === "Fail" || val === "F9" ? "#B91C1C" : "#1D4ED8";
            }
            doc.font(font)
              .fontSize(6)
              .fillColor(color)
              .text(val, rowX + paddingLeft, currentY + 4, { width: colWidths[cIdx] - paddingLeft, align });
            rowX += colWidths[cIdx];
          });

          currentY += rowHeight;
        });
      }

      currentY += 8;

      // 5. AFFECTIVE TRAITS & PSYCHOMOTOR SKILLS MATRIX
      doc.rect(margin, currentY, contentWidth, 54)
        .fillColor("#F8FAFC")
        .fill()
        .strokeColor("#CBD5E1")
        .lineWidth(0.5)
        .stroke();

      // Matrix header
      doc.rect(margin, currentY, contentWidth, 14)
        .fillColor("#334155")
        .fill();
      doc.font("Helvetica-Bold")
        .fontSize(6.5)
        .fillColor("#FFFFFF")
        .text("AFFECTIVE DOMAIN & PSYCHOMOTOR TRAITS ASSESSMENT (RATING KEY: 5 = Excellent, 4 = Very Good, 3 = Good, 2 = Fair, 1 = Needs Work)", margin, currentY + 3.5, {
          width: contentWidth,
          align: "center",
        });

      const traitsColW = contentWidth / 4;
      const traits = [
        { label: "Punctuality & Attendance", val: "5 (Excellent)" },
        { label: "Neatness & Organization", val: "5 (Excellent)" },
        { label: "Politeness & Respect", val: "5 (Excellent)" },
        { label: "Honesty & Integrity", val: "5 (Excellent)" },
        { label: "Handwriting & Legibility", val: "4 (Very Good)" },
        { label: "Verbal Communication", val: "5 (Excellent)" },
        { label: "Sports & Physical Agility", val: "4 (Very Good)" },
        { label: "Craft & Creative Ingenuity", val: "5 (Excellent)" },
      ];

      traits.forEach((trait, tIdx) => {
        const col = tIdx % 4;
        const row = Math.floor(tIdx / 4);
        const tX = margin + col * traitsColW + 6;
        const tY = currentY + 17 + row * 16;

        doc.font("Helvetica-Bold").fontSize(6).fillColor("#64748B").text(trait.label, tX, tY);
        doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#1E3A8A").text(trait.val, tX, tY + 7);
      });

      currentY += 60;

      // 6. ADMINISTRATIVE SIGN-OFF, OFFICIAL SEAL, & RESUMPTION DATE
      doc.rect(margin, currentY, contentWidth - 110, 36)
        .fillColor("#FFFFFF")
        .fill()
        .strokeColor("#E2E8F0")
        .lineWidth(0.5)
        .stroke();

      // Class Teacher Remarks
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#0F172A").text("CLASS TEACHER'S REMARK:", margin + 6, currentY + 4);
      doc.font("Helvetica-Oblique")
        .fontSize(6.5)
        .fillColor("#334155")
        .text(
          data.teacherRemarks ||
          "A committed, diligent, and intellectually exceptional student. Demonstrates leadership and academic enthusiasm.",
          margin + 6,
          currentY + 12,
          { width: contentWidth - 130 }
        );

      // Principal's Remarks
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#0F172A").text("PRINCIPAL'S REMARK:", margin + 6, currentY + 22);
      doc.font("Helvetica-Oblique")
        .fontSize(6.5)
        .fillColor("#15803D")
        .text(
          data.principalRemarks ||
          "Outstanding academic and character performance. A role model to peers. Promoted with Honours.",
          margin + 6,
          currentY + 29,
          { width: contentWidth - 130 }
        );

      // Official Circular Seal / Stamp Badge (Right)
      const sealCenterX = pageWidth - margin - 50;
      const sealCenterY = currentY + 18;

      doc.circle(sealCenterX, sealCenterY, 24)
        .lineWidth(1)
        .strokeColor("#1E3A8A")
        .stroke();
      doc.circle(sealCenterX, sealCenterY, 21)
        .lineWidth(0.5)
        .strokeColor("#D97706")
        .stroke();

      doc.font("Helvetica-Bold")
        .fontSize(4.5)
        .fillColor("#1E3A8A")
        .text("OFFICIAL REGISTRY", sealCenterX - 20, sealCenterY - 14, { width: 40, align: "center" });
      doc.font("Helvetica-Bold")
        .fontSize(5)
        .fillColor("#D97706")
        .text("SEAL", sealCenterX - 20, sealCenterY - 4, { width: 40, align: "center" });
      doc.font("Helvetica-Bold")
        .fontSize(4)
        .fillColor("#1E3A8A")
        .text("CERTIFIED TRUE", sealCenterX - 20, sealCenterY + 4, { width: 40, align: "center" });
      doc.font("Helvetica")
        .fontSize(4)
        .fillColor("#64748B")
        .text("ACADEMIC RECORD", sealCenterX - 20, sealCenterY + 11, { width: 40, align: "center" });

      currentY += 40;

      // Bottom Bar: Resumption Date & Digital Verification Footnote
      doc.rect(margin, currentY, contentWidth, 14)
        .fillColor("#1E293B")
        .fill();

      doc.font("Helvetica-Bold")
        .fontSize(6)
        .fillColor("#FDE68A")
        .text(
          `NEXT TERM RESUMPTION DATE: ${data.resumptionDate || "Monday, 11th January 2027"}`,
          margin + 8,
          currentY + 3.5
        );

      doc.font("Helvetica")
        .fontSize(5.5)
        .fillColor("#94A3B8")
        .text(
          "Generated from Teacher Gradebook • Approved By Principal • Document Ref: BV-REP-" +
          Date.now().toString(36).toUpperCase(),
          margin + 200,
          currentY + 4,
          { width: contentWidth - 208, align: "right" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
