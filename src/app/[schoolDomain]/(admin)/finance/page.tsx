import React, { Suspense } from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import FinanceDashboard from "./FinanceDashboard";
import { fetchInvoicesPaginated, fetchTransactionsPaginated } from "./actions";

export default async function FinancePage({ params: paramsPromise }: { params: Promise<{ schoolDomain: string }> }) {
  const params = await paramsPromise;
  
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: { academicTiers: true },
  });

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
      </div>
    );
  }

  const tenantDb = getTenantClient(school.id);
  
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
  ] = await Promise.all([
    fetchInvoicesPaginated(school.id, { limit: 50 }),
    fetchTransactionsPaginated(school.id, { limit: 50 }),
    tenantDb.student.findMany({
      where: { schoolId: school.id },
      select: { id: true, firstName: true, lastName: true, currentClass: true, admissionNumber: true },
      take: 500,
      orderBy: [{ currentClass: "asc" }, { firstName: "asc" }],
    }),
    tenantDb.classroom.findMany({
      where: { schoolId: school.id },
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
  ]);

  const totalInvoiced = invoicedAggregate._sum.amountDue || 0;
  const totalPaid = paidAggregate._sum.amountPaid || 0;
  const outstandingBalance = totalInvoiced - totalPaid;
  const totalExpenses = expensesAggregate._sum.amount || 0;

  const hasHigherEd = school.academicTiers.some(t => 
    t.name.toLowerCase().includes("higher ed") || 
    t.name.toLowerCase().includes("university") || 
    t.name.toLowerCase().includes("college")
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
          Fee Tracking & Finance
        </h2>
        <p className="text-slate-500 dark:text-zinc-400 mt-2 text-lg">
          Manage invoices, record payments, and track institutional cash flow.
        </p>
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
          hasHigherEd={hasHigherEd}
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
        />
      </Suspense>

    </div>
  );
}
