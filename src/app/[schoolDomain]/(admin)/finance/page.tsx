import React, { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { basePrisma, getTenantClient, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";
import FinanceDashboard from "./FinanceDashboard";
import { fetchInvoicesPaginated, fetchTransactionsPaginated } from "./actions";

export default async function FinancePage({ 
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: { 
  params: Promise<{ schoolDomain: string }>;
  searchParams?: Promise<{ tier?: string; tab?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};
  
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: { 
      academicTiers: {
        orderBy: { level: "asc" }
      } 
    },
  });

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
      </div>
    );
  }

  // Resolve active tier from URL searchParams or cookie fallback
  const cookieStore = await cookies();
  const cookieTier = cookieStore.get("activeTier")?.value;
  const requestedTierParam = searchParams?.tier;

  const activeTierObj = school.academicTiers.find((t) => {
    const isHigherEdPlaceholder =
      t.name === "Higher Institution / University" ||
      t.name.toLowerCase().includes("higher institution") ||
      t.name.toUpperCase() === "TERTIARY";

    if (requestedTierParam) {
      return (
        sanitizeTierSlug(t.name) === sanitizeTierSlug(requestedTierParam) ||
        t.name.toLowerCase().includes(requestedTierParam.toLowerCase()) ||
        (isHigherEdPlaceholder &&
          (requestedTierParam.toLowerCase().includes("poly") ||
            requestedTierParam.toLowerCase().includes("college") ||
            requestedTierParam.toLowerCase().includes("uni") ||
            requestedTierParam.toLowerCase().includes("higher")))
      );
    }
    if (cookieTier) {
      return (
        t.name.toLowerCase() === cookieTier.toLowerCase() ||
        sanitizeTierSlug(t.name) === sanitizeTierSlug(cookieTier) ||
        (isHigherEdPlaceholder &&
          (cookieTier.toLowerCase().includes("poly") ||
            cookieTier.toLowerCase().includes("college") ||
            cookieTier.toLowerCase().includes("uni") ||
            cookieTier.toLowerCase().includes("higher")))
      );
    }
    return false;
  }) || (school.academicTiers.length > 0 ? school.academicTiers[0] : null);

  const activeTierName = requestedTierParam || activeTierObj?.name || cookieTier || "";

  const tenantDb = await getPrismaClientForTier(school.id, activeTierName);
  
  // High-performance cursor pagination and database aggregations for flat query speeds
  const [
    invoicesResult,
    transactionsResult,
    students,
    classrooms,
    feeTemplates,
    invoicedAggregate,
    paidAggregate,
    expensesAggregate,
    pendingVerificationsCount,
  ] = await Promise.all([
    fetchInvoicesPaginated(school.id, { limit: 50 }),
    fetchTransactionsPaginated(school.id, { limit: 50 }),
    tenantDb.student.findMany({
      where: { 
        schoolId: school.id,
        ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
      },
      select: { id: true, firstName: true, lastName: true, currentClass: true, admissionNumber: true },
      take: 500,
      orderBy: [{ currentClass: "asc" }, { firstName: "asc" }],
    }),
    tenantDb.classroom.findMany({
      where: { 
        schoolId: school.id,
        ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
      },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    tenantDb.feeTemplate.findMany({
      where: { schoolId: school.id },
      orderBy: { createdAt: "desc" },
    }),
    tenantDb.invoice.aggregate({
      where: { schoolId: school.id },
      _sum: { amountDue: true },
    }).catch(() => ({ _sum: { amountDue: 0 } })),
    tenantDb.payment.aggregate({
      where: { schoolId: school.id },
      _sum: { amountPaid: true },
    }).catch(() => ({ _sum: { amountPaid: 0 } })),
    tenantDb.transaction.aggregate({
      where: { schoolId: school.id, type: "EXPENSE" },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: 0 } })),
    basePrisma.paymentProof.count({
      where: { schoolId: school.id, status: "PENDING" },
    }).catch(() => 0),
  ]);

  const totalInvoiced = invoicedAggregate._sum.amountDue || 0;
  const totalPaid = paidAggregate._sum.amountPaid || 0;
  const outstandingBalance = totalInvoiced - totalPaid;
  const totalExpenses = expensesAggregate._sum.amount || 0;

  const hasHigherEd = school.academicTiers.some(t => 
    t.name.toLowerCase().includes("higher ed") || 
    t.name.toLowerCase().includes("higher institution") || 
    t.name.toLowerCase().includes("university") || 
    t.name.toLowerCase().includes("polytechnic") || 
    t.name.toLowerCase().includes("college") ||
    t.name.toUpperCase() === "TERTIARY"
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            Fee Tracking & Finance
          </h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 text-sm sm:text-base">
            Manage invoices, record payments, and track institutional cash flow across all educational tiers.
          </p>
        </div>

        {/* Academic Tier Switcher */}
        {school.academicTiers.length > 1 && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700/80 overflow-x-auto shrink-0">
            {school.academicTiers.map((tier) => {
              const isAggregatedHigherEd =
                tier.name === "Higher Institution / University" ||
                tier.name.toLowerCase().includes("higher institution");

              // Dynamic label: replace aggregated placeholder with specific tier from ?tier query param
              let displayTierName = tier.name;
              if (isAggregatedHigherEd) {
                const paramLower = (requestedTierParam || cookieTier || "").toLowerCase();
                if (paramLower.includes("poly")) {
                  displayTierName = "Polytechnic";
                } else if (paramLower.includes("college")) {
                  displayTierName = "College of Education";
                } else {
                  displayTierName = "University";
                }
              }

              const isSelected =
                (activeTierObj ? activeTierObj.id === tier.id : false) ||
                activeTierName.toLowerCase() === tier.name.toLowerCase() ||
                activeTierName.toLowerCase() === displayTierName.toLowerCase();

              const tierQueryParam = isAggregatedHigherEd ? displayTierName : tier.name;

              return (
                <Link
                  key={tier.id}
                  href={`/${params.schoolDomain}/finance?tier=${encodeURIComponent(tierQueryParam)}`}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    isSelected
                      ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {displayTierName}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      <Suspense fallback={
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 dark:bg-zinc-800 rounded-lg w-1/4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-50 dark:bg-zinc-800/50 rounded-lg"></div>
            ))}
          </div>
        </div>
      }>
        <FinanceDashboard 
          initialTab={searchParams?.tab as any}
          hasHigherEd={hasHigherEd}
          activeTier={activeTierName}
          invoices={invoicesResult.items}
          students={students as any}
          classrooms={classrooms.map(c => c.name)}
          feeTemplates={feeTemplates}
          transactions={transactionsResult.items}
          schoolId={school.id}
          totalInvoiced={totalInvoiced}
          totalPaid={totalPaid}
          totalExpenses={totalExpenses}
          outstandingBalance={outstandingBalance}
          pendingVerificationsCount={pendingVerificationsCount}
        />
      </Suspense>

    </div>
  );
}
