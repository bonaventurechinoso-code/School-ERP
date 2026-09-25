import { basePrisma } from "../src/lib/tenant-prisma";

async function inspectPayments() {
  const invoices = await basePrisma.invoice.findMany({
    include: {
      student: true,
      payments: true,
    }
  });

  console.log("Invoices found:", invoices.length);
  for (const inv of invoices) {
    console.log({
      id: inv.id,
      studentId: inv.studentId,
      studentName: inv.student ? `${inv.student.firstName} ${inv.student.lastName}` : "No student",
      totalAmount: inv.amountDue,
      paidAmount: inv.amountPaid,
      status: inv.status,
      paymentsCount: inv.payments?.length || 0,
    });
  }

  const payments = await basePrisma.payment.findMany({
    include: {
      student: true,
    }
  });
  console.log("Payments found:", payments.length);
  for (const p of payments) {
    console.log({
      id: p.id,
      studentId: p.studentId,
      amount: p.amountPaid,
      method: p.method,
      student: p.student ? `${p.student.firstName} ${p.student.lastName}` : "No student",
    });
  }
}

inspectPayments()
  .catch(console.error)
  .finally(() => basePrisma.$disconnect());
