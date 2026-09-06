import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // In a real integration, you would verify the signature from Paystack/Flutterwave here
    // e.g., const signature = req.headers.get("x-paystack-signature");
    // if (!isValidSignature(signature, body)) throw new Error("Invalid signature");
    
    // Mock Payload: { event: "charge.success", data: { reference: "...", amount: 5000, metadata: { schoolId: "..." } } }
    
    const { event, data } = body;
    
    if (event === "charge.success" || event === "payment.successful") {
      const schoolId = data?.metadata?.schoolId;
      const amount = data?.amount;
      
      if (!schoolId || !amount) {
        return NextResponse.json({ status: "error", message: "Missing schoolId or amount" }, { status: 400 });
      }

      await basePrisma.$transaction([
        basePrisma.school.update({
          where: { id: schoolId },
          data: { walletBalance: { increment: amount } }
        }),
        basePrisma.transaction.create({
          data: {
            schoolId: schoolId,
            type: "INCOME",
            category: "TOP_UP",
            amount: amount,
            description: `Wallet top-up via external gateway`,
            referenceId: data?.reference || null
          }
        })
      ]);
      
      console.log(`[Webhook] Wallet topped up for school ${schoolId} by ${amount}`);
    }

    return NextResponse.json({ status: "success" });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
