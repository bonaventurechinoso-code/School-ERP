import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { basePrisma } from "@/lib/tenant-prisma";
import BursarReceiptsHub from "@/components/payments/BursarReceiptsHub";
import PlatformSubscriptionReceiptsTable from "./PlatformSubscriptionReceiptsTable";
import { Clock, ShieldCheck, Layers, FileCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Platform Receipts & Subscriptions | Super Admin",
  description: "Cross-School Payment Receipt Verification & Platform Subscription Clearance",
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
              Platform Receipts &amp; Subscription clearance is strictly restricted to Central Platform Super-Administrators.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Query pending platform subscription receipts
  let pendingSubscriptionReceipts: any[] = [];
  let schoolMap = new Map<string, any>();

  try {
    pendingSubscriptionReceipts = await basePrisma.paymentReceipt.findMany({
      where: {
        moduleType: { contains: "SUBSCRIPTION" },
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    const schoolIdentifiers = Array.from(
      new Set(
        pendingSubscriptionReceipts
          .flatMap((r) => [r.schoolId, r.tenantId])
          .filter(Boolean)
      )
    );

    if (schoolIdentifiers.length > 0) {
      const schools = await basePrisma.school.findMany({
        where: {
          OR: [
            { id: { in: schoolIdentifiers } },
            { subdomain: { in: schoolIdentifiers } },
          ],
        },
        select: {
          id: true,
          name: true,
          subdomain: true,
          subscriptionPlan: true,
        },
      });

      for (const s of schools) {
        schoolMap.set(s.id, s);
        schoolMap.set(s.subdomain, s);
      }
    }
  } catch (err) {
    console.error("[SuperAdminFinanceReceiptsPage] Error fetching receipts:", err);
  }

  const serializableReceipts = pendingSubscriptionReceipts.map((r) => {
    const matchedSchool = schoolMap.get(r.schoolId) || schoolMap.get(r.tenantId) || null;
    return {
      id: r.id,
      tenantId: r.tenantId,
      moduleType: r.moduleType,
      payerName: r.payerName,
      referenceNo: r.referenceNo,
      amount: Number(r.amount?.toString() || 0),
      bankName: r.bankName,
      fileUrl: r.fileUrl,
      status: r.status,
      createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
      school: matchedSchool
        ? {
            id: matchedSchool.id,
            name: matchedSchool.name,
            subdomain: matchedSchool.subdomain,
            subscriptionPlan: matchedSchool.subscriptionPlan,
          }
        : null,
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            Platform Finance
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Audit &amp; Clearance Desk
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
          Platform Receipts &amp; Subscriptions
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          Review offline manual bank transfer proofs for SaaS portal subscriptions and institutional fee settlements
        </p>
      </div>

      {/* ── Section: Pending Platform Subscription Receipts ── */}
      <div className="rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Pending Platform Subscription Receipts ({serializableReceipts.length})
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Tenant school renewal proofs requiring root super-admin clearance
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wider">
            Clearance Queue
          </span>
        </div>

        <div className="p-4 sm:p-6">
          <PlatformSubscriptionReceiptsTable initialReceipts={serializableReceipts} />
        </div>
      </div>

      {/* ── Section: Cross-School Fee Receipts Hub ── */}
      <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
          <FileCheck className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Universal Cross-Tenant Fee Receipts Directory
          </h2>
        </div>
        <BursarReceiptsHub isSuperAdmin={true} tenantId="super-admin" />
      </div>
    </div>
  );
}
