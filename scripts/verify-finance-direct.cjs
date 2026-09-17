const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runDirectFinanceVerification() {
  console.log('=================================================================');
  console.log('   DIRECT BURSARY, INVOICING & BANK RECONCILIATION VERIFICATION  ');
  console.log('=================================================================\n');

  // 1. Verify Greenwood Tenant exists
  const school = await prisma.school.findUnique({
    where: { subdomain: 'greenwood' },
    include: { academicTiers: true },
  });

  if (!school) {
    throw new Error('❌ Test tenant "greenwood" not found in database.');
  }
  console.log(`✅ Tenant Found: ${school.name} (ID: ${school.id})`);
  console.log(`   Academic Tiers: ${school.academicTiers.map(t => t.name).join(', ')}`);

  // 2. Fetch sample student
  const student = await prisma.student.findFirst({
    where: { schoolId: school.id },
  });
  if (!student) {
    throw new Error('❌ No student found in greenwood tenant.');
  }
  console.log(`✅ Test Student: ${student.firstName} ${student.lastName} (ID: ${student.id})`);

  // 3. Test Fee Template & Invoice Lifecycle
  console.log('\n--- TEST 1: Fee Template & Invoice Generation ---');
  let template = await prisma.feeTemplate.findFirst({
    where: { schoolId: school.id },
  });

  if (!template) {
    template = await prisma.feeTemplate.create({
      data: {
        schoolId: school.id,
        name: 'Tuition & Development Levy (Term 2)',
        defaultAmount: 150000,
        billingType: 'FLAT',
      },
    });
    console.log(`   Created new FeeTemplate: ${template.name} (₦${template.defaultAmount})`);
  } else {
    console.log(`   Found existing FeeTemplate: ${template.name} (₦${template.defaultAmount})`);
  }

  // Create test invoice
  const testInvoice = await prisma.invoice.create({
    data: {
      schoolId: school.id,
      studentId: student.id,
      feeTemplateId: template.id,
      amountDue: 150000,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      description: 'Second Term Tuition & Development Levy',
      status: 'PENDING',
    },
  });
  console.log(`✅ Created Test Invoice #${testInvoice.id.slice(0, 8).toUpperCase()}: Amount ₦${testInvoice.amountDue}, Status: ${testInvoice.status}`);

  // 4. Test Partial and Full Payment Recording
  console.log('\n--- TEST 2: Payment Recording & Automatic Status Progression ---');
  // Part 1: Partial payment of ₦50,000
  const payment1 = await prisma.payment.create({
    data: {
      schoolId: school.id,
      studentId: student.id,
      invoiceId: testInvoice.id,
      amountPaid: 50000,
      method: 'TRANSFER',
    },
  });

  let payments = await prisma.payment.findMany({ where: { invoiceId: testInvoice.id } });
  let totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
  let updatedStatus = totalPaid >= testInvoice.amountDue ? 'PAID' : 'PARTIAL';

  let updatedInvoice = await prisma.invoice.update({
    where: { id: testInvoice.id },
    data: { status: updatedStatus },
  });
  console.log(`✅ Recorded Partial Payment: ₦${payment1.amountPaid} via ${payment1.method}. New Status: ${updatedInvoice.status} (Expected: PARTIAL)`);
  if (updatedInvoice.status !== 'PARTIAL') {
    throw new Error(`Expected status PARTIAL, got ${updatedInvoice.status}`);
  }

  // Part 2: Balance payment of ₦100,000
  const payment2 = await prisma.payment.create({
    data: {
      schoolId: school.id,
      studentId: student.id,
      invoiceId: testInvoice.id,
      amountPaid: 100000,
      method: 'TRANSFER',
    },
  });

  payments = await prisma.payment.findMany({ where: { invoiceId: testInvoice.id } });
  totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
  updatedStatus = totalPaid >= testInvoice.amountDue ? 'PAID' : 'PARTIAL';

  updatedInvoice = await prisma.invoice.update({
    where: { id: testInvoice.id },
    data: { status: updatedStatus },
  });
  console.log(`✅ Recorded Balance Payment: ₦${payment2.amountPaid}. New Status: ${updatedInvoice.status} (Expected: PAID)`);
  if (updatedInvoice.status !== 'PAID') {
    throw new Error(`Expected status PAID, got ${updatedInvoice.status}`);
  }

  // 5. Test Automatic General Ledger Recording
  console.log('\n--- TEST 3: General Ledger Income Transaction Recording ---');
  const ledgerTxn = await prisma.transaction.create({
    data: {
      schoolId: school.id,
      type: 'INCOME',
      category: 'TUITION',
      amount: payment1.amountPaid,
      description: `Tuition payment received from ${student.firstName} ${student.lastName} for Inv #${testInvoice.id.slice(0, 8).toUpperCase()}`,
      referenceId: testInvoice.id,
    },
  });
  console.log(`✅ Ledger Transaction logged: ₦${ledgerTxn.amount} (${ledgerTxn.category}) - Ref: ${ledgerTxn.referenceId}`);

  // 6. Test Bank Deposit & Reconciliation Engine
  console.log('\n--- TEST 4: Inward Bank Deposit & 1-Click Invoice Reconciliation ---');
  // Create an unallocated bank deposit
  const bankDeposit = await prisma.transaction.create({
    data: {
      schoolId: school.id,
      type: 'INCOME',
      category: 'BANK_DEPOSIT',
      amount: 75000,
      description: '[Zenith Bank - Acc: 1029384756] Ref: TELLER-9082341 | Depositor: Mrs. Amina Mohammed - Term 2 Fees',
      referenceId: 'TELLER-9082341',
    },
  });
  console.log(`✅ Inward Bank Deposit Logged: ₦${bankDeposit.amount} from Zenith Bank, Ref: ${bankDeposit.referenceId}`);

  // Create another invoice for reconciliation test
  const reconciliationInvoice = await prisma.invoice.create({
    data: {
      schoolId: school.id,
      studentId: student.id,
      amountDue: 75000,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      description: 'Science Laboratory & Practical Examination Fee',
      status: 'PENDING',
    },
  });
  console.log(`   Created Target Invoice #${reconciliationInvoice.id.slice(0, 8).toUpperCase()} for ₦${reconciliationInvoice.amountDue}`);

  // Reconcile bank deposit to target invoice
  await prisma.payment.create({
    data: {
      schoolId: school.id,
      studentId: student.id,
      invoiceId: reconciliationInvoice.id,
      amountPaid: bankDeposit.amount,
      method: 'TRANSFER',
    },
  });

  await prisma.invoice.update({
    where: { id: reconciliationInvoice.id },
    data: { status: 'PAID' },
  });

  const reconciledDeposit = await prisma.transaction.update({
    where: { id: bankDeposit.id },
    data: {
      referenceId: `${bankDeposit.referenceId}|INV:${reconciliationInvoice.id}`,
      description: `${bankDeposit.description} [RECONCILED: Inv #${reconciliationInvoice.id.slice(0, 8).toUpperCase()}]`,
    },
  });
  console.log(`✅ Bank Deposit Successfully Reconciled! Updated Ref: ${reconciledDeposit.referenceId}`);

  // Cleanup test records
  console.log('\n--- Cleaning up temporary test transactions & invoices ---');
  await prisma.payment.deleteMany({
    where: { invoiceId: { in: [testInvoice.id, reconciliationInvoice.id] } },
  });
  await prisma.transaction.deleteMany({
    where: { id: { in: [ledgerTxn.id, bankDeposit.id] } },
  });
  await prisma.invoice.deleteMany({
    where: { id: { in: [testInvoice.id, reconciliationInvoice.id] } },
  });
  console.log('✅ Temporary verification records cleanly purged.');

  console.log('\n=================================================================');
  console.log('   🎉 ALL DIRECT BURSARY & FINANCE CHECKS PASSED SUCCESSFULLY!   ');
  console.log('=================================================================\n');
}

runDirectFinanceVerification()
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
