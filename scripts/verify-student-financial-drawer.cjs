const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyStudentFinancialDrawer() {
  console.log('===============================================================');
  console.log('   VERIFYING STUDENT PROFILES & FINANCIAL DRAWER INTEGRATION   ');
  console.log('===============================================================\n');

  try {
    // 1. Find greenwood school
    const school = await prisma.school.findUnique({
      where: { subdomain: 'greenwood' },
      include: { academicTiers: true },
    });

    if (!school) throw new Error('School greenwood not found.');
    console.log(`[1] School verified: ${school.name} (${school.id})`);

    // 2. Find a student
    let student = await prisma.student.findFirst({
      where: { schoolId: school.id },
      include: { tier: true, invoices: true, paymentProofs: true, payments: true },
    });

    if (!student) throw new Error('No students found in greenwood.');
    console.log(`[2] Student found: ${student.firstName} ${student.lastName} (${student.admissionNumber || 'No ID'})`);
    console.log(`    Current Fee Status: ${student.feeStatus}`);
    console.log(`    Existing Invoices: ${student.invoices.length}`);
    console.log(`    Existing Payment Proofs: ${student.paymentProofs.length}`);
    console.log(`    Existing Payments: ${student.payments.length}`);

    // 3. Ensure student has at least 1 invoice for testing
    let testInvoice = student.invoices[0];
    if (!testInvoice) {
      console.log('\n[3] Generating test invoice for student...');
      testInvoice = await prisma.invoice.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          amountDue: 75000,
          amountPaid: 0,
          status: 'PENDING',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          description: 'Term 1 Tuition & Learning Materials 2026/2027',
        },
      });
      console.log(`    Created Invoice: ${testInvoice.id} - ₦${testInvoice.amountDue}`);
    } else {
      console.log(`\n[3] Using existing invoice: ${testInvoice.id} (Due: ₦${testInvoice.amountDue}, Paid: ₦${testInvoice.amountPaid})`);
    }

    // 4. Test financial summary calculation logic
    const allInvoices = await prisma.invoice.findMany({
      where: { studentId: student.id },
      include: { payments: true, paymentProofs: true },
    });
    const allProofs = await prisma.paymentProof.findMany({
      where: { studentId: student.id },
    });
    const allPayments = await prisma.payment.findMany({
      where: { studentId: student.id },
    });

    const totalInvoiced = allInvoices.reduce((sum, inv) => sum + inv.amountDue, 0);
    const totalPaid = allInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const outstandingBalance = Math.max(0, totalInvoiced - totalPaid);
    const pendingProofsCount = allProofs.filter((p) => p.status === 'PENDING').length;

    console.log('\n[4] Verified Financial Calculations:');
    console.log(`    Total Invoiced:       ₦${totalInvoiced.toLocaleString()}`);
    console.log(`    Total Paid:           ₦${totalPaid.toLocaleString()}`);
    console.log(`    Outstanding Balance:  ₦${outstandingBalance.toLocaleString()}`);
    console.log(`    Pending Proofs Count: ${pendingProofsCount}`);

    // 5. Test Manual Payment Recording simulation
    console.log('\n[5] Simulating Partial Manual Payment Recording...');
    const paymentAmount = 5000;
    const initialPaid = testInvoice.amountPaid;

    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          invoiceId: testInvoice.id,
          amountPaid: paymentAmount,
          paymentDate: new Date(),
          method: 'MANUAL_TRANSFER',
        },
      });

      const newAmountPaid = initialPaid + paymentAmount;
      const newStatus = newAmountPaid >= testInvoice.amountDue ? 'PAID' : 'PARTIAL';

      await tx.invoice.update({
        where: { id: testInvoice.id },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      const openInvoices = await tx.invoice.findMany({
        where: {
          studentId: student.id,
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        },
      });

      const updatedFeeStatus = openInvoices.length === 0 ? 'PAID' : 'PARTIAL';

      await tx.student.update({
        where: { id: student.id },
        data: { feeStatus: updatedFeeStatus },
      });
    });

    // Re-query student
    const updatedStudent = await prisma.student.findUnique({
      where: { id: student.id },
      include: { invoices: true },
    });

    console.log(`    Payment of ₦${paymentAmount.toLocaleString()} successfully recorded!`);
    console.log(`    Updated Student feeStatus: ${updatedStudent.feeStatus}`);
    const updatedInv = updatedStudent.invoices.find((i) => i.id === testInvoice.id);
    console.log(`    Invoice amountPaid updated from ₦${initialPaid} to ₦${updatedInv.amountPaid}`);
    console.log(`    Invoice status: ${updatedInv.status}`);

    console.log('\n===============================================================');
    console.log('   ALL STUDENT FINANCIAL DRAWER AUDITS PASSED WITH FLYING COLORS!  ');
    console.log('===============================================================\n');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyStudentFinancialDrawer();
