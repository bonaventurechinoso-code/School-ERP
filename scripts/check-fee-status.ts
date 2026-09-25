import { basePrisma } from "../src/lib/tenant-prisma";

async function checkFees() {
  const students = await basePrisma.student.findMany({
    select: {
      id: true,
      admissionNumber: true,
      feeStatus: true,
      schoolId: true,
    },
  });

  const statusCounts: Record<string, number> = {};
  for (const s of students) {
    statusCounts[s.feeStatus || "NULL"] = (statusCounts[s.feeStatus || "NULL"] || 0) + 1;
  }
  console.log("Student count:", students.length);
  console.log("Fee status counts:", statusCounts);

  const invoices = await basePrisma.invoice.count();
  const payments = await basePrisma.payment.count();
  console.log("Total invoices:", invoices);
  console.log("Total payments:", payments);

  const feeTemplates = await basePrisma.feeTemplate.count();
  console.log("Total fee templates:", feeTemplates);
}

checkFees()
  .catch(console.error)
  .finally(() => basePrisma.$disconnect());
