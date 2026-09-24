import { NextResponse } from "next/server";
import { verifyPasswordResetToken } from "@/lib/security-service";

export async function POST(req: Request) {
  try {
    const { token, schoolDomain } = await req.json();

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Recovery token is required." },
        { status: 400 }
      );
    }

    const check = await verifyPasswordResetToken(token, schoolDomain);

    if (!check.valid) {
      return NextResponse.json(
        { valid: false, error: check.error || "Invalid or expired recovery token." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: check.email,
    });
  } catch (error: any) {
    console.error("[VERIFY_RESET_TOKEN_ERROR]:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to verify token." },
      { status: 500 }
    );
  }
}
