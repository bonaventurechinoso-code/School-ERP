import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/[tenant]/fees/initialize
 *
 * DEPRECATED / DISABLED:
 * Direct online payment gateway fee collection for school tuition has been disabled.
 * The platform strictly operates under 100% Direct Manual Bank Transfer.
 * Schools collect fees directly into their own commercial bank accounts with 0% platform split.
 * Parents transfer via their bank app and upload proof of payment for bursar verification.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params;

  return NextResponse.json(
    {
      error: "Direct online gateway checkout for school fees has been decommissioned. All school fees must be paid via Direct Manual Bank Transfer to the school's commercial bank account. Please transfer funds and submit proof of payment via the student portal for bursar verification.",
      tenant,
      collectionMode: "MANUAL_BANK_TRANSFER",
      instructionsUrl: `/${tenant}/portal/student`,
    },
    { status: 410 }
  );
}
