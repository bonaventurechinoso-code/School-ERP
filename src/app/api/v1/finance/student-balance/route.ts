import { NextRequest, NextResponse } from "next/server";
import { getTenantClient, basePrisma } from "@/lib/tenant-prisma";
import * as jose from "jose";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim();
    let schoolId = searchParams.get("schoolId");

    if (!query) {
      return NextResponse.json({ success: false, error: "Search query is required." }, { status: 400 });
    }

    // Resolve tenant session or explicit schoolId
    let tenantId = schoolId;
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
        const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jose.jwtVerify(sessionToken, secret);
        if (payload.tenantId) {
          tenantId = payload.tenantId as string;
        }
      } catch (e) {
        // Fallback to query param schoolId if token is invalid or in local dev
      }
    }

    if (!tenantId) {
      // Look up first active school as fallback
      const defaultSchool = await basePrisma.school.findFirst({
        where: { subdomain: "greenwood" },
      });
      tenantId = defaultSchool?.id || null;
    }

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Tenant context not found." }, { status: 400 });
    }

    const prisma = getTenantClient(tenantId);
    const mode = "insensitive" as const;

    // Parse search terms (e.g., "Nnamdi nwaosu")
    const terms = query.split(/\s+/).filter(Boolean);

    // Build multi-attribute student search query
    let student = await prisma.student.findFirst({
      where: {
        schoolId: tenantId,
        OR: [
          { id: query },
          { admissionNumber: { equals: query, mode } },
          { admissionNumber: { contains: query, mode } },
          { firstName: { contains: query, mode } },
          { lastName: { contains: query, mode } },
          // Multi-word name combinations
          ...(terms.length >= 2
            ? [
                {
                  AND: [
                    { firstName: { contains: terms[0], mode } },
                    { lastName: { contains: terms[1], mode } },
                  ],
                },
                {
                  AND: [
                    { firstName: { contains: terms[1], mode } },
                    { lastName: { contains: terms[0], mode } },
                  ],
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        currentClass: true,
        schoolId: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        {
          success: false,
          error: `No student ledger found matching "${query}". Please check the student name or admission number.`,
        },
        { status: 404 }
      );
    }

    // Fetch corresponding student invoices and payment history from PostgreSQL via Prisma
    const [invoices, feeTemplate] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          schoolId: tenantId,
          studentId: student.id,
        },
        include: {
          payments: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.feeTemplate.findFirst({
        where: { schoolId: tenantId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Calculate total outstanding ledger balance
    let totalInvoiced = 0;
    let totalPaid = 0;
    let pendingInvoice = invoices.find((inv) => inv.status !== "PAID");

    for (const inv of invoices) {
      totalInvoiced += inv.amountDue;
      for (const p of inv.payments) {
        totalPaid += p.amountPaid;
      }
    }

    const ledgerBalance = Math.max(0, totalInvoiced - totalPaid);

    // Resolve Amount Due
    let amountDue = 0;
    if (pendingInvoice) {
      const invPaid = pendingInvoice.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      amountDue = Math.max(0, pendingInvoice.amountDue - invPaid);
    } else if (ledgerBalance > 0) {
      amountDue = ledgerBalance;
    } else {
      amountDue = feeTemplate?.defaultAmount || 120000;
    }

    // Resolve Due Date (formatted as YYYY-MM-DD)
    let dueDate = "";
    if (pendingInvoice?.dueDate) {
      dueDate = new Date(pendingInvoice.dueDate).toISOString().split("T")[0];
    } else {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 14);
      dueDate = defaultDate.toISOString().split("T")[0];
    }

    // Resolve Description
    let description = "";
    if (pendingInvoice?.description) {
      description = pendingInvoice.description;
    } else if (ledgerBalance > 0) {
      description = `Outstanding Ledger Balance Settlement - ${student.firstName} ${student.lastName}`;
    } else {
      description = feeTemplate?.name
        ? `${feeTemplate.name} - ${student.firstName} ${student.lastName}`
        : `1st Term Tuition & Feeding - ${student.firstName} ${student.lastName}`;
    }

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        name: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        currentClass: student.currentClass,
      },
      ledgerBalance,
      amountDue,
      dueDate,
      description,
    });
  } catch (error: any) {
    console.error("[StudentBalanceAPI Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to lookup student ledger balance." },
      { status: 500 }
    );
  }
}
