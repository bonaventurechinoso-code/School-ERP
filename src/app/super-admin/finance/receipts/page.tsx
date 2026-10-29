import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { prisma } from "@/lib/prisma";
import PlatformSubscriptionReceiptsTable from "./PlatformSubscriptionReceiptsTable";
import { Clock, ShieldCheck, FileCheck, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payment & Verification | Super Admin Finance",
  description: "Tenant Subscription Payment Proofs & Institutional Verification Desk",
};

export default async function SuperAdminFinanceReceiptsPage() {
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
              Payment &amp; Verification clearance desk is strictly restricted to Central Platform Super-Administrators.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 1. Fetch TenantSubscriptionPayment records
  let tenantPayments: any[] = [];
  try {
    tenantPayments = await prisma.tenantSubscriptionPayment.findMany({
      orderBy: { submittedAt: "desc" },
      include: { tenant: true },
    });
  } catch (err) {
    console.error("[SuperAdminFinanceReceiptsPage] Error fetching TenantSubscriptionPayment:", err);
  }

  // 2. Fetch legacy SubscriptionPayment records if any
  let legacyPayments: any[] = [];
  try {
    legacyPayments = await prisma.subscriptionPayment.findMany({
      orderBy: { createdAt: "desc" },
      include: { tenant: true },
    });
  } catch (err) {
    console.error("[SuperAdminFinanceReceiptsPage] Error fetching SubscriptionPayment:", err);
  }

  const existingIds = new Set(tenantPayments.map((p) => p.id));
  const mergedPayments: any[] = [...tenantPayments];

  for (const lp of legacyPayments) {
    if (!existingIds.has(lp.id)) {
      mergedPayments.push({
        id: lp.id,
        tenantId: lp.tenantId,
        schoolSlug: lp.tenant?.subdomain || lp.tenantId,
        schoolName: lp.tenant?.schoolName || "Institution",
        amount: Number(lp.amount || 0),
        nipSessionId: lp.id,
        senderBank: "Bank Transfer",
        receiptUrl: lp.receiptUrl,
        accountName: null,
        status: lp.status === "PENDING_VERIFICATION" ? "PENDING" : lp.status,
        submittedAt: lp.createdAt,
        verifiedAt: lp.verifiedAt,
        notes: lp.rejectionReason,
        tenant: lp.tenant,
      });
    }
  }

  // Also query school names if needed for richer display
  const subdomains = mergedPayments.map((p) => p.schoolSlug || p.tenant?.subdomain).filter(Boolean);
  let schoolMap = new Map<string, any>();
  if (subdomains.length > 0) {
    try {
      const schools = await prisma.school.findMany({
        where: {
          subdomain: { in: subdomains },
        },
        select: {
          id: true,
          name: true,
          subdomain: true,
          status: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
        },
      });
      for (const s of schools) {
        schoolMap.set(s.subdomain.toLowerCase(), s);
      }
    } catch {}
  }

  const serializablePayments = mergedPayments.map((p) => {
    const slug = (p.schoolSlug || p.tenant?.subdomain || "").toLowerCase();
    const s = schoolMap.get(slug);
    const rawDate = p.submittedAt || p.createdAt || new Date();
    return {
      id: p.id,
      tenantId: p.tenantId,
      amount: Number(p.amount || 0),
      receiptUrl: p.receiptUrl,
      status: p.status === "PENDING_VERIFICATION" ? "PENDING" : p.status,
      createdAt: (rawDate instanceof Date ? rawDate : new Date(rawDate)).toISOString(),
      verifiedAt: p.verifiedAt ? (p.verifiedAt instanceof Date ? p.verifiedAt : new Date(p.verifiedAt)).toISOString() : null,
      rejectionReason: p.notes || p.rejectionReason || null,
      tenant: {
        id: p.tenant?.id || p.tenantId,
        schoolName: p.schoolName || s?.name || p.tenant?.schoolName || "Institution",
        subdomain: p.schoolSlug || p.tenant?.subdomain || "portal",
        status: p.tenant?.status || s?.status || "ACTIVE",
        subscriptionStatus: p.tenant?.subscriptionStatus || s?.subscriptionStatus || "ACTIVE",
        planName: s?.subscriptionPlan || "MONTHLY",
      },
    };
  });

  const pendingCount = serializablePayments.filter((p) => p.status === "PENDING" || p.status === "PENDING_VERIFICATION").length;
  const verifiedCount = serializablePayments.filter((p) => p.status === "VERIFIED").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            Platform Finance
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            SaaS Clearance Desk
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
          Payment &amp; Verification
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          Audit and approve offline tenant SaaS subscription payment proofs to instantly activate locked institutions
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pending Clearance
            </p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {pendingCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Verified &amp; Active
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {verifiedCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Receipts Tracked
            </p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {serializablePayments.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Subscription Receipts Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-800/40 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Tenant Subscription Payments
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Filtered strictly to institutional SaaS subscriptions — zero academic student fees
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
            Verification Engine
          </span>
        </div>

        <div className="p-4 sm:p-6">
          <PlatformSubscriptionReceiptsTable initialReceipts={serializablePayments} />
        </div>
      </div>
    </div>
  );
}
