import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, authenticated: false, session: null },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        session,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error("[API_AUTH_SESSION_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve active session", session: null },
      { status: 500 }
    );
  }
}
