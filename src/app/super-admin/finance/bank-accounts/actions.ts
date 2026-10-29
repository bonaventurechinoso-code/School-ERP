"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { prisma } from "@/lib/prisma";

// Lightweight Zod-compatible validator (no external zod dependency required)
export const z = {
  string: () => {
    let minLen = 0;
    let minMsg = "";
    let regexPattern: RegExp | null = null;
    let regexMsg = "";
    let isOptional = false;
    let isTrim = false;

    const validator = {
      min(len: number, msg?: string) {
        minLen = len;
        minMsg = msg || `Must be at least ${len} characters`;
        return validator;
      },
      trim() {
        isTrim = true;
        return validator;
      },
      regex(pattern: RegExp, msg?: string) {
        regexPattern = pattern;
        regexMsg = msg || "Invalid format";
        return validator;
      },
      optional() {
        isOptional = true;
        return validator;
      },
      nullable() {
        isOptional = true;
        return validator;
      },
      _validate(val: any) {
        if (val === undefined || val === null || val === "") {
          if (isOptional) return { success: true, data: val };
          return { success: false, error: "Field is required" };
        }
        let str = String(val);
        if (isTrim) str = str.trim();
        if (minLen && str.length < minLen) {
          return { success: false, error: minMsg };
        }
        if (regexPattern && !regexPattern.test(str)) {
          return { success: false, error: regexMsg };
        }
        return { success: true, data: str };
      },
    };
    return validator;
  },
  object: (schema: Record<string, any>) => ({
    safeParse: (data: any) => {
      const errors: Array<{ message: string }> = [];
      const result: Record<string, any> = {};

      for (const [key, fieldValidator] of Object.entries(schema)) {
        const val = data?.[key];
        const res = (fieldValidator as any)._validate(val);
        if (!res.success) {
          errors.push({ message: res.error });
        } else {
          result[key] = res.data;
        }
      }

      if (errors.length > 0) {
        return {
          success: false as const,
          error: { issues: errors },
          data: undefined,
        };
      }
      return {
        success: true as const,
        data: result,
        error: undefined,
      };
    },
  }),
};

const BankAccountSchema = z.object({
  bankName: z.string().min(2, "Bank name must be at least 2 characters"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
  accountName: z.string().min(2, "Account name must be at least 2 characters"),
  bankCode: z.string().optional().nullable(),
});

export async function updateGlobalBankAccountAction(data: {
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string | null;
}) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    const rawRole = (user?.role || user?.userRole || "").toUpperCase();
    const isSuperAdmin = rawRole === "SUPER_ADMIN" || Boolean(user?.isSuperAdmin);

    if (!session || !isSuperAdmin) {
      return { success: false, error: "Unauthorized: Super Admin access required" };
    }

    const parsed = BankAccountSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Validation failed",
      };
    }

    const { bankName, accountNumber, accountName, bankCode } = parsed.data;

    // 1. Upsert PlatformOwnerBankAccount
    await prisma.platformOwnerBankAccount.upsert({
      where: { id: "global" },
      create: {
        id: "global",
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

    // 2. Also keep legacy PlatformBankConfig in sync for backward compatibility
    try {
      await prisma.platformBankConfig.upsert({
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
      });
    } catch {}

    revalidatePath("/super-admin/finance/bank-accounts");
    revalidatePath("/super-admin/finance/bank-account");
    revalidatePath("/dashboard/subscription");

    return { success: true };
  } catch (err: any) {
    console.error("[updateGlobalBankAccountAction] Error:", err);
    return { success: false, error: err.message || "Failed to update bank configuration" };
  }
}

