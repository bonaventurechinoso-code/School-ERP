import { NextResponse } from "next/server";

/**
 * POST /api/v1/webhooks/paystack
 * 100% Manual SaaS Subscription & Payment Verification Framework.
 * Automated payment webhooks are deactivated and short-circuited.
 */
export async function POST() {
  return NextResponse.json({ message: "Manual environment active" });
}

export async function GET() {
  return NextResponse.json({ message: "Manual environment active" });
}

