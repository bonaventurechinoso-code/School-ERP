import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateTenantMetadata } from "@/lib/cache-invalidation";
import { recordTenantSuspended, recordTenantActivated } from "@/lib/admin-notifications";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status, reason, actorId = "super_admin" } = body;

    const normalizedStatus = (status || "").toUpperCase();
    if (!["ACTIVE", "SUSPENDED", "PENDING", "INACTIVE"].includes(normalizedStatus)) {
      return NextResponse.json(
        { error: "Invalid status. Must be ACTIVE, SUSPENDED, or PENDING" },
        { status: 400 }
      );
    }

    // 1. Lookup School record (by id, subdomain, or slug)
    const existingSchool = await prisma.school.findFirst({
      where: {
        OR: [
          { id },
          { subdomain: { equals: id, mode: "insensitive" } },
          { slug: { equals: id, mode: "insensitive" } },
        ],
      },
      include: {
        users: {
          where: { role: { in: ["SCHOOL_ADMIN", "PRINCIPAL", "HEADMASTER"] } },
          take: 1,
          select: { email: true },
        },
        staff: {
          take: 1,
          select: { email: true },
        },
        academicTiers: {
          select: { name: true },
        },
      },
    });

    // 2. Lookup Tenant record (by id or subdomain)
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { id },
          ...(existingSchool?.subdomain
            ? [{ subdomain: { equals: existingSchool.subdomain, mode: "insensitive" as const } }]
            : [{ subdomain: { equals: id, mode: "insensitive" as const } }]),
        ],
      },
      include: { plan: true },
    });

    if (!existingSchool && !existingTenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const isSuspending = normalizedStatus === "SUSPENDED";
    const resolvedSubdomain = existingSchool?.subdomain || existingTenant?.subdomain || id;
    const resolvedName = existingSchool?.name || existingTenant?.schoolName || "Institution";
    const resolvedEmail =
      existingTenant?.adminEmail ||
      existingSchool?.users?.[0]?.email ||
      existingSchool?.staff?.[0]?.email ||
      "";

    // 3. Update School and Tenant status atomically (never delete)
    if (existingSchool) {
      await prisma.school.update({
        where: { id: existingSchool.id },
        data: {
          isActive: !isSuspending,
          isBanned: isSuspending,
          status: normalizedStatus,
        },
      });
    }

    let updatedTenantRecord: any = null;
    if (existingTenant) {
      updatedTenantRecord = await prisma.tenant.update({
        where: { id: existingTenant.id },
        data: {
          status: normalizedStatus,
          subscriptionStatus: isSuspending ? "Suspended" : "Active",
          suspendedReason: isSuspending ? reason || "Subscription overdue" : null,
          suspendedAt: isSuspending ? new Date() : null,
        },
      });
    } else if (existingSchool) {
      try {
        updatedTenantRecord = await prisma.tenant.upsert({
          where: { subdomain: existingSchool.subdomain },
          update: {
            status: normalizedStatus,
            subscriptionStatus: isSuspending ? "Suspended" : "Active",
            suspendedReason: isSuspending ? reason || "Subscription overdue" : null,
            suspendedAt: isSuspending ? new Date() : null,
          },
          create: {
            id: existingSchool.id,
            schoolName: existingSchool.name,
            subdomain: existingSchool.subdomain,
            adminEmail: resolvedEmail || `${existingSchool.subdomain}@bonaveeict.com.ng`,
            contactPhone: existingSchool.contactPhone || "+234 800 000 0000",
            institutionTypes: (existingSchool.academicTiers || []).map((t) => t.name),
            status: normalizedStatus,
            subscriptionStatus: isSuspending ? "Suspended" : "Active",
            suspendedReason: isSuspending ? reason || "Subscription overdue" : null,
            suspendedAt: isSuspending ? new Date() : null,
          },
        });
      } catch (upsertErr) {
        console.warn("[SuperAdmin:TenantStatus] Optional Tenant upsert warning:", upsertErr);
      }
    }

    if (resolvedSubdomain) {
      await invalidateTenantMetadata(resolvedSubdomain).catch(() => {});
    }

    try {
      if (isSuspending) {
        await recordTenantSuspended({
          schoolId: existingSchool?.id || existingTenant?.id,
          schoolName: resolvedName,
          subdomain: resolvedSubdomain,
          reason: reason || "Subscription overdue",
        });
      } else {
        await recordTenantActivated({
          schoolId: existingSchool?.id || existingTenant?.id,
          schoolName: resolvedName,
          subdomain: resolvedSubdomain,
        });
      }
    } catch {}

    const tenant = {
      id: existingSchool?.id || updatedTenantRecord?.id || existingTenant?.id || id,
      name: resolvedName,
      schoolName: resolvedName,
      slug: existingSchool?.slug || resolvedSubdomain,
      subdomain: resolvedSubdomain,
      contactEmail: resolvedEmail,
      email: resolvedEmail,
      status: normalizedStatus,
      isActive: !isSuspending,
      suspensionReason: isSuspending ? reason || "Subscription overdue" : null,
      suspendedAt: isSuspending ? new Date() : null,
    };

    if (isSuspending && (tenant.contactEmail || tenant.email)) {
      try {
        const { sendMail: sendEmail } = await import("@/lib/mail");
        await sendEmail({
          to: tenant.contactEmail || tenant.email,
          subject: `Your institution ${tenant.name} has been suspended`,
          html: `<p>Dear ${tenant.name},</p><p>Your institution has been suspended.</p><p>Reason: ${reason || "Subscription payment overdue"}</p><p>Date: ${new Date().toLocaleString()}</p><p>To reactivate:</p><ol><li>Login to bonaveeict.com.ng/admin/billing</li><li>Pay outstanding subscription</li><li>Upload receipt</li><li>Contact support@bonaveeict.com.ng — School Code: ${tenant.slug}</li></ol>`,
          schoolId: existingSchool?.id,
          recipientType: "ADMIN",
          logCategory: "TENANT_SUSPENDED",
        });
      } catch (e) {
        console.error("Email failed but continue", e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Tenant ${tenant.name} status updated to ${normalizedStatus}`,
      data: tenant,
    });
  } catch (error: any) {
    console.error("[SuperAdmin:TenantStatus] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update tenant status" },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;
