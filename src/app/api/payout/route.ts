import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { payrollId, amount, destinationAccount } = body;

    // TODO: In the future, integrate with a payment gateway here.
    // e.g., Stripe Connect: stripe.transfers.create({ amount, destination })
    // e.g., Flutterwave: flw.Transfer.initiate({ amount, account_bank, account_number })

    console.log(`[API /api/payout] Simulating payout of ${amount} to ${destinationAccount} for payroll ${payrollId}`);

    // Simulating API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return NextResponse.json({
      status: "success",
      message: "Payout processed successfully (SIMULATED)",
      transactionId: `txn_sim_${Date.now()}`
    });
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
