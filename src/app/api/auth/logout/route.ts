import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeDatabaseSession } from "@/lib/session-manager";
import { REFRESH_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_NAME } from "@/lib/dual-token";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value || cookieStore.get("next-auth.session-token")?.value;

    if (sessionCookie) {
      await revokeDatabaseSession(sessionCookie).catch(() => {});
    }

    cookieStore.delete("session");
    cookieStore.delete("next-auth.session-token");
    cookieStore.delete("__Secure-next-auth.session-token");
    cookieStore.delete(REFRESH_TOKEN_COOKIE_NAME);
    cookieStore.delete(ACCESS_TOKEN_COOKIE_NAME);

    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return NextResponse.json({ success: true });
  }
}
