import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { clearTenantCache } from "@/lib/tenant-status";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest | Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    const rawRole = (user?.role || user?.userRole || "").toUpperCase();
    const isSuperAdmin = rawRole === "SUPER_ADMIN" || Boolean(user?.isSuperAdmin);

    if (!session || !isSuperAdmin) {
      return NextResponse.json({ error: "Access Denied (403 Forbidden)" }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const paymentId = resolvedParams.id;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "APPROVE").toUpperCase();
    const rejectionReason = body.rejectionReason || body.notes || "Payment details could not be verified.";

    // 1. Locate payment in TenantSubscriptionPayment or SubscriptionPayment
    let payment = await prisma.tenantSubscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { tenant: true },
    });

    if (!payment) {
      // Check legacy table
      const legacy = await prisma.subscriptionPayment.findUnique({
        where: { id: paymentId },
        include: { tenant: true },
      });

      if (legacy) {
        payment = await prisma.tenantSubscriptionPayment.upsert({
          where: { nipSessionId: legacy.id },
          update: {},
          create: {
            id: legacy.id,
            tenantId: legacy.tenantId,
            schoolSlug: legacy.tenant?.subdomain || legacy.tenantId,
            schoolName: legacy.tenant?.schoolName || "Institution",
            amount: legacy.amount || 0,
            nipSessionId: legacy.id,
            senderBank: "Bank Transfer",
            receiptUrl: legacy.receiptUrl,
            status: legacy.status === "PENDING_VERIFICATION" ? "PENDING" : legacy.status,
            notes: legacy.rejectionReason,
          },
          include: { tenant: true },
        });
      }
    }

    if (!payment) {
      return NextResponse.json({ error: "Subscription payment record not found." }, { status: 404 });
    }

    const startDate = new Date();
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // 2. ATOMIC TRANSACTIONAL EXECUTION
    const targetSchool = await prisma.school.findFirst({
      where: {
        OR: [
          { id: payment.tenantId },
          { subdomain: payment.schoolSlug },
          { slug: payment.schoolSlug },
        ],
      },
    });

    if (action === "REJECT") {
      await prisma.$transaction(async (tx) => {
        await tx.tenantSubscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: "REJECTED",
            verifiedAt: startDate,
            verifiedBy: user?.email || "super_admin",
            notes: rejectionReason,
          },
        });

        try {
          await tx.subscriptionPayment.update({
            where: { id: payment.id },
            data: {
              status: "REJECTED",
              verifiedAt: startDate,
              rejectionReason,
            },
          });
        } catch {}

        await tx.tenantNotification.create({
          data: {
            tenantId: payment.tenantId,
            type: "SUBSCRIPTION_REJECTED",
            title: "Subscription Proof Rejected",
            message: `Your payment proof of ₦${payment.amount.toLocaleString()} (Ref: ${payment.nipSessionId}) could not be verified: ${rejectionReason}. Please re-upload your receipt in settings/billing.`,
            isRead: false,
            actionUrl: `/${payment.schoolSlug}/settings/billing`,
          },
        });
      });

      return NextResponse.json({
        success: true,
        status: "REJECTED",
        message: "Subscription payment rejected and tenant notified.",
      });
    }

    // VERIFY: Guard against double-verification
    if (payment.status === "VERIFIED") {
      return NextResponse.json(
        { error: "This subscription payment has already been verified and activated.", code: "ALREADY_VERIFIED" },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // a) Update payment status
      await tx.tenantSubscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: "VERIFIED",
          verifiedAt: startDate,
          verifiedBy: user?.email || "super_admin",
          subscriptionStart: startDate,
          subscriptionEnd: endDate,
        },
      });

      try {
        await tx.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: "VERIFIED",
            verifiedAt: startDate,
          },
        });
      } catch {}

      // b) Atomically reactivate Tenant
      await tx.tenant.updateMany({
        where: {
          OR: [
            { id: payment.tenantId },
            { subdomain: payment.schoolSlug },
            { slug: payment.schoolSlug },
          ],
        },
        data: {
          isSuspended: false,
          isActive: true,
          status: "ACTIVE",
          subscriptionStatus: "ACTIVE",
          suspendedAt: null,
          suspendedReason: null,
          subscriptionExpiresAt: endDate,
        },
      });

      // c) Atomically reactivate School
      await tx.school.updateMany({
        where: {
          OR: [
            { id: payment.tenantId },
            { subdomain: payment.schoolSlug },
            { slug: payment.schoolSlug },
          ],
        },
        data: {
          isSuspended: false,
          isActive: true,
          status: "ACTIVE",
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: endDate,
          trialEndDate: endDate,
          deletedAt: null,
        },
      });

      // d) Create in-app proof notification for Tenant
      await tx.tenantNotification.create({
        data: {
          tenantId: payment.tenantId,
          type: "SUBSCRIPTION_REACTIVATED",
          title: "Subscription Reactivated! 🎉",
          message: `Your payment of ₦${payment.amount.toLocaleString()} (Ref: ${payment.nipSessionId}) has been verified by Platform Admin. Your school ${payment.schoolName} is now ACTIVE till ${endDate.toDateString()}. Thank you!`,
          isRead: false,
          actionUrl: `/${payment.schoolSlug}/dashboard`,
        },
      });

      // e) Audit Log
      try {
        await tx.platformAuditTrail.create({
          data: {
            tenantId: payment.tenantId,
            actorId: user?.id || "super_admin",
            actorEmail: user?.email || "superadmin@bonaveeict.com.ng",
            action: "SUBSCRIPTION_PAYMENT_VERIFIED",
            details: {
              target: payment.schoolName,
              paymentId: payment.id,
              nipSessionId: payment.nipSessionId,
              amount: payment.amount,
              expiresAt: endDate.toISOString(),
            },
          },
        });
      } catch {}
    });

    // 3. SEND TRANSACTIONAL CONFIRMATION EMAIL TO TENANT ADMINS
    const adminUsers = await prisma.user.findMany({
      where: {
        OR: [
          { schoolId: payment.tenantId },
          ...(targetSchool ? [{ schoolId: targetSchool.id }] : []),
          { email: { contains: payment.schoolSlug, mode: "insensitive" } },
        ],
        role: { in: ["SCHOOL_ADMIN", "SUPER_ADMIN", "BURSAR", "PRINCIPAL"] },
      },
      select: { email: true },
    });

    const tenantRecord = await prisma.tenant.findFirst({
      where: {
        OR: [
          { id: payment.tenantId },
          { subdomain: payment.schoolSlug },
          { slug: payment.schoolSlug },
        ],
      },
      select: { adminEmail: true },
    });

    const recipientEmails = new Set<string>();
    for (const u of adminUsers) {
      if (u.email) recipientEmails.add(u.email.toLowerCase().trim());
    }
    if (tenantRecord?.adminEmail) {
      recipientEmails.add(tenantRecord.adminEmail.toLowerCase().trim());
    }

    for (const email of recipientEmails) {
      try {
        await sendMail({
          to: email,
          subject: `${payment.schoolName} - Subscription Reactivated Till ${endDate.toDateString()}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
              <h2 style="color: #16a34a; margin-top: 0;">Payment Verified 🎉</h2>
              <p>Dear Admin,</p>
              <p>Your subscription payment of <b>₦${payment.amount.toLocaleString()}</b> (Ref: <code>${payment.nipSessionId}</code>) has been successfully verified by the Central Platform Super-Admin.</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 4px 0;"><b>Institution:</b> ${payment.schoolName}</p>
                <p style="margin: 4px 0;"><b>Status:</b> <span style="color: #16a34a; font-weight: bold;">ACTIVE</span></p>
                <p style="margin: 4px 0;"><b>Valid Till:</b> ${endDate.toDateString()}</p>
              </div>
              <p>Your administrative portal and all academic modules are fully unlocked and live.</p>
              <p><a href="https://${payment.schoolSlug}.bonaveeict.com.ng/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Access Portal Dashboard</a></p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="font-size: 12px; color: #64748b;">Bonavee ICT Central Platform Team</p>
            </div>
          `,
        });
      } catch (e) {
        console.error("[Email Sync Error]:", e);
      }
    }

    // 4. Invalidate Redis and L1 Tenant Caches
    await clearTenantCache(payment.schoolSlug, targetSchool?.id);

    return NextResponse.json({
      success: true,
      status: "VERIFIED",
      message: `Reactivated till ${endDate.toDateString()} + notification sent`,
    });
  } catch (error: any) {
    console.error("[Verify API POST Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to verify payment." }, { status: 500 });
  }
}
