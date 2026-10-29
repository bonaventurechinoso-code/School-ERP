import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest | Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: "Missing payment ID" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const payment = await prisma.tenantSubscriptionPayment.findUnique({
      where: { id },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    const user = session.user as any;
    const isSuperAdmin =
      user.role === "SUPER_ADMIN" ||
      user.userRole === "SUPER_ADMIN" ||
      Boolean(user.isSuperAdmin);

    const userTenantId = (user.tenantId || "").trim();
    if (userTenantId !== payment.tenantId && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden: Access denied to this payment receipt" }, { status: 403 });
    }

    // 1. Permanent Base64 storage in database
    if (payment.receiptData) {
      const rawBase64 = payment.receiptData.includes(",")
        ? payment.receiptData.split(",")[1]
        : payment.receiptData;
      const buffer = Buffer.from(rawBase64, "base64");
      const mimeType = payment.receiptMimeType || "image/jpeg";
      const ext = mimeType.includes("pdf") ? "pdf" : "jpg";

      return new Response(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `inline; filename="receipt_${payment.nipSessionId || payment.id}.${ext}"`,
          "Cache-Control": "private, max-age=86400",
        },
      });
    }

    // 2. Direct external HTTPS URL (e.g. Cloudinary) - only if not ephemeral /uploads/
    if (payment.receiptUrl?.startsWith("https://") && !payment.receiptUrl.includes("/uploads/")) {
      return NextResponse.redirect(payment.receiptUrl);
    }

    // 3. Fallback for legacy ephemeral files deleted during deploy
    return NextResponse.json(
      {
        error: "File expired before persistence fix",
        code: "FILE_EXPIRED",
        isExpiredEphemeral: true,
      },
      { status: 410 }
    );
  } catch (error: any) {
    console.error("[RECEIPT_FILE_STREAM_ERROR]:", error);
    return NextResponse.json({ error: "Failed to stream receipt file" }, { status: 500 });
  }
}
