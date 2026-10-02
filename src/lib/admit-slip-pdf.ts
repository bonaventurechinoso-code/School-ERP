import PDFDocument from "pdfkit";

export interface ExamAdmitSlipPdfData {
  schoolName: string;
  schoolMotto?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  applicantName: string;
  parentName?: string;
  applicationNo: string;
  rollNo: string;
  targetGrade: string;
  tierName?: string;
  examDate: string;
  arrivalTime: string;
  venue: string;
  subjects: string;
  subdomain?: string;
}

/**
 * Pure server-side vector PDF generator for high-resolution A4 Examination Admit Slips.
 * Generates an official, printable A4 document with institutional header, candidate details,
 * screening schedule, instructions, and verification security seals.
 */
export async function generateExamAdmitSlipPdf(data: ExamAdmitSlipPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 36,
        info: {
          Title: `Exam Admit Slip - ${data.applicantName} (${data.rollNo})`,
          Author: data.schoolName || "School ERP",
          Subject: "Entrance Screening Examination Admit Card",
          Keywords: "admit slip, entrance examination, roll number, screening card",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 36;
      const contentWidth = pageWidth - margin * 2; // ~523.28pt

      // Outer Frame
      doc
        .rect(margin - 6, margin - 6, contentWidth + 12, pageHeight - margin * 2 + 12)
        .lineWidth(2)
        .strokeColor("#1E293B")
        .stroke();

      doc
        .rect(margin - 2, margin - 2, contentWidth + 4, pageHeight - margin * 2 + 4)
        .lineWidth(0.75)
        .strokeColor("#D97706")
        .stroke();

      let currentY = margin + 4;

      // 1. INSTITUTIONAL HEADER
      doc
        .rect(margin, currentY, contentWidth, 64)
        .fillColor("#0F172A")
        .fill();

      // Crest emblem badge (Left)
      const crestX = margin + 34;
      const crestY = currentY + 32;
      doc.circle(crestX, crestY, 22).fillColor("#1E3A8A").fill();
      doc.circle(crestX, crestY, 20).lineWidth(1.2).strokeColor("#F59E0B").stroke();

      const initials = (data.schoolName || "SE")
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#FFFFFF")
        .text(initials, crestX - 12, crestY - 6, { width: 24, align: "center" });

      // School Title
      const schoolTitle = (data.schoolName || "GREENWOOD ACADEMY").toUpperCase();
      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor("#FFFFFF")
        .text(schoolTitle, margin + 68, currentY + 10, { width: contentWidth - 170, align: "left" });

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#F59E0B")
        .text("ACADEMIC ADMISSIONS & ENTRANCE SCREENING BOARD", margin + 68, currentY + 29);

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#94A3B8")
        .text(
          data.schoolAddress || `Admissions Secretariat • Helpline: ${data.schoolPhone || "+234 (0) 800-SCHOOL-ERP"}`,
          margin + 68,
          currentY + 43
        );

      // Sessional Year Badge (Right)
      const badgeW = 96;
      const badgeH = 44;
      const badgeX = pageWidth - margin - badgeW - 8;
      const badgeY = currentY + 10;
      doc.rect(badgeX, badgeY, badgeW, badgeH).fillColor("#1E293B").fill();
      doc.rect(badgeX, badgeY, badgeW, badgeH).lineWidth(1).strokeColor("#D97706").stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor("#FDE68A")
        .text("2026/2027", badgeX, badgeY + 8, { width: badgeW, align: "center" });

      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#CBD5E1")
        .text("INTAKE COHORT", badgeX, badgeY + 24, { width: badgeW, align: "center" });

      currentY += 72;

      // 2. DOCUMENT SUB-HEADER BANNER
      doc
        .rect(margin, currentY, contentWidth, 20)
        .fillColor("#4F46E5")
        .fill();

      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor("#FFFFFF")
        .text("OFFICIAL ENTRANCE SCREENING EXAMINATION ADMIT CARD / SLIP", margin, currentY + 5, {
          width: contentWidth,
          align: "center",
        });

      currentY += 26;

      // 3. OFFICIAL ROLL NUMBER HIGHLIGHT BANNER
      doc
        .rect(margin, currentY, contentWidth, 42)
        .fillColor("#F8FAFC")
        .fill();

      doc
        .rect(margin, currentY, contentWidth, 42)
        .lineWidth(1)
        .strokeColor("#CBD5E1")
        .stroke();

      // Left: Roll Number
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#64748b")
        .text("OFFICIAL EXAMINATION ROLL NUMBER", margin + 14, currentY + 7);

      doc
        .font("Courier-Bold")
        .fontSize(16)
        .fillColor("#1E1B4B")
        .text(data.rollNo, margin + 14, currentY + 19);

      // Right: Application Number
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#64748b")
        .text("APPLICATION REFERENCE", margin + contentWidth - 170, currentY + 7);

      doc
        .font("Courier-Bold")
        .fontSize(13)
        .fillColor("#4F46E5")
        .text(data.applicationNo, margin + contentWidth - 170, currentY + 20);

      currentY += 48;

      // Helper function to draw section header
      const drawSectionHeader = (title: string, y: number) => {
        doc.rect(margin, y, contentWidth, 16).fillColor("#E2E8F0").fill();
        doc.rect(margin, y, 4, 16).fillColor("#4F46E5").fill();
        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor("#0F172A")
          .text(title.toUpperCase(), margin + 10, y + 4);
      };

      // 4. CANDIDATE BIO-DATA SECTION
      drawSectionHeader("1. Candidate Identification & Profile", currentY);
      currentY += 19;

      const profileRowH = 22;
      const profileBoxH = profileRowH * 3;
      doc.rect(margin, currentY, contentWidth, profileBoxH).fillColor("#FFFFFF").fill();
      doc.rect(margin, currentY, contentWidth, profileBoxH).lineWidth(0.5).strokeColor("#E2E8F0").stroke();

      const col1W = 120;
      const col2W = 190;
      const col3W = 80;
      const col4W = contentWidth - col1W - col2W - col3W;

      // Row 1: Candidate Name | Tier
      doc.rect(margin, currentY, contentWidth, profileRowH).fillColor("#F8FAFC").fill();
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("CANDIDATE FULL NAME", margin + 8, currentY + 6);
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#0F172A").text(data.applicantName.toUpperCase(), margin + col1W, currentY + 6);

      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("ACADEMIC TIER", margin + col1W + col2W, currentY + 6);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#4338CA").text(data.tierName || "Secondary School", margin + col1W + col2W + col3W, currentY + 6);

      // Row 2: Target Class | Verification Status
      const r2Y = currentY + profileRowH;
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("TARGET CLASS / COHORT", margin + 8, r2Y + 6);
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#0F172A").text(data.targetGrade, margin + col1W, r2Y + 6);

      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("ADMIT STATUS", margin + col1W + col2W, r2Y + 6);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#059669").text("CLEARED FOR TESTING", margin + col1W + col2W + col3W, r2Y + 6);

      // Row 3: Parent / Guardian | Category
      const r3Y = currentY + profileRowH * 2;
      doc.rect(margin, r3Y, contentWidth, profileRowH).fillColor("#F8FAFC").fill();
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("PARENT / GUARDIAN", margin + 8, r3Y + 6);
      doc.font("Helvetica").fontSize(8.5).fillColor("#0F172A").text(data.parentName || "Parent on Record", margin + col1W, r3Y + 6);

      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("SECURITY SEAL", margin + col1W + col2W, r3Y + 6);
      doc.font("Helvetica").fontSize(8).fillColor("#059669").text("VERIFIED VALID", margin + col1W + col2W + col3W, r3Y + 6);

      currentY += profileBoxH + 12;

      // 5. SCREENING SCHEDULE & VENUE DETAILS (Expansive Clean Blocks)
      drawSectionHeader("2. Examination Schedule & Testing Center Venue", currentY);
      currentY += 19;

      const schedBoxH = 88;
      doc.rect(margin, currentY, contentWidth, schedBoxH).fillColor("#FFFFFF").fill();
      doc.rect(margin, currentY, contentWidth, schedBoxH).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

      // Left Accent Border
      doc.rect(margin, currentY, 4, schedBoxH).fillColor("#059669").fill();

      // Grid items inside Schedule Box
      const schedColW = (contentWidth - 12) / 2;

      // Date Block (Top Left)
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("SCREENING TEST DATE", margin + 14, currentY + 8);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0F172A").text(data.examDate, margin + 14, currentY + 19);

      // Time Block (Top Right)
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("ARRIVAL & ACCREDITATION TIME", margin + 14 + schedColW, currentY + 8);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#DC2626").text(data.arrivalTime, margin + 14 + schedColW, currentY + 19);

      // Divider Line inside Schedule Box
      doc.moveTo(margin + 10, currentY + 44).lineTo(margin + contentWidth - 10, currentY + 44).lineWidth(0.5).strokeColor("#E2E8F0").stroke();

      // Venue Block (Bottom Left)
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("DESIGNATED EXAMINATION HALL / VENUE", margin + 14, currentY + 50);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0F172A").text(data.venue, margin + 14, currentY + 62);

      // Subjects Block (Bottom Right)
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748B").text("TESTED EXAMINATION SUBJECTS", margin + 14 + schedColW, currentY + 50);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#1E3A8A").text(data.subjects, margin + 14 + schedColW, currentY + 62, {
        width: schedColW - 16,
      });

      currentY += schedBoxH + 12;

      // 6. OFFICIAL EXAMINATION RULES & CANDIDATE CODE OF CONDUCT
      drawSectionHeader("3. Statutory Examination Instructions & Requirements", currentY);
      currentY += 19;

      const instructions = [
        "1. PHYSICAL SLIP MANDATORY: Candidates must present a clean, printed copy of this official Examination Admit Slip at the accreditation checkpoint.",
        "2. PUNCTUALITY: Accreditation commences strictly at the designated arrival time. Candidates arriving late may be disqualified from the sitting.",
        "3. REQUIRED MATERIALS: Bring adequate writing instruments (HB pencils, sharpener, eraser, and blue/black ballpoint pens).",
        "4. ELECTRONICS PROHIBITED: Mobile phones, smartwatches, programmable calculators, and unapproved electronic devices are strictly prohibited in the exam hall.",
        "5. IMPERSONATION & CONDUCT: Impersonation or examination malpractice of any form will lead to immediate disqualification and revocation of admission eligibility.",
        "6. PARENT / GUARDIAN WAITING AREA: Parents and guardians are restricted from entering testing halls and must wait at designated visitor lounges.",
      ];

      const instrH = 82;
      doc.rect(margin, currentY, contentWidth, instrH).fillColor("#FFFBEB").fill();
      doc.rect(margin, currentY, contentWidth, instrH).lineWidth(0.5).strokeColor("#FDE68A").stroke();
      doc.rect(margin, currentY, 3, instrH).fillColor("#D97706").fill();

      let instrY = currentY + 6;
      instructions.forEach((inst) => {
        doc.font("Helvetica").fontSize(7).fillColor("#92400E").text(inst, margin + 10, instrY, {
          width: contentWidth - 20,
          lineGap: 1.5,
        });
        instrY += 12;
      });

      currentY += instrH + 14;

      // 7. VERIFICATION STAMP & OFFICIAL ENDORSEMENT FOOTER
      const signBoxH = 68;
      doc.rect(margin, currentY, contentWidth, signBoxH).fillColor("#F8FAFC").fill();
      doc.rect(margin, currentY, contentWidth, signBoxH).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

      const stampW = 140;
      // Stamp Box (Left)
      doc.rect(margin + 12, currentY + 8, stampW, signBoxH - 16).lineWidth(1).dash(3, { space: 3 }).strokeColor("#059669").stroke();
      doc.undash();
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#059669").text("OFFICIAL VERIFICATION SEAL", margin + 16, currentY + 16, { width: stampW - 8, align: "center" });
      doc.font("Helvetica").fontSize(6.5).fillColor("#047857").text("VALIDATED BY ADMISSIONS BOARD", margin + 16, currentY + 28, { width: stampW - 8, align: "center" });
      doc.font("Courier-Bold").fontSize(7).fillColor("#065F46").text(`AUTH-ID: ${data.rollNo}`, margin + 16, currentY + 40, { width: stampW - 8, align: "center" });

      // Middle: Security details
      const midX = margin + stampW + 28;
      const midW = 160;
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#475569").text("AUTHENTICATION NOTICE", midX, currentY + 14);
      doc.font("Helvetica").fontSize(6.5).fillColor("#64748B").text(
        `This electronic admit card is issued under the authority of the Admissions Committee of ${data.schoolName}. System-generated and tamper-evident.`,
        midX,
        currentY + 26,
        { width: midW, lineGap: 1.5 }
      );

      // Signature (Right)
      const signX = pageWidth - margin - 150;
      doc.moveTo(signX, currentY + 44).lineTo(signX + 130, currentY + 44).lineWidth(0.8).strokeColor("#0F172A").stroke();
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#0F172A").text("Registrar / Admissions Officer", signX, currentY + 48, { width: 130, align: "center" });
      doc.font("Helvetica").fontSize(6.5).fillColor("#64748B").text("Authorized Signature & Date", signX, currentY + 58, { width: 130, align: "center" });

      currentY += signBoxH + 10;

      // 8. FOOTER NOTE
      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor("#94A3B8")
        .text(
          `Printed via ${data.schoolName} Admissions Portal • Generated: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} • Keep safe until matriculation.`,
          margin,
          pageHeight - margin - 8,
          { width: contentWidth, align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
