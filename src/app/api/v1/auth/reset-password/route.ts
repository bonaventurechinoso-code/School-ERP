import { NextResponse } from "next/server";
import { completePasswordReset } from "@/lib/security-service";

export async function POST(req: Request) {
  try {
    const { token, newPassword, confirmPassword } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Recovery token is required.", code: "TOKEN_REQUIRED" },
        { status: 400 }
      );
    }

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "New password and password confirmation are required.", code: "FIELDS_REQUIRED" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match.", code: "PASSWORD_MISMATCH" },
        { status: 400 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const result = await completePasswordReset(token, newPassword, clientIp);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Password reset failed.", code: "RESET_FAILED" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your password has been successfully reset. You may now sign in with your new credentials.",
    });
  } catch (error: any) {
    console.error("[AUTH_RESET_PASSWORD_ERROR]:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while resetting password.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
