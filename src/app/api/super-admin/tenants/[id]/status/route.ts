import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearTenantCache, notifyTenantAdmins } from "@/lib/tenant-status";

export const dynamic = "force-dynamic";

async function handleStatusUpdate(
  req: NextRequest | Request,
  paramsInput: Promise<{ id: string }> | { id: string }
) {
  try {
    const resolvedParams = await Promise.resolve(paramsInput);
    const tenantId = resolvedParams.id;
    const body = await req.json().catch(() => ({}));

    const rawAction = String(body?.action || "").toLowerCase();
    const rawStatus = String(body?.status || "").toUpperCase();
    const reason = body?.reason || body?.statusReason || "Subscription overdue";
    const isDeleted = Boolean(body?.isDeleted) || rawStatus === "DELETED" || rawAction === "delete";

    const isReactivate =
      rawAction === "reactivate" ||
      rawAction === "activate" ||
      rawStatus === "ACTIVE";

    const isSuspend =
      rawAction === "suspend" ||
      rawStatus === "SUSPENDED" ||
      (!isReactivate && !isDeleted && rawStatus === "INACTIVE");

    const now = new Date();
    const newExpiry = new Date();
    newExpiry.setFullYear(newExpiry.getFullYear() + 1);

    // 1. SOFT DELETE
    if (isDeleted) {
      try {
        await prisma.tenant.updateMany({
          where: { OR: [{ id: tenantId }, { subdomain: tenantId }] },
          data: {
            status: "DELETED",
            isActive: false,
            isSuspended: true,
            suspendedAt: now,
            suspendedReason: reason || "Soft-deleted by Super Admin",
          },
        });
      } catch (e) {
        console.error("[Tenant Status] Error soft-deleting Tenant:", e);
      }

      try {
        await prisma.school.updateMany({
          where: { OR: [{ id: tenantId }, { subdomain: tenantId }] },
          data: {
            status: "DELETED",
            isActive: false,
            isSuspended: true,
            deletedAt: now,
          },
        });
      } catch (e) {
        console.error("[Tenant Status] Error soft-deleting School:", e);
      }

      await clearTenantCache(tenantId);
      return NextResponse.json({ success: true, status: "DELETED", isActive: false });
    }

    // 2. REACTIVATE
    if (isReactivate) {
      try {
        await prisma.tenant.updateMany({
          where: { OR: [{ id: tenantId }, { subdomain: tenantId }] },
          data: {
            isSuspended: false,
            isActive: true,
            status: "ACTIVE",
            subscriptionStatus: "ACTIVE",
            suspendedAt: null,
            suspendedReason: null,
            statusReason: null,
            statusChangedAt: now,
            isTrial: false,
            trialEndsAt: newExpiry,
            subscriptionExpiresAt: newExpiry,
          },
        });
      } catch (e) {
        console.error("[Tenant Status] Error updating Tenant on reactivate:", e);
      }

      try {
        await prisma.school.updateMany({
          where: { OR: [{ id: tenantId }, { subdomain: tenantId }] },
          data: {
            isSuspended: false,
            isActive: true,
            isBanned: false,
            deletedAt: null,
            status: "ACTIVE",
            subscriptionStatus: "ACTIVE",
            trialEndDate: newExpiry,
            subscriptionExpiresAt: newExpiry,
          },
        });
      } catch (e) {
        console.log("[Tenant Status] No school table or update error on reactivate:", e);
      }

      await clearTenantCache(tenantId);
      // Asynchronously notify admins without blocking or failing the request
      notifyTenantAdmins(tenantId, "REACTIVATED").catch(() => {});

      return NextResponse.json({
        success: true,
        status: "ACTIVE",
        isActive: true,
        message: "Tenant reactivated successfully",
      });
    }

    // 3. SUSPEND
    if (isSuspend) {
      try {
        await prisma.tenant.updateMany({
          where: { OR: [{ id: tenantId }, { subdomain: tenantId }] },
          data: {
            isSuspended: true,
            isActive: false,
            status: "SUSPENDED",
            subscriptionStatus: "SUSPENDED",
            suspendedAt: now,
            suspendedReason: reason,
            statusReason: reason,
            statusChangedAt: now,
          },
        });
      } catch (e) {
        console.error("[Tenant Status] Error updating Tenant on suspend:", e);
      }

      try {
        await prisma.school.updateMany({
          where: { OR: [{ id: tenantId }, { subdomain: tenantId }] },
          data: {
            isSuspended: true,
            isActive: false,
            isBanned: true,
            status: "SUSPENDED",
            subscriptionStatus: "ACTIVE", // Keep valid enum in School
          },
        });
      } catch (e) {
        console.log("[Tenant Status] No school table or update error on suspend:", e);
      }

      await clearTenantCache(tenantId);
      // Asynchronously notify admins
      notifyTenantAdmins(tenantId, "SUSPENDED", reason).catch(() => {});

      return NextResponse.json({
        success: true,
        status: "SUSPENDED",
        isActive: false,
        message: "Tenant suspended successfully",
      });
    }

    return NextResponse.json({ success: true, message: "No status change needed" });
  } catch (e: any) {
    console.error("TENANT STATUS UPDATE ERROR:", e);
    return NextResponse.json({ error: String(e), stack: e?.stack }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest | Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const tenantId = resolvedParams.id;

    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ id: tenantId }, { subdomain: tenantId }] },
    });

    const school = await prisma.school.findFirst({
      where: { OR: [{ id: tenantId }, { subdomain: tenantId }] },
    });

    if (!tenant && !school) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: tenant?.id || school?.id || tenantId,
        name: school?.name || tenant?.schoolName,
        subdomain: school?.subdomain || tenant?.subdomain,
        status: tenant?.status || school?.status || "ACTIVE",
        isActive: tenant?.isActive ?? school?.isActive ?? true,
        isSuspended: tenant?.isSuspended ?? false,
        subscriptionStatus: tenant?.subscriptionStatus || school?.subscriptionStatus || "ACTIVE",
      },
    });
  } catch (e: any) {
    console.error("[Tenant Status GET] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest | Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  return handleStatusUpdate(req, resolvedParams);
}

export const PATCH = async (
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) => handleStatusUpdate(req, ctx.params);

export const PUT = async (
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) => handleStatusUpdate(req, ctx.params);

export const POST = async (
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) => handleStatusUpdate(req, ctx.params);
