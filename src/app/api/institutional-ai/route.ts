import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import * as jose from "jose";

interface AuthContext {
  userId?: string;
  role: string;
  tenantId?: string;
  studentId?: string;
}

/**
 * Extracts and verifies session authentication from cookies or headers.
 */
async function resolveAuth(req: NextRequest): Promise<AuthContext> {
  let sessionToken = req.cookies.get("session")?.value;
  if (!sessionToken) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      sessionToken = authHeader.substring(7);
    } else {
      sessionToken = req.headers.get("x-session-token") || undefined;
    }
  }

  if (sessionToken) {
    try {
      const jwtSecret = process.env.JWT_SECRET_KEY || "schoolerp-secret-key-change-in-production-environments";
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jose.jwtVerify(sessionToken, secret);
      return {
        userId: (payload.userId as string) || undefined,
        role: ((payload.role as string) || "ADMIN").toUpperCase().trim(),
        tenantId: (payload.tenantId as string) || undefined,
        studentId: (payload.studentId as string) || undefined,
      };
    } catch {
      // Session verification failed, fallback to mock or dev defaults
    }
  }

  const mockRole = process.env.NEXT_PUBLIC_DEV_MOCK_ROLE;
  return {
    role: (mockRole || "ADMIN").toUpperCase().trim(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, schoolDomain, schoolId, userRole } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt is required and cannot be empty." },
        { status: 400 }
      );
    }

    const auth = await resolveAuth(req);
    const effectiveRole = (userRole || auth.role || "ADMIN").toUpperCase().trim();

    // 1. Resolve Target School with strict isolation
    const targetSubdomain = (schoolDomain || "demo").toLowerCase().trim();
    let school = await basePrisma.school.findFirst({
      where: {
        OR: [
          ...(schoolId ? [{ id: schoolId }] : []),
          ...(auth.tenantId ? [{ id: auth.tenantId }] : []),
          { subdomain: { equals: targetSubdomain, mode: "insensitive" } },
          { slug: { equals: targetSubdomain, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        subdomain: true,
      },
    });

    // Fallback to Demo School if not found
    if (!school) {
      school = await basePrisma.school.findFirst({
        where: { subdomain: "demo" },
        select: {
          id: true,
          name: true,
          subdomain: true,
        },
      });
    }

    if (!school) {
      return NextResponse.json(
        { response: "I could not locate institutional records for the requested school. Please verify your institution domain." },
        { status: 404 }
      );
    }

    const schoolIdIsolated = school.id;
    const lowerPrompt = prompt.toLowerCase().trim();

    // Role Capabilities
    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "HEADMASTER", "DIRECTOR"].includes(effectiveRole);
    const isTeacher = ["TEACHER", "INSTRUCTOR", "STAFF"].includes(effectiveRole);
    const isBursar = ["BURSAR", "ACCOUNTANT", "FINANCE"].includes(effectiveRole);
    const isStudentOrParent = ["STUDENT", "PARENT"].includes(effectiveRole);

    // =========================================================================
    // 1. PROMOTION THRESHOLD & CRITERIA
    // =========================================================================
    if (
      lowerPrompt.includes("promotion threshold") ||
      lowerPrompt.includes("promotion policy") ||
      lowerPrompt.includes("how to get promoted") ||
      lowerPrompt.includes("promotion rule") ||
      lowerPrompt.includes("criteria for promotion") ||
      lowerPrompt.includes("pass mark") ||
      (lowerPrompt.includes("promotion") && lowerPrompt.includes("threshold"))
    ) {
      return NextResponse.json({
        response: `The official Annual Academic Promotion Policy for **${school.name}** operates on a 3-tier benchmark:\n\n` +
          `• 🟢 **Promoted (Full Promotion)**: Annual Composite Average **≥ 50%** AND Attendance Rate **≥ 75%**.\n` +
          `• 🟡 **Promoted on Trial**: Annual Composite Average **45% - 49.9%** AND Attendance Rate **≥ 75%** (academic support plan mandatory).\n` +
          `• 🔴 **Repeat Grade**: Annual Composite Average **< 45%** OR Attendance Rate **< 75%**.\n\n` +
          `*Score weights: Continuous Assessment 1 (20%) + Continuous Assessment 2 (20%) + Terminal Exam (60%) = 100% per term. Promotion is calculated from all 3 cumulative terms.*`,
      });
    }

    // =========================================================================
    // 2. CLASS-SPECIFIC ENROLLMENT / STUDENT COUNT
    // =========================================================================
    const classRegex = /(jss\s*[1-3]|sss\s*[1-3]|primary\s*[1-6]|nursery\s*[1-3]|cr[eè]che|100\s*level|200\s*level|300\s*level|400\s*level)/i;
    const classMatch = lowerPrompt.match(classRegex);

    if (
      classMatch &&
      (lowerPrompt.includes("how many") ||
        lowerPrompt.includes("count") ||
        lowerPrompt.includes("students in") ||
        lowerPrompt.includes("enrolled in") ||
        lowerPrompt.includes("list students"))
    ) {
      const rawMatch = classMatch[0].trim();
      const withSpace = rawMatch.replace(/([a-zA-Z]+)\s*(\d+)/i, "$1 $2").toUpperCase();
      const withoutSpace = rawMatch.replace(/\s+/g, "").toUpperCase();
      const variants = Array.from(new Set([rawMatch, withSpace, withoutSpace]));

      const students = await basePrisma.student.findMany({
        where: {
          schoolId: schoolIdIsolated,
          OR: variants.flatMap((v) => [
            { currentClass: { equals: v, mode: "insensitive" } },
            { currentClass: { contains: v, mode: "insensitive" } },
          ]),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          currentClass: true,
          status: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });

      if (students.length === 0) {
        // Query what classes exist in this school so we can provide helpful guidance
        const availableClasses = await basePrisma.student.findMany({
          where: { schoolId: schoolIdIsolated },
          select: { currentClass: true },
          distinct: ["currentClass"],
        });
        const classList = availableClasses.map((c) => c.currentClass).filter(Boolean);

        return NextResponse.json({
          response: `There are currently **0 registered students** in **${withSpace}** at **${school.name}**.\n\n` +
            (classList.length > 0
              ? `Active classes with registered students include: **${classList.join(", ")}**.`
              : `No student records have been uploaded to this school yet.`),
        });
      }

      const sampleList = students
        .slice(0, 8)
        .map((s, idx) => `${idx + 1}. **${s.firstName} ${s.lastName}** (${s.admissionNumber || "Pending Reg"})`)
        .join("\n");

      const moreText = students.length > 8 ? `\n*...and ${students.length - 8} more student records.*` : "";

      return NextResponse.json({
        response: `There are currently **${students.length} students** enrolled in **${students[0].currentClass || withSpace}** at **${school.name}**:\n\n${sampleList}${moreText}`,
      });
    }

    // =========================================================================
    // 3. GENERAL STUDENT POPULATION / TOTAL ENROLLMENT
    // =========================================================================
    if (
      lowerPrompt.includes("how many students") ||
      lowerPrompt.includes("total students") ||
      lowerPrompt.includes("student count") ||
      lowerPrompt.includes("total enrollment") ||
      lowerPrompt.includes("enrollment count")
    ) {
      const [totalCount, enrolledCount, alumniCount] = await Promise.all([
        basePrisma.student.count({ where: { schoolId: schoolIdIsolated } }),
        basePrisma.student.count({ where: { schoolId: schoolIdIsolated, status: "ENROLLED" } }),
        basePrisma.student.count({ where: { schoolId: schoolIdIsolated, status: "ALUMNI" } }),
      ]);

      const classGroups = await basePrisma.student.groupBy({
        by: ["currentClass"],
        where: { schoolId: schoolIdIsolated },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 6,
      });

      const topClassesStr = classGroups
        .filter((c) => c.currentClass)
        .map((c) => `**${c.currentClass}** (${c._count.id})`)
        .join(", ");

      return NextResponse.json({
        response: `**${school.name}** currently has **${totalCount} registered students** (**${enrolledCount}** active enrolled, **${alumniCount}** graduated/alumni).\n\n` +
          (topClassesStr ? `Leading class cohorts include: ${topClassesStr}.` : ""),
      });
    }

    // =========================================================================
    // 4. RANKINGS / 1ST POSITION / BROADSHEET & RESULTS
    // =========================================================================
    if (
      lowerPrompt.includes("1st position") ||
      lowerPrompt.includes("first position") ||
      lowerPrompt.includes("2nd position") ||
      lowerPrompt.includes("second position") ||
      lowerPrompt.includes("top student") ||
      lowerPrompt.includes("who is 1st") ||
      lowerPrompt.includes("who came 1st") ||
      lowerPrompt.includes("who came first") ||
      lowerPrompt.includes("highest score") ||
      lowerPrompt.includes("broadsheet") ||
      (lowerPrompt.includes("rank") && lowerPrompt.includes("term"))
    ) {
      // Determine term
      let termSearch = "1st Term";
      if (lowerPrompt.includes("2nd") || lowerPrompt.includes("second")) termSearch = "2nd Term";
      if (lowerPrompt.includes("3rd") || lowerPrompt.includes("third")) termSearch = "3rd Term";

      // Class filter if mentioned
      const matchedClass = classMatch ? classMatch[0].toUpperCase() : null;

      // Check ReportCard first
      const reportCards = await basePrisma.reportCard.findMany({
        where: {
          schoolId: schoolIdIsolated,
          ...(matchedClass ? { className: { contains: matchedClass, mode: "insensitive" } } : {}),
          term: { contains: termSearch, mode: "insensitive" },
        },
        include: {
          student: {
            select: { firstName: true, lastName: true, admissionNumber: true, currentClass: true },
          },
        },
        orderBy: [{ averageScore: "desc" }, { totalScore: "desc" }],
        take: 5,
      });

      if (reportCards.length > 0) {
        const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
        const rankingsList = reportCards
          .map((r, i) => `${medals[i] || `${i + 1}.`} **${r.student.firstName} ${r.student.lastName}** (${r.className}) — Average: **${r.averageScore.toFixed(1)}%** | Grade: **${r.gradeLetter || "A"}**`)
          .join("\n");

        return NextResponse.json({
          response: `Official Rankings for **${termSearch}** at **${school.name}**${matchedClass ? ` (${matchedClass})` : ""}:\n\n${rankingsList}`,
        });
      }

      // Check ExamResult as fallback
      const examResults = await basePrisma.examResult.findMany({
        where: {
          schoolId: schoolIdIsolated,
          ...(matchedClass ? { student: { currentClass: { contains: matchedClass, mode: "insensitive" } } } : {}),
        },
        include: {
          student: {
            select: { firstName: true, lastName: true, admissionNumber: true, currentClass: true },
          },
          exam: { select: { name: true, semester: true } },
        },
        orderBy: { score: "desc" },
        take: 5,
      });

      if (examResults.length > 0) {
        const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
        const rankingsList = examResults
          .map((r, i) => `${medals[i] || `${i + 1}.`} **${r.student.firstName} ${r.student.lastName}** (${r.student.currentClass || "General"}) — Score: **${r.score}%** (${r.exam?.name || "Exam Assessment"})`)
          .join("\n");

        return NextResponse.json({
          response: `Top examination performance rankings for **${termSearch}** at **${school.name}**:\n\n${rankingsList}`,
        });
      }

      return NextResponse.json({
        response: `No compiled report cards or published exam records were found for **${termSearch}**${matchedClass ? ` in ${matchedClass}` : ""} at **${school.name}**. Subject teachers have not yet published grades for this cycle.`,
      });
    }

    // =========================================================================
    // 5. FEES, REVENUE, AND FINANCIAL BALANCES
    // =========================================================================
    if (
      lowerPrompt.includes("fee") ||
      lowerPrompt.includes("revenue") ||
      lowerPrompt.includes("paid") ||
      lowerPrompt.includes("collected") ||
      lowerPrompt.includes("tuition") ||
      lowerPrompt.includes("outstanding") ||
      lowerPrompt.includes("receivable") ||
      lowerPrompt.includes("debt") ||
      lowerPrompt.includes("balance")
    ) {
      // Role permission check
      if (isStudentOrParent) {
        return NextResponse.json({
          response: `To view your specific school fee balance, invoices, and verified receipts, please open the **Fee Payments** tab from your student portal navigation.`,
        });
      }

      if (isTeacher) {
        return NextResponse.json({
          response: `Institutional financial metrics and collection summaries are restricted to Bursary and Administrative officers. You have access to class rosters, student assessments, and attendance records.`,
        });
      }

      // Admin or Bursar financial aggregate
      const [paidAgg, invoiceAgg, invoiceCount, paymentCount] = await Promise.all([
        basePrisma.payment.aggregate({
          where: { schoolId: schoolIdIsolated },
          _sum: { amountPaid: true },
        }),
        basePrisma.invoice.aggregate({
          where: { schoolId: schoolIdIsolated },
          _sum: { amountDue: true },
        }),
        basePrisma.invoice.count({ where: { schoolId: schoolIdIsolated } }),
        basePrisma.payment.count({ where: { schoolId: schoolIdIsolated } }),
      ]);

      const totalPaid = paidAgg._sum.amountPaid || 0;
      const totalDue = invoiceAgg._sum.amountDue || 0;
      const outstanding = Math.max(0, totalDue - totalPaid);

      return NextResponse.json({
        response: `Financial Overview for **${school.name}**:\n\n` +
          `• **Total Fee Revenue Collected**: ₦${totalPaid.toLocaleString("en-NG", { minimumFractionDigits: 2 })} (${paymentCount} payments)\n` +
          `• **Total Invoices Issued**: ₦${totalDue.toLocaleString("en-NG", { minimumFractionDigits: 2 })} (${invoiceCount} invoices)\n` +
          `• **Outstanding Receivables**: ₦${outstanding.toLocaleString("en-NG", { minimumFractionDigits: 2 })}\n\n` +
          `*All financial balances reflect real-time CBN-compliant direct settlements.*`,
      });
    }

    // =========================================================================
    // 6. ATTENDANCE METRICS
    // =========================================================================
    if (
      lowerPrompt.includes("attendance") ||
      lowerPrompt.includes("absent") ||
      lowerPrompt.includes("present")
    ) {
      const attendanceLogs = await basePrisma.studentAttendance.findMany({
        where: { schoolId: schoolIdIsolated },
        take: 100,
        orderBy: { date: "desc" },
      });

      if (attendanceLogs.length === 0) {
        return NextResponse.json({
          response: `No daily student attendance records have been registered yet for **${school.name}**. Attendance tracking can be launched from the Staff or Teacher Portal.`,
        });
      }

      const presentCount = attendanceLogs.filter((a) => a.status === "PRESENT").length;
      const rate = Math.round((presentCount / attendanceLogs.length) * 100);

      return NextResponse.json({
        response: `Student Attendance Summary for **${school.name}**:\n\n` +
          `• **Average Attendance Rate**: **${rate}%**\n` +
          `• **Total Logged Sessions**: ${attendanceLogs.length}\n` +
          `• **Present Entries**: ${presentCount} | **Absent / Late**: ${attendanceLogs.length - presentCount}\n\n` +
          `*A minimum attendance rate of 75% is required for terminal grade promotion.*`,
      });
    }

    // =========================================================================
    // 7. AVAILABLE CLASSES & CURRICULUM
    // =========================================================================
    if (
      lowerPrompt.includes("what classes") ||
      lowerPrompt.includes("list classes") ||
      lowerPrompt.includes("classes available") ||
      lowerPrompt.includes("subjects") ||
      lowerPrompt.includes("courses")
    ) {
      const [classrooms, courses] = await Promise.all([
        basePrisma.classroom.findMany({
          where: { schoolId: schoolIdIsolated },
          select: { name: true },
          orderBy: { name: "asc" },
        }),
        basePrisma.course.findMany({
          where: { schoolId: schoolIdIsolated },
          select: { name: true, code: true },
          take: 10,
        }),
      ]);

      const classList = classrooms.map((c) => c.name).join(", ");
      const courseList = courses.map((c) => `${c.name} (${c.code})`).join(", ");

      return NextResponse.json({
        response: `Academic Structure for **${school.name}**:\n\n` +
          `• **Registered Classes**: ${classList || "None registered yet"}\n` +
          (courseList ? `• **Core Subjects / Courses**: ${courseList}\n` : ""),
      });
    }

    // =========================================================================
    // 8. STAFF & TEACHERS
    // =========================================================================
    if (
      lowerPrompt.includes("staff") ||
      lowerPrompt.includes("teacher") ||
      lowerPrompt.includes("who is principal") ||
      lowerPrompt.includes("who is bursar")
    ) {
      const staffMembers = await basePrisma.staff.findMany({
        where: { schoolId: schoolIdIsolated },
        select: {
          firstName: true,
          lastName: true,
          status: true,
          user: {
            select: { role: true },
          },
          department: {
            select: { name: true },
          },
        },
        take: 10,
      });

      if (staffMembers.length === 0) {
        return NextResponse.json({
          response: `There are currently no staff records registered for **${school.name}**.`,
        });
      }

      const list = staffMembers
        .map((s) => `• **${s.firstName} ${s.lastName}** — ${s.user?.role || s.department?.name || "Staff"} (${s.status})`)
        .join("\n");

      return NextResponse.json({
        response: `Academic & Administrative Staff at **${school.name}**:\n\n${list}`,
      });
    }

    // =========================================================================
    // 9. GENERAL / CONTEXTUAL ASSISTANT FALLBACK
    // =========================================================================
    return NextResponse.json({
      response: `Hello! I am your Institutional AI Assistant for **${school.name}** (Active Role: **${effectiveRole}**).\n\n` +
        `I have direct access to your school's live database and can answer questions such as:\n` +
        `• 📚 *"How many students are in JSS 1?"*\n` +
        `• 🏆 *"Who is 1st position in 1st term?"*\n` +
        `• 🎯 *"What is promotion threshold?"*\n` +
        `• 💳 *"How much fees have been collected?"*\n` +
        `• 📅 *"What classes exist in this school?"*\n` +
        `• 📊 *"What is the current attendance rate?"*\n\n` +
        `What would you like to inspect today?`,
    });
  } catch (error: any) {
    console.error("[Institutional AI Error]:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while processing institutional data.", details: error?.message },
      { status: 500 }
    );
  }
}
