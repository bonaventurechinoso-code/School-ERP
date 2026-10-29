import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BankAccountsClient, { BankAccountItem } from "./BankAccountsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bank Account Configurations | Super Admin Finance",
  description: "Global corporate bank account settings for platform subscription collections",
};

export default async function SuperAdminBankAccountsPage() {
  // 1. Dual Server Session Resolution: getServerSession + getSession fallback (fixes 401 /api/auth/session)
  let session = await getServerSession(authOptions).catch(() => null);
  let user = (session?.user as any) || (await getSession().catch(() => null));
  if (user && !session) {
    session = { user } as any;
  }

  const rawRole = (user?.role || user?.userRole || "").toUpperCase();
  const isSuperAdmin = rawRole === "SUPER_ADMIN" || Boolean(user?.isSuperAdmin);

  if (!session || !isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 p-8 rounded-3xl shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto font-black text-2xl border border-rose-200 dark:border-rose-800">
            403
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Access Denied (403 Forbidden)
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Global Platform Bank Account Configurations are strictly restricted to Central Super-Administrators.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Fetch all bank accounts from Prisma without requiring any tenantId
  let rawAccounts: any[] = [];
  try {
    rawAccounts = await prisma.platformOwnerBankAccount.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("[SuperAdminBankAccountsPage] Error fetching bank accounts:", err);
  }

  // 3. Fallback to PlatformBankConfig if empty
  if (rawAccounts.length === 0) {
    try {
      const legacy = await prisma.platformBankConfig.findUnique({ where: { id: "global" } });
      if (legacy) {
        rawAccounts.push({
          id: legacy.id,
          bankName: legacy.bankName || "Wema Bank",
          accountNumber: legacy.accountNumber || "4058065110",
          accountName: "BONAVEE ICT CONCEPTS",
          bankCode: legacy.bankCode || "035",
          createdAt: new Date(),
        });
      }
    } catch {}
  }

  // 4. Default baseline account if still empty (Wema 4058065110 / BONAVEE ICT CONCEPTS)
  if (rawAccounts.length === 0) {
    rawAccounts.push({
      id: "global",
      bankName: "Wema Bank",
      accountNumber: "4058065110",
      accountName: "BONAVEE ICT CONCEPTS",
      bankCode: "035",
      createdAt: new Date(),
    });
  }

  // 5. Map to serializable props
  const initialAccounts: BankAccountItem[] = rawAccounts.map((a) => ({
    id: a.id,
    bankName: a.bankName,
    accountNumber: a.accountNumber,
    accountName: a.accountName,
    bankCode: a.bankCode || "035",
    createdAt: (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || Date.now())).toISOString(),
  }));

  return <BankAccountsClient initialAccounts={initialAccounts} />;
}
