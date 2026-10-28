import { NextRequest, NextResponse } from "next/server";
import { recordTenantSuspended, recordTenantActivated } from "@/lib/admin-notifications";
import {
  findSchoolAndTenant,
  reactivateTenant,
  suspendTenant,
  softDeleteTenant,
  notifyTenantAdmins,
} from "@/lib/tenant-status";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status, reason, isDeleted } = body;

    const normalizedStatus = (status || "").toUpperCase();
    if (!["ACTIVE", "SUSPENDED", "PENDING", "INACTIVE", "DELETED"].includes(normalizedStatus)) {
      return NextResponse.json(
        { error: "Invalid status. Must be ACTIVE, SUSPENDED, PENDING, INACTIVE, or DELETED" },
        { status: 400 }
      );
    }

    const { school: existingSchool, tenant: existingTenant } = await findSchoolAndTenant(id);

    if (!existingSchool && !existingTenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const resolvedSubdomain = existingSchool?.subdomain || existingTenant?.subdomain || id;
    const resolvedName = existingSchool?.name || existingTenant?.schoolName || "Institution";
    const resolvedEmail =
      existingTenant?.adminEmail ||
      existingSchool?.users?.[0]?.email ||
      existingSchool?.staff?.[0]?.email ||
      "";

    // Soft-delete request
    if (isDeleted || normalizedStatus === "DELETED" || normalizedStatus === "INACTIVE") {
      const deletedResult = await softDeleteTenant(id, reason || "Soft-deleted by Super Admin");
      return NextResponse.json({
        success: true,
        message: `Tenant ${resolvedName} soft-deleted`,
        data: {
          id: deletedResult.school?.id || deletedResult.tenant?.id || id,
          name: resolvedName,
          schoolName: resolvedName,
          slug: existingSchool?.slug || resolvedSubdomain,
          subdomain: resolvedSubdomain,
          status: "DELETED",
          isActive: false,
          isDeleted: true,
        },
      });
    }

    const isSuspending = normalizedStatus === "SUSPENDED";
    const mutationResult = isSuspending
      ? await suspendTenant(id, reason || "Subscription overdue")
      : await reactivateTenant(id);

    // Notify all Tenant Admins of this school (DB Notice + AuditLog + Email) BEFORE returning response
    const notificationResult = await notifyTenantAdmins(
      id,
      isSuspending ? "SUSPENDED" : "REACTIVATED",
      reason
    ).catch((err) => {
      console.error("[SuperAdmin:TenantStatus] notifyTenantAdmins error:", err);
      return { notifiedCount: 0, emails: [] };
    });

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
      id: existingSchool?.id || mutationResult.tenant?.id || existingTenant?.id || id,
      name: resolvedName,
      schoolName: resolvedName,
      slug: existingSchool?.slug || resolvedSubdomain,
      subdomain: resolvedSubdomain,
      contactEmail: resolvedEmail,
      email: resolvedEmail,
      status: isSuspending ? "SUSPENDED" : "ACTIVE",
      isActive: !isSuspending,
      suspensionReason: isSuspending ? reason || "Subscription overdue" : null,
      suspendedAt: isSuspending ? new Date() : null,
      notifiedAdmins: notificationResult.emails,
      adminsNotified: true,
    };

    return NextResponse.json({
      success: true,
      adminsNotified: true,
      message: `Tenant ${tenant.name} status updated to ${tenant.status}`,
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
