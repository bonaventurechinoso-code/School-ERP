import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format-utils";
import Link from "next/link";
import {
  CreditCard,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Coins,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BillingsPage() {
  // 1. Fetch Platform Wallet
  let platformWallet = await prisma.platformWallet.findFirst();
  if (!platformWallet) {
    platformWallet = await prisma.platformWallet.create({
      data: { balance: 0.0, totalRevenue: 0.0 },
    });
  }

  // 2. Fetch Subscription Lifecycle Breakdown & Pending Receipts
  const [activeCount, pendingCount, expiredCount, pendingReceiptsCount] =
    await Promise.all([
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "PENDING" } }),
      prisma.subscription.count({ where: { status: "EXPIRED" } }),
      prisma.paymentReceipt.count({
        where: {
          moduleType: { contains: "SUBSCRIPTION" },
          status: "PENDING",
        },
      }),
    ]);

  // 3. Fetch Plans with Tenant Subscription Counts
  const plans = await prisma.plan.findMany({
    orderBy: { priceNgn: "asc" },
    include: {
      _count: {
        select: { tenants: true },
      },
    },
  });

  // 4. Calculate MRR
  const activeSubs = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
  });

  let estimatedMrr = 0;
  for (const sub of activeSubs) {
    estimatedMrr += Number(sub.amount || 0);
  }

  // 5. Fetch Recent Platform Transactions
  const recentTransactions = await prisma.platformTransaction.findMany({
    take: 15,
    orderBy: { createdAt: "desc" },
  });

  // 6. Tenant Wallets Aggregated
  const tenantWalletsAggregate = await prisma.wallet.aggregate({
    _sum: { balance: true },
    _count: true,
  });

  const formatNgn = (amt?: number | string | null) => {
    return formatCurrency(amt);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Module 2
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Platform Revenue &amp; Settlements
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Billings &amp; Subscription Revenue Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Monitor verified bank transfer subscriptions, school payment ledgers, and billing lifecycles
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/super-admin/finance/receipts"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Clock className="w-3.5 h-3.5" />
            Clearance Desk ({pendingReceiptsCount})
          </Link>
          <Link
            href="/super-admin/settings/payments"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold shadow-xs transition"
          >
            Manage Plans
          </Link>
        </div>
      </div>

      {/* Pending Platform Subscription Receipts Alert Card */}
      {pendingReceiptsCount > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {pendingReceiptsCount} Subscription Payment Proof{pendingReceiptsCount === 1 ? "" : "s"} Awaiting Verification
              </h2>
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                School manual bank transfers have been uploaded. Verify payment proofs to extend active SaaS licensing.
              </p>
            </div>
          </div>
          <Link
            href="/super-admin/finance/receipts"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs shrink-0"
          >
            Review &amp; Verify Receipts <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {formatNgn(Number(platformWallet.totalRevenue))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
            <Coins className="w-3 h-3 text-emerald-500" />
            Commissions &amp; subscription fees
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commission Balance</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {formatNgn(Number(platformWallet.balance))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Platform 2% software fee balance
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated MRR</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {formatNgn(estimatedMrr)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            ARR: <span className="font-semibold text-slate-800 dark:text-zinc-200">{formatNgn(estimatedMrr * 12)}</span>
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">School Settlements</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {formatNgn(Number(tenantWalletsAggregate._sum.balance || 0))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Mirror ledger (settled daily 6am by Wema Bank)
          </p>
        </div>
      </div>

      {/* Subscription Lifecycle Status Bar */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          Subscription Lifecycle Pipeline
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Active Paid</span>
              <span className="text-lg font-black text-blue-900 dark:text-blue-200">{activeCount}</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Current paid institutions</span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Pending Review</span>
              <span className="text-lg font-black text-amber-900 dark:text-amber-200">{pendingReceiptsCount}</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Awaiting transfer clearance</span>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">Expired</span>
              <span className="text-lg font-black text-rose-900 dark:text-rose-200">{expiredCount}</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Requires renewal</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Total Plans</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{plans.length}</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Configured tiers</span>
          </div>
        </div>
      </div>
    </div>
  );
}
