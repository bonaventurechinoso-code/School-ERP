import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    const rawRole = (user?.role || user?.userRole || "").toUpperCase();
    const isSuperAdmin = rawRole === "SUPER_ADMIN" || Boolean(user?.isSuperAdmin);

    if (!session || !isSuperAdmin) {
      return NextResponse.json({ error: "Access Denied (403 Forbidden)" }, { status: 403 });
    }

    // 1. Fetch TenantSubscriptionPayment records
    let payments: any[] = [];
    try {
      payments = await prisma.tenantSubscriptionPayment.findMany({
        orderBy: { submittedAt: "desc" },
        include: {
          tenant: true,
        },
      });
    } catch (e) {
      console.warn("[Receipts API] Error fetching TenantSubscriptionPayment:", e);
    }

    // 2. Fetch legacy SubscriptionPayment records if any and merge
    try {
      const legacyPayments = await prisma.subscriptionPayment.findMany({
        orderBy: { createdAt: "desc" },
        include: { tenant: true },
      });

      const existingIds = new Set(payments.map((p) => p.id));
      for (const lp of legacyPayments) {
        if (!existingIds.has(lp.id)) {
          payments.push({
            id: lp.id,
            tenantId: lp.tenantId,
            schoolSlug: lp.tenant?.subdomain || lp.tenantId,
            schoolName: lp.tenant?.schoolName || "Institution",
            amount: lp.amount || 0,
            nipSessionId: lp.id,
            senderBank: "Bank Transfer",
            receiptUrl: lp.receiptUrl,
            accountName: null,
            status: lp.status === "PENDING_VERIFICATION" ? "PENDING" : lp.status,
            submittedAt: lp.createdAt,
            verifiedAt: lp.verifiedAt,
            verifiedBy: null,
            subscriptionStart: null,
            subscriptionEnd: null,
            notes: lp.rejectionReason,
            tenant: lp.tenant,
          });
        }
      }
    } catch {}

    // Sort all descending
    payments.sort((a, b) => {
      const dateA = new Date(a.submittedAt || a.createdAt).getTime();
      const dateB = new Date(b.submittedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    const pending = payments.filter((p) => p.status === "PENDING" || p.status === "PENDING_VERIFICATION").length;
    const verified = payments.filter((p) => p.status === "VERIFIED").length;
    const rejected = payments.filter((p) => p.status === "REJECTED").length;
    const total = payments.length;

    return NextResponse.json({
      success: true,
      payments,
      counts: {
        total,
        pending,
        verified,
        rejected,
      },
    });
  } catch (error: any) {
    console.error("[Receipts API GET Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch receipts." }, { status: 500 });
  }
}

