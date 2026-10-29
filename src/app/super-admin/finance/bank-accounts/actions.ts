"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const BankAccountSchema = z.object({
  id: z.string().optional().default("global"),
  bankName: z.string().min(2, "Bank name must be at least 2 characters"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
  accountName: z.string().min(2, "Account name must be at least 2 characters"),
  bankCode: z.string().optional().nullable(),
});

export async function saveBankAccountAction(data: {
  id?: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string | null;
}) {
  try {
    // 1. Dual Server Session Check: getServerSession + getSession fallback
    let session = await getServerSession(authOptions).catch(() => null);
    let user = (session?.user as any) || (await getSession().catch(() => null));
    if (user && !session) {
      session = { user } as any;
    }

    const rawRole = (user?.role || user?.userRole || "").toUpperCase();
    const isSuperAdmin = rawRole === "SUPER_ADMIN" || Boolean(user?.isSuperAdmin);

    if (!session || !isSuperAdmin) {
      return { success: false, error: "Unauthorized: Super Admin access required." };
    }

    // 2. Validate input on the server using pinned Zod 3.23.8
    const parseResult = BankAccountSchema.safeParse(data);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || "Validation failed.",
      };
    }

    const { id, bankName, accountNumber, accountName, bankCode } = parseResult.data;
    const targetId = id || "global";

    // 3. Upsert PlatformOwnerBankAccount
    await prisma.platformOwnerBankAccount.upsert({
      where: { id: targetId },
      create: {
        id: targetId,
        bankName,
        accountNumber,
        accountName,
        bankCode: bankCode || "035",
      },
      update: {
        bankName,
        accountNumber,
        accountName,
        bankCode: bankCode || "035",
      },
    });

    // 4. If this is the primary or global account, also update legacy PlatformBankConfig
    if (targetId === "global" || !id) {
      await prisma.platformBankConfig
        .upsert({
          where: { id: "global" },
          create: {
            id: "global",
            bankName,
            accountNumber,
            bankCode: bankCode || "035",
          },
          update: {
            bankName,
            accountNumber,
            bankCode: bankCode || "035",
          },
        })
        .catch(() => {});
    }

    // 5. Revalidate affected paths
    revalidatePath("/super-admin/finance/bank-accounts");
    revalidatePath("/super-admin/finance/bank-account");
    revalidatePath("/super-admin/billing/bank-accounts");
    revalidatePath("/super-admin/billings/bank-accounts");
    revalidatePath("/super-admin/settings/banking");
    revalidatePath("/dashboard/subscription");

    return { success: true };
  } catch (err: any) {
    console.error("[saveBankAccountAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Failed to update platform corporate bank configuration.",
    };
  }
}
