import { basePrisma } from "../src/lib/tenant-prisma";

async function recalculateFeeStatuses() {
  console.log("Recalculating fee statuses for all students...");

  const students = await basePrisma.student.findMany({
    include: {
      invoices: true,
      payments: true,
    },
  });

  console.log(`Found ${students.length} students to evaluate.`);
  let updatedCount = 0;
  const statusCounts: Record<string, number> = { PAID: 0, PARTIAL: 0, UNPAID: 0 };

  for (const student of students) {
    let computedStatus = "UNPAID";

    if (student.invoices.length > 0) {
      const totalDue = student.invoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);
      const totalPaid = student.invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
      const hasAnyPaidInvoice = student.invoices.some(inv => inv.status === "PAID");
      const hasAnyPartialInvoice = student.invoices.some(inv => inv.status === "PARTIAL");

      if (totalPaid >= totalDue && totalDue > 0) {
        computedStatus = "PAID";
      } else if (totalPaid > 0 || hasAnyPartialInvoice) {
        computedStatus = "PARTIAL";
      } else if (hasAnyPaidInvoice) {
        computedStatus = "PAID";
      }
    } else if (student.payments.length > 0) {
      const totalDirectPaid = student.payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
      if (totalDirectPaid > 0) {
        computedStatus = "PARTIAL";
      }
    }

    statusCounts[computedStatus] = (statusCounts[computedStatus] || 0) + 1;

    if (student.feeStatus !== computedStatus) {
      await basePrisma.student.update({
        where: { id: student.id },
        data: { feeStatus: computedStatus },
      });
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} students.`);
  console.log("Final Fee Status distribution:", statusCounts);
}

recalculateFeeStatuses()
  .catch(console.error)
  .finally(() => basePrisma.$disconnect());
