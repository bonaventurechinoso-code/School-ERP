import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status, reason, actorId = "super_admin" } = body;

    const normalizedStatus = (status || "").toUpperCase();
    if (!["ACTIVE", "SUSPENDED", "PENDING"].includes(normalizedStatus)) {
      return NextResponse.json(
        { error: "Invalid status. Must be ACTIVE, SUSPENDED, or PENDING" },
        { status: 400 }
      );
    }

    const existingTenant = await prisma.tenant.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!existingTenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const isSuspending = normalizedStatus === "SUSPENDED";
    const updatedTenant = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id },
        data: {
          status: normalizedStatus,
          suspendedReason: isSuspending ? reason || "Administrative suspension" : null,
          suspendedAt: isSuspending ? new Date() : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: isSuspending ? "suspend_tenant" : "reactivate_tenant",
          tenantId: id,
          metadata: {
            schoolName: tenant.schoolName,
            subdomain: tenant.subdomain,
            previousStatus: existingTenant.status,
            newStatus: normalizedStatus,
            reason: reason || null,
          },
          ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
        },
      });

      return tenant;
    });

    return NextResponse.json({
      success: true,
      message: `Tenant ${updatedTenant.schoolName} status updated to ${normalizedStatus}`,
      data: updatedTenant,
    });
  } catch (error: any) {
    console.error("[SuperAdmin:TenantStatus PATCH] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update tenant status" },
      { status: 500 }
    );
  }
}
