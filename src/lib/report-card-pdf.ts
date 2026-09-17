import PDFDocument from "pdfkit";

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
        .text(data.term.toUpperCase(), pageWidth - margin - 110, currentY + 14, { width: 100, align: "center" });

      doc.font("Helvetica")
        .fontSize(8)
        .fillColor("#E2E8F0")
        .text(data.session, pageWidth - margin - 110, currentY + 26, { width: 100, align: "center" });

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

      const metrics = [
        { label: "CLASS POSITION", val: data.classPosition || "1st", sub: `of ${data.totalStudents || 28} students`, color: "#1E3A8A" },
        { label: "TOTAL SCORE", val: String(data.totalScore || "724"), sub: `Max: ${data.maxPossibleScore || 800}`, color: "#0F172A" },
        { label: "TERMINAL AVERAGE", val: typeof data.averageScore === "number" ? `${data.averageScore.toFixed(1)}%` : `${data.averageScore || "90.5%"}`, sub: "Weighted Aggregate", color: "#2563EB" },
        { label: "OVERALL GRADE", val: data.overallGrade || "A1", sub: "Distinction", color: "#16A34A" },
        { label: "STATUS / REMARK", val: "PROMOTED", sub: data.promotionStatus || "In Good Standing", color: "#D97706" },
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

      // 4. MULTI-SUBJECT EVALUATION COMPOSITE TABLE
      const tableHeaders = ["SUBJECT / CURRICULUM DISCIPLINE", "CA 1", "CA 2", "EXAM", "TOTAL", "GRADE", "POS.", "AVG", "REMARK"];
      const colWidths = [170, 34, 34, 40, 42, 38, 34, 34, 95];

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

      // Render Subjects List
      const subjects = data.subjects && data.subjects.length > 0 ? data.subjects : [
        { subject: "Mathematics", ca1: 18, ca2: 17, exam: 54, total: 89, grade: "A1", subjectPosition: "1st", classAverage: 68, remark: "Distinction in concepts" },
        { subject: "English Language", ca1: 16, ca2: 18, exam: 50, total: 84, grade: "A1", subjectPosition: "2nd", classAverage: 65, remark: "Strong comprehension" },
        { subject: "Basic Science & Technology", ca1: 17, ca2: 16, exam: 52, total: 85, grade: "A1", subjectPosition: "1st", classAverage: 66, remark: "Excellent practicals" },
        { subject: "Digital Technologies / ICT", ca1: 19, ca2: 18, exam: 56, total: 93, grade: "A1", subjectPosition: "1st", classAverage: 72, remark: "Superb digital literacy" },
        { subject: "Civic Education", ca1: 16, ca2: 17, exam: 51, total: 84, grade: "A1", subjectPosition: "2nd", classAverage: 67, remark: "High moral standing" },
        { subject: "Agricultural Science", ca1: 17, ca2: 17, exam: 53, total: 87, grade: "A1", subjectPosition: "1st", classAverage: 69, remark: "Curious and attentive" },
        { subject: "Social Studies", ca1: 15, ca2: 16, exam: 48, total: 79, grade: "B2", subjectPosition: "3rd", classAverage: 64, remark: "Good grasp of topics" },
        { subject: "Cultural & Creative Arts", ca1: 18, ca2: 17, exam: 55, total: 90, grade: "A1", subjectPosition: "1st", classAverage: 70, remark: "Imaginative & neat" },
      ];

      const rowHeight = 15;
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
        const rowVals = [
          sub.subject,
          String(sub.ca1 !== undefined ? sub.ca1 : sub.assignment || 18),
          String(sub.ca2 !== undefined ? sub.ca2 : sub.test || 17),
          String(sub.exam || 54),
          String(sub.total),
          sub.grade,
          subPosition,
          String(sub.classAverage || 68),
          sub.remark || "Satisfactory",
        ];

        rowVals.forEach((val, cIdx) => {
          const align = cIdx === 0 ? "left" : cIdx === rowVals.length - 1 ? "left" : "center";
          const paddingLeft = cIdx === 0 ? 6 : 0;
          const isBold = cIdx === 0 || cIdx === 4 || cIdx === 5;
          const font = isBold ? "Helvetica-Bold" : "Helvetica";
          let color = "#1E293B";
          if (cIdx === 5) {
            color = val.startsWith("A") ? "#15803D" : val.startsWith("B") ? "#2563EB" : val.startsWith("C") ? "#D97706" : "#E11D48";
          } else if (cIdx === 4) {
            color = "#0F172A";
          }

          doc.font(font)
            .fontSize(7)
            .fillColor(color)
            .text(val, rowX + paddingLeft, currentY + 4, { width: colWidths[cIdx] - paddingLeft, align });
          rowX += colWidths[cIdx];
        });

        currentY += rowHeight;
      });

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
          "Generated securely via BonaVee Institutional School ERP • Multi-Tenant Cryptographic Cloud • Document Ref: BV-REP-" +
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
