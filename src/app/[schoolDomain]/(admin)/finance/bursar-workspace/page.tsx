import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { reconcileAdmissionFeeReceipts } from "@/lib/payment-receipt-service";
import {
  Coins,
  CreditCard,
  FileCheck2,
  Landmark,
  Building2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BursarWorkspacePage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;

  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: schoolDomain.toLowerCase().trim() },
        { slug: schoolDomain.toLowerCase().trim() },
      ],
    },
    include: {
      academicTiers: true,
    },
  });

  if (!school) {
    return notFound();
  }

  // Ensure all uploaded application fee receipts are synced into PaymentReceipt
  await reconcileAdmissionFeeReceipts(school.id).catch(() => null);

  // Quick summary counts
  const [invoicesCount, pendingProofsRawCount, pendingReceiptsCount, staffCount] = await Promise.all([
    basePrisma.invoice.count({ where: { schoolId: school.id } }).catch(() => 0),
    basePrisma.paymentProof.count({ where: { schoolId: school.id, status: "PENDING" } }).catch(() => 0),
    basePrisma.paymentReceipt
      .count({
        where: {
          OR: [{ tenantId: school.id }, { schoolId: school.id }],
          status: "PENDING",
        },
      })
      .catch(() => 0),
    basePrisma.staff.count({ where: { schoolId: school.id, status: "ACTIVE" } }).catch(() => 0),
  ]);
  const pendingProofsCount = pendingProofsRawCount + pendingReceiptsCount;

  const cards = [
    {
      title: "Fee Structures & Invoices",
      description: "Manage tuition templates, generate termly pupil invoices, and track fee payment records.",
      href: `/${schoolDomain}/finance`,
      icon: CreditCard,
      badge: `${invoicesCount} Invoices`,
      color: "from-blue-500 to-indigo-600",
    },
    {
      title: "Payment Verifications",
      description: "Review bank deposit receipts, POS slips, and decentralized direct gateway settlements.",
      href: `/${schoolDomain}/finance/verifications`,
      icon: FileCheck2,
      badge: `${pendingProofsCount} Pending`,
      color: "from-emerald-500 to-teal-600",
    },
    {
      title: "Bank Account Configuration",
      description: "Configure direct NUBAN settlement accounts, verified bank names, and payment instructions.",
      href: `/${schoolDomain}/settings/bank`,
      icon: Landmark,
      badge: "Direct Bank NUBAN",
      color: "from-purple-500 to-violet-600",
    },
    {
      title: "Staff Payroll Processing",
      description: "Process monthly teaching and non-teaching compensation, TRCN allowances, and tax deductions.",
      href: `/${schoolDomain}/hr`,
      icon: Building2,
      badge: `${staffCount} Staff`,
      color: "from-amber-500 to-orange-600",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
              <Coins className="w-4 h-4" />
              <span>Bursary & Financial Desk</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Bursar Workspace
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Institutional treasury command center for {school.name}. Manage fee revenue, audit payment proofs, reconcile bank settlements, and supervise staff payroll.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/bursar"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <span>Launch Bursar Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Grid of Financial Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-xs hover:shadow-md transition-all group block select-none"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                  {card.badge}
                </span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {card.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {card.description}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Audit & Compliance Footer Notice */}
      <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-zinc-900/50 border border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-600 dark:text-zinc-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>All bursary ledger mutations are timestamped with institutional cryptographic audit trails.</span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">FINANCE-V2</span>
      </div>
    </div>
  );
}
