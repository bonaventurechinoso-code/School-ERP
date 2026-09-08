import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { basePrisma as prisma } from '@/lib/tenant-prisma';
import { SubscriptionPlan, BillingCycle, SubscriptionStatus } from '@prisma/client';

export async function POST(req: Request) {
  try {
    // 1. SECURE SIGNATURE VERIFICATION
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing Paystack signature' }, { status: 401 });
    }

    const rawBody = await req.text();
    const secret = process.env.PAYSTACK_SECRET_KEY || '';
    
    const expectedSignature = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. HANDLE SUCCESS EVENTS
    const payload = JSON.parse(rawBody);
    const { event, data } = payload;

    if (event === 'charge.success' || event === 'subscription.create' || event === 'subscription.renew') {
      const { reference, metadata, amount } = data;
      
      if (!metadata || !metadata.tenantId) {
        return NextResponse.json({ error: 'Missing tenantId in metadata' }, { status: 400 });
      }

      const { tenantId, plan, billingCycle } = metadata;

      // Ensure valid enums
      const mappedPlan = (plan?.toUpperCase() || 'BASIC') as SubscriptionPlan;
      const mappedCycle = (billingCycle?.toUpperCase() || 'MONTHLY') as BillingCycle;

      // 3. UPDATE PRISMA DATABASE TRACKING
      // Calculate new expiration date
      const currentDate = new Date();
      const expiresAt = new Date(currentDate);
      if (mappedCycle === 'ANNUAL') {
        expiresAt.setDate(expiresAt.getDate() + 365);
      } else {
        expiresAt.setDate(expiresAt.getDate() + 30);
      }

      // Run in a transaction to ensure data integrity
      await prisma.$transaction([
        // Update the tenant's subscription status
        prisma.school.update({
          where: { id: tenantId },
          data: {
            subscriptionStatus: SubscriptionStatus.ACTIVE,
            subscriptionPlan: mappedPlan,
            billingCycle: mappedCycle,
            subscriptionExpiresAt: expiresAt,
            subscriptionStartedAt: currentDate,
          }
        }),
        // Log the transaction
        prisma.transaction.create({
          data: {
            schoolId: tenantId,
            type: 'EXPENSE',
            category: 'SUBSCRIPTION',
            amount: amount / 100, // Paystack sends amount in kobo/kobo-equivalent, convert to main currency
            description: `Platform subscription payment for ${mappedPlan} plan`,
            referenceId: reference,
          }
        })
      ]);

      return NextResponse.json({ message: 'Subscription successfully activated' }, { status: 200 });
    }

    // Ignore other events
    return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
  } catch (error: any) {
    console.error('Paystack webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
