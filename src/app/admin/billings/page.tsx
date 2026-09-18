import { prisma } from "@/lib/prisma";
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

  // 2. Fetch Subscription Lifecycle Breakdown
  const [activeCount, trialingCount, pastDueCount, suspendedCount] =
    await Promise.all([
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.subscription.count({ where: { status: "trialing" } }),
      prisma.subscription.count({ where: { status: "past_due" } }),
      prisma.subscription.count({ where: { status: "suspended" } }),
    ]);

  // 3. Fetch Plans with Tenant Subscription Counts
  const plans = await prisma.plan.findMany({
    orderBy: { priceNgn: "asc" },
    include: {
      _count: {
        select: { tenants: true, subscriptions: true },
      },
    },
  });

  // 4. Calculate MRR
  const activeSubs = await prisma.subscription.findMany({
    where: { status: { in: ["active", "trialing"] } },
    include: { plan: true },
  });

  let estimatedMrr = 0;
  for (const sub of activeSubs) {
    const price = Number(sub.amountDue || sub.plan.priceNgn || 0);
    const cycle = (sub.plan.billingCycle || "termly").toLowerCase();
    if (cycle === "monthly") {
      estimatedMrr += price;
    } else if (cycle === "termly") {
      estimatedMrr += Math.round(price / 3.5);
    } else if (cycle === "yearly") {
      estimatedMrr += Math.round(price / 12);
    } else {
      estimatedMrr += price;
    }
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

  const formatNgn = (amt: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amt);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Module 2
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Platform Revenue & Settlements
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Billings & Paystack Revenue Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Monitor real-time Paystack split payouts, platform ledger balances, and school subscription lifecycles
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold shadow-xs transition"
          >
            Manage Plans
          </Link>
        </div>
      </div>

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
            Commissions & subscription fees
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Balance</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {formatNgn(Number(platformWallet.balance))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Ready for Paystack payout transfer
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
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Schools Escrow Funds</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {formatNgn(Number(tenantWalletsAggregate._sum.balance || 0))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Across {tenantWalletsAggregate._count} tenant school wallets
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
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1.5">{activeCount}</div>
            <p className="text-[10px] text-blue-600/80 dark:text-blue-400">In good standing</p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">14-Day Trialing</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-900 dark:text-amber-100 mt-1.5">{trialingCount}</div>
            <p className="text-[10px] text-amber-600/80 dark:text-amber-400">Trial evaluation window</p>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">Past Due</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-900 dark:text-rose-100 mt-1.5">{pastDueCount}</div>
            <p className="text-[10px] text-rose-600/80 dark:text-rose-400">Payment failed / retry</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Suspended</span>
              <ShieldCheck className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-black text-slate-800 dark:text-zinc-200 mt-1.5">{suspendedCount}</div>
            <p className="text-[10px] text-slate-500">Access revoked</p>
          </div>
        </div>
      </div>

      {/* Plan Tiers & Limits */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Subscription Tiers</h3>
          </div>
          <span className="text-xs text-slate-400">{plans.length} configured plans</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  {p.commissionPercent}% split
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white">
                {formatNgn(p.priceNgn)} <span className="text-xs font-normal text-slate-400">/ {p.billingCycle}</span>
              </div>
              <ul className="text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                <li>• Max Students: <strong>{p.maxStudents}</strong></li>
                <li>• Max Staff: <strong>{p.maxStaff}</strong></li>
                <li>• Max Storage: <strong>{p.maxStorageGb} GB</strong></li>
              </ul>
              <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {p._count.tenants} subscribed schools
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Transactions Table */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Platform Transaction Records</h3>
          </div>
          <span className="text-xs text-slate-400">Recent Paystack settlements & fees</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 dark:text-zinc-500 italic">
                    No platform transactions recorded yet. Split payments and subscriptions appear here automatically.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-3 px-3 font-mono font-medium text-slate-700 dark:text-zinc-300">
                      {tx.reference}
                    </td>
                    <td className="py-3 px-3 capitalize">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatNgn(Number(tx.amount))}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
