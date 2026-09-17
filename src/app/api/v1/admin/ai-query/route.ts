import { NextRequest, NextResponse } from "next/server";
import { getTenantClient, basePrisma } from "@/lib/tenant-prisma";
import * as jose from "jose";

export async function POST(req: NextRequest) {
  try {
    let sessionToken = req.cookies.get("session")?.value;
    if (!sessionToken) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        sessionToken = authHeader.substring(7);
      } else {
        sessionToken = req.headers.get("x-session-token") || undefined;
      }
    }

    let tenantId = "";
    let role = "ADMIN";

    if (sessionToken) {
      try {
        const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jose.jwtVerify(sessionToken, secret);
        role = (payload.role as string) || "ADMIN";
        tenantId = (payload.tenantId as string) || "";
      } catch (err) {
        console.warn("[AI Route] Session token verification failed, checking fallback:", err);
      }
    }

    // Role Guard: Allow administrative, academic, and bursary staff
    const allowedRoles = ["ADMIN", "SUPER_ADMIN", "TEACHER", "BURSAR", "ACCOUNTANT", "PRINCIPAL", "STAFF"];
    if (role && !allowedRoles.includes(role.toUpperCase())) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions for Institutional AI" }, { status: 403 });
    }

    // Tenant fallback for local dev if missing
    if (!tenantId) {
      const defaultSchool = await basePrisma.school.findFirst({
        where: { subdomain: "greenwood" },
      });
      tenantId = defaultSchool?.id || "";
    }

    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized: tenant context missing" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required and cannot be empty." }, { status: 400 });
    }

    const lowerPrompt = prompt.toLowerCase().trim();
    const prisma = getTenantClient(tenantId);

    // 1. Total student count / Enrollment queries
    if (
      lowerPrompt.includes("number of students") ||
      lowerPrompt.includes("total student count") ||
      lowerPrompt.includes("how many students") ||
      lowerPrompt.includes("enrollment")
    ) {
      const totalStudents = await prisma.student.count({
        where: { schoolId: tenantId },
      });
      return NextResponse.json({
        response: `Your institution currently has a total of **${totalStudents}** registered students across all active grade levels.`,
      });
    }

    // 2. Fee Collection / Revenue queries
    if (
      lowerPrompt.includes("collected") ||
      lowerPrompt.includes("revenue") ||
      lowerPrompt.includes("paid") ||
      lowerPrompt.includes("total payment")
    ) {
      const paidAggregate = await prisma.payment.aggregate({
        where: { schoolId: tenantId },
        _sum: { amountPaid: true },
      });
      const totalPaid = paidAggregate._sum.amountPaid || 0;
      return NextResponse.json({
        response: `Total fee revenue collected to date is **₦${totalPaid.toLocaleString("en-NG", { minimumFractionDigits: 2 })}**.`,
      });
    }

    // 3. Outstanding Balance / Receivables queries
    if (
      lowerPrompt.includes("outstanding") ||
      lowerPrompt.includes("receivable") ||
      lowerPrompt.includes("unpaid") ||
      lowerPrompt.includes("debt") ||
      lowerPrompt.includes("balance")
    ) {
      const [invoicedAgg, paidAgg] = await Promise.all([
        prisma.invoice.aggregate({
          where: { schoolId: tenantId },
          _sum: { amountDue: true },
        }),
        prisma.payment.aggregate({
          where: { schoolId: tenantId },
          _sum: { amountPaid: true },
        }),
      ]);
      const totalInvoiced = invoicedAgg._sum.amountDue || 0;
      const totalPaid = paidAgg._sum.amountPaid || 0;
      const outstanding = Math.max(0, totalInvoiced - totalPaid);
      return NextResponse.json({
        response: `Current outstanding student receivables across all grade levels stand at **₦${outstanding.toLocaleString("en-NG", { minimumFractionDigits: 2 })}**.`,
      });
    }

    // 4. Invoiced / Billing queries
    if (
      lowerPrompt.includes("invoiced") ||
      lowerPrompt.includes("billing") ||
      lowerPrompt.includes("total fees") ||
      lowerPrompt.includes("tuition")
    ) {
      const [invoicedAgg, invoiceCount] = await Promise.all([
        prisma.invoice.aggregate({
          where: { schoolId: tenantId },
          _sum: { amountDue: true },
        }),
        prisma.invoice.count({
          where: { schoolId: tenantId },
        }),
      ]);
      const totalInvoiced = invoicedAgg._sum.amountDue || 0;
      return NextResponse.json({
        response: `A total of **${invoiceCount}** invoices have been issued, amounting to **₦${totalInvoiced.toLocaleString("en-NG", { minimumFractionDigits: 2 })}**.`,
      });
    }

    // 5. Institutional Expenses / Cash flow queries
    if (
      lowerPrompt.includes("expense") ||
      lowerPrompt.includes("disbursement") ||
      lowerPrompt.includes("expenditure") ||
      lowerPrompt.includes("cost")
    ) {
      const expenseAgg = await prisma.transaction.aggregate({
        where: { schoolId: tenantId, type: "EXPENSE" },
        _sum: { amount: true },
      });
      const totalExpenses = expenseAgg._sum.amount || 0;
      return NextResponse.json({
        response: `Total recorded institutional operational expenses are **₦${totalExpenses.toLocaleString("en-NG", { minimumFractionDigits: 2 })}**.`,
      });
    }

    // 6. Generic analytical helper
    return NextResponse.json({
      response: `Institutional AI Analysis for Greenwood Academy: I can summarize **total student count**, **total invoiced fees**, **collections to date**, **outstanding receivables**, and **operational expenses**. Ask me for any of these metrics!`,
    });
  } catch (error: any) {
    console.error("AI Route Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
