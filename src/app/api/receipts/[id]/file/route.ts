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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: "Missing payment ID" }, { status: 400 });
    }

    // Lookup payment proof in database
    const payment = await prisma.tenantSubscriptionPayment.findUnique({
      where: { id },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    // 1. Direct Cloud URL (e.g., Cloudinary)
    if (payment.receiptUrl?.startsWith("https://")) {
      return NextResponse.redirect(payment.receiptUrl);
    }

    // 2. Base64 database persistent stream
    if (payment.receiptData) {
      const buffer = Buffer.from(payment.receiptData, "base64");
      const mimeType = payment.receiptMimeType || "image/jpeg";
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `inline; filename="receipt_${payment.nipSessionId || payment.id}.${mimeType.includes("pdf") ? "pdf" : "jpg"}"`,
          "Cache-Control": "private, max-age=86400",
        },
      });
    }

    // 3. Data URI in receiptUrl
    if (payment.receiptUrl?.startsWith("data:")) {
      const matches = payment.receiptUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const mime = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": mime,
            "Content-Disposition": `inline; filename="receipt_${payment.nipSessionId || payment.id}.${mime.includes("pdf") ? "pdf" : "jpg"}"`,
            "Cache-Control": "private, max-age=86400",
          },
        });
      }
    }

    return NextResponse.json(
      {
        error: "Receipt file was saved to ephemeral disk before the enterprise persistence update. Please verify based on reference or request re-upload.",
        isExpiredEphemeral: true,
      },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("[RECEIPT_FILE_SERVE_ERROR]:", error);
    return NextResponse.json({ error: "Failed to retrieve receipt file" }, { status: 500 });
  }
}

