"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { prisma } from "@/lib/prisma";

export async function submitSubscriptionPaymentAction(params: {
  tenantId: string;
  amount: number;
  receiptUrl: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { success: false, error: "Authentication required to submit payment proof." };
    }

    const { tenantId, amount, receiptUrl } = params;

    if (!tenantId || !receiptUrl || !amount) {
      return { success: false, error: "Missing required payment proof parameters." };
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return { success: false, error: "Target tenant not found in platform database." };
    }

    // Create subscription payment record
    const payment = await prisma.subscriptionPayment.create({
      data: {
        tenantId,
        amount,
        receiptUrl,
        status: "PENDING_VERIFICATION",
      },
    });

    revalidatePath("/dashboard/subscription");
    revalidatePath("/super-admin/finance/receipts");

    return {
      success: true,
      paymentId: payment.id,
      message: "Payment proof uploaded successfully! Awaiting Super Admin verification.",
    };
  } catch (err: any) {
    console.error("[submitSubscriptionPaymentAction] Error:", err);
    return {
      success: false,
      error: err.message || "Failed to submit subscription payment proof.",
    };
  }
}

