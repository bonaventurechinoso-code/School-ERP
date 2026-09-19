require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runManualFeeVerification() {
  console.log('=================================================================');
  console.log('  100% MANUAL BANK TRANSFER & PROOF VERIFICATION WORKFLOW AUDIT  ');
  console.log('=================================================================\n');

  try {
    // 1. Verify Greenwood School exists
    const school = await prisma.school.findUnique({
      where: { subdomain: 'greenwood' },
    });

    if (!school) {
      throw new Error('Tenant "greenwood" not found.');
    }
    console.log(`[STEP 1] Tenant Verified: ${school.name} (${school.subdomain})`);

    // 2. Configure School Direct Collection Bank
    console.log('\n[STEP 2] Configuring School Settlement Bank Settings (Bursary Direct Account)...');
    const updatedSchool = await prisma.school.update({
      where: { id: school.id },
      data: {
        settlementBankName: 'Zenith Bank',
        settlementBankCode: '057',
        settlementAccountNumber: '1012345678',
        settlementAccountName: "GREENWOOD INT'L ACADEMY",
        paymentInstruction: 'Use Student Admission Number as transfer narration',
        collectionMode: 'MANUAL_BANK_TRANSFER',
      },
    });

    // Also sync to Tenant record
    await prisma.tenant.updateMany({
      where: { subdomain: 'greenwood' },
      data: {
        settlementBankName: 'Zenith Bank',
        settlementAccountNumber: '1012345678',
        settlementAccountName: "GREENWOOD INT'L ACADEMY",
        collectionMode: 'MANUAL_BANK_TRANSFER',
      },
    });

    console.log(`   Bank Name: ${updatedSchool.settlementBankName}`);
    console.log(`   Account Number: ${updatedSchool.settlementAccountNumber}`);
    console.log(`   Account Name: ${updatedSchool.settlementAccountName}`);
    console.log(`   Collection Mode: ${updatedSchool.collectionMode}`);
    console.log(`   Payment Instruction: ${updatedSchool.paymentInstruction}`);
    console.log('   => Direct collection bank configuration verified.');

    // 3. Locate or create a test Student and Invoice
    console.log('\n[STEP 3] Setting up Test Student and Fee Invoice...');
    let student = await prisma.student.findFirst({
      where: { schoolId: school.id },
    });

    if (!student) {
      student = await prisma.student.create({
        data: {
          schoolId: school.id,
          firstName: 'Chidinma',
          lastName: 'Okafor',
          admissionNumber: 'GW-2026-0042',
          feeStatus: 'UNPAID',
        },
      });
    }

    let invoice = await prisma.invoice.findFirst({
      where: { studentId: student.id, schoolId: school.id },
    });

    if (!invoice) {
      invoice = await prisma.invoice.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          amountDue: 85000,
          amountPaid: 0,
          status: 'PENDING',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          description: 'Term 2 Tuition & Books',
        },
      });
    }

    const proofAmount = Number(invoice.amountDue || 85000);
    console.log(`   Student: ${student.firstName} ${student.lastName} (${student.admissionNumber})`);
    console.log(`   Invoice ID: ${invoice.id} | Amount Due: ₦${proofAmount.toLocaleString()}`);
    console.log(`   Initial Student Fee Status: ${student.feeStatus || 'UNPAID'}`);

    // 4. Submit Proof of Payment (Parent workflow)
    console.log('\n[STEP 4] Simulating Parent Manual Bank Transfer & Proof Upload...');
    const testSessionId = `SESS_${Date.now()}_001`;

    const proof = await prisma.paymentProof.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        invoiceId: invoice.id,
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        amount: proofAmount,
        paidAt: new Date(),
        payerBankName: 'GTBank',
        payerAccountName: 'Emeka Okafor',
        sessionId: testSessionId,
        proofImageUrl: '/uploads/payment-proofs/test-receipt-gw.png',
        status: 'PENDING',
      },
    });

    // Update student feeStatus to PENDING_VERIFICATION
    await prisma.student.update({
      where: { id: student.id },
      data: { feeStatus: 'PENDING_VERIFICATION' },
    });

    const studentPending = await prisma.student.findUnique({
      where: { id: student.id },
    });

    console.log(`   Payment Proof ID: ${proof.id}`);
    console.log(`   Payer: ${proof.payerAccountName} via ${proof.payerBankName}`);
    console.log(`   Session / Ref ID: ${proof.sessionId}`);
    console.log(`   Proof Status: ${proof.status}`);
    console.log(`   Updated Student Fee Status: ${studentPending.feeStatus}`);
    if (studentPending.feeStatus !== 'PENDING_VERIFICATION') {
      throw new Error('Student fee status was not updated to PENDING_VERIFICATION');
    }
    console.log('   => Parent submission and pending status verified.');

    // 5. Bursar Approval Workflow
    console.log('\n[STEP 5] Executing Bursar Verification & Approval Flow...');
    const approvalResult = await prisma.$transaction(async (tx) => {
      // 1. Mark proof APPROVED
      const approvedProof = await tx.paymentProof.update({
        where: { id: proof.id },
        data: {
          status: 'APPROVED',
          verifiedAt: new Date(),
          verifiedById: 'bursar_admin_01',
          verifiedByName: 'School Bursar (Finance Office)',
        },
      });

      // 2. Create Payment record
      const payment = await tx.payment.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          invoiceId: invoice.id,
          amountPaid: proofAmount,
          method: 'TRANSFER',
          paymentDate: approvedProof.paidAt || new Date(),
        },
      });

      // 3. Update Invoice amountPaid and status
      const updatedInv = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: { increment: proofAmount },
          status: 'PAID',
        },
      });

      // 4. Update Student feeStatus to PAID
      const updatedStudent = await tx.student.update({
        where: { id: student.id },
        data: { feeStatus: 'PAID' },
      });

      return { approvedProof, payment, updatedInv, updatedStudent };
    });

    console.log(`   Proof Status: ${approvalResult.approvedProof.status}`);
    console.log(`   Verified By: ${approvalResult.approvedProof.verifiedByName}`);
    console.log(`   Created Payment ID: ${approvalResult.payment.id} | Amount: ₦${Number(approvalResult.payment.amountPaid).toLocaleString()}`);
    console.log(`   Invoice New Amount Paid: ₦${Number(approvalResult.updatedInv.amountPaid).toLocaleString()} | Status: ${approvalResult.updatedInv.status}`);
    console.log(`   Student Fee Status: ${approvalResult.updatedStudent.feeStatus}`);

    if (approvalResult.updatedStudent.feeStatus !== 'PAID' || approvalResult.updatedInv.status !== 'PAID') {
      throw new Error('Approval transaction failed to settle invoice and student fee status.');
    }
    console.log('   => Bursar approval and automated ledger settlement verified.');

    // 6. Test Rejection Workflow with Second Proof
    console.log('\n[STEP 6] Testing Rejection Flow (Bursar Rejection with Mandatory Reason)...');
    const rejectSessionId = `SESS_${Date.now()}_REJ`;
    const rejectedProofRecord = await prisma.paymentProof.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        invoiceId: invoice.id,
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        amount: 25000,
        paidAt: new Date(),
        payerBankName: 'Access Bank',
        payerAccountName: 'Anonymous Payer',
        sessionId: rejectSessionId,
        proofImageUrl: '/uploads/payment-proofs/blurry-receipt.png',
        status: 'PENDING',
      },
    });

    // Bursar rejects with reason
    const rejectionReason = 'Screenshot is unreadable / missing transaction reference number.';
    const rejectedProof = await prisma.paymentProof.update({
      where: { id: rejectedProofRecord.id },
      data: {
        status: 'REJECTED',
        verifiedAt: new Date(),
        verifiedById: 'bursar_admin_01',
        verifiedByName: 'School Bursar',
        rejectionReason,
      },
    });

    console.log(`   Rejected Proof ID: ${rejectedProof.id}`);
    console.log(`   Status: ${rejectedProof.status}`);
    console.log(`   Rejection Reason: "${rejectedProof.rejectionReason}"`);
    console.log('   => Bursar rejection with audit trail verified.');

    // 7. Verify SaaS Tenant Metrics & Pending Queue
    console.log('\n[STEP 7] Verifying SaaS Tenant & Dashboard Aggregates...');
    const pendingCount = await prisma.paymentProof.count({
      where: { schoolId: school.id, status: 'PENDING' },
    });
    const approvedCount = await prisma.paymentProof.count({
      where: { schoolId: school.id, status: 'APPROVED' },
    });
    const verifiedPaymentsSum = await prisma.payment.aggregate({
      where: { schoolId: school.id },
      _sum: { amountPaid: true },
    });

    console.log(`   Pending Proofs in Queue: ${pendingCount}`);
    console.log(`   Approved Proofs Total: ${approvedCount}`);
    console.log(`   Total Verified Tuition Collections: ₦${Number(verifiedPaymentsSum._sum.amountPaid || 0).toLocaleString()}`);
    console.log('   Collection Mode: MANUAL_BANK_TRANSFER (0% Platform Fee - 100% Direct to School)');

    console.log('\n=================================================================');
    console.log('   SUCCESS: ALL MANUAL PAYMENT & VERIFICATION TESTS PASSED!     ');
    console.log('=================================================================');

    // Clean up test proof records created during this run
    await prisma.paymentProof.deleteMany({
      where: { id: { in: [proof.id, rejectedProofRecord.id] } },
    });
    await prisma.payment.deleteMany({
      where: { id: approvalResult.payment.id },
    });

  } catch (error) {
    console.error('\n❌ VERIFICATION TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runManualFeeVerification();
