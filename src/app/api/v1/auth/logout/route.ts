import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeDatabaseSession } from "@/lib/session-manager";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (sessionCookie) {
      await revokeDatabaseSession(sessionCookie);
    } else {
      cookieStore.delete("session");
    }

    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
