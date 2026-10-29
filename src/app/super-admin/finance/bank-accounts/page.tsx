import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { prisma } from "@/lib/prisma";
import BankAccountsClient from "./BankAccountsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bank Account Configurations | Super Admin Finance",
  description: "Global corporate bank account settings for platform subscription collections",
};

export default async function SuperAdminBankAccountsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
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

  // Pure global queries — strictly NO tenantId / useTenant / useParams requirements
  let ownerBank = await prisma.platformOwnerBankAccount.findFirst().catch(() => null);
  let legacyBank = await prisma.platformBankConfig.findUnique({ where: { id: "global" } }).catch(() => null);

  const initialAccount = {
    bankName: ownerBank?.bankName || legacyBank?.bankName || "Wema Bank",
    accountNumber: ownerBank?.accountNumber || legacyBank?.accountNumber || "0123456789",
    accountName: ownerBank?.accountName || "BonaVee ICT Corporate",
    bankCode: ownerBank?.bankCode || legacyBank?.bankCode || "035",
  };

  return <BankAccountsClient initialConfig={initialAccount} />;
}

