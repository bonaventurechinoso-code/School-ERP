import { NextRequest, NextResponse } from "next/server";
import {
  getPlatformNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/admin-notifications";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const data = await getPlatformNotifications(limit);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API_GET_NOTIFICATIONS_ERROR]:", error);
    return NextResponse.json(
      { notifications: [], unreadCount: 0, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, all } = body;

    if (all) {
      await markAllNotificationsAsRead();
    } else if (id && typeof id === "string") {
      await markNotificationAsRead(id);
    } else {
      return NextResponse.json(
        { error: "Must provide either 'id' or 'all: true'" },
        { status: 400 }
      );
    }

    const updated = await getPlatformNotifications(20);
    return NextResponse.json({
      success: true,
      unreadCount: updated.unreadCount,
    });
  } catch (error: any) {
    console.error("[API_PATCH_NOTIFICATIONS_ERROR]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update notification" },
      { status: 500 }
    );
  }
}
