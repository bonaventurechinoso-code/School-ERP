import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest | Request,
  { params }: { params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    await prisma.tenantNotification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true, message: "Notification marked as read" });
  } catch (error: any) {
    console.error("[Notification Read Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to mark notification as read" }, { status: 500 });
  }
}

