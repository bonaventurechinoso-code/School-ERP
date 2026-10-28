import { NextRequest, NextResponse } from "next/server";
import {
  softDeleteTenant,
  reactivateTenant,
  suspendTenant,
  findSchoolAndTenant,
} from "@/lib/tenant-status";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { school, tenant } = await findSchoolAndTenant(id);

    if (!school && !tenant) {
      return NextResponse.json(
        { success: true, message: "Tenant soft-deleted" },
        { status: 200 }
      );
    }

    const result = await softDeleteTenant(id, "Soft-deleted by Super Admin");

    return NextResponse.json({
      success: true,
      message: `Tenant ${
        result.school?.name || result.tenant?.schoolName || id
      } soft-deleted`,
      data: {
        id: result.school?.id || result.tenant?.id || id,
        status: "DELETED",
        isActive: false,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[SuperAdmin:TenantDelete] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to soft-delete tenant" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const rawStatus = String(body?.status || "").toUpperCase();
    const isDeleted = Boolean(body?.isDeleted) || rawStatus === "DELETED";

    if (isDeleted) {
      const result = await softDeleteTenant(id, body?.reason || "Soft-deleted by Super Admin");
      return NextResponse.json({
        success: true,
        data: {
          id: result.school?.id || result.tenant?.id || id,
          status: "DELETED",
          isActive: false,
        },
      });
    }

    if (rawStatus === "SUSPENDED") {
      const result = await suspendTenant(id, body?.reason || "Subscription overdue");
      return NextResponse.json({
        success: true,
        data: {
          id: result.school?.id || result.tenant?.id || id,
          status: "SUSPENDED",
          isActive: false,
        },
      });
    }

    const result = await reactivateTenant(id);
    return NextResponse.json({
      success: true,
      data: {
        id: result.school?.id || result.tenant?.id || id,
        status: "ACTIVE",
        isActive: true,
      },
    });
  } catch (error: any) {
    console.error("[SuperAdmin:TenantUpdate] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update tenant" },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;

