import { NextRequest, NextResponse } from "next/server";
import { getAllApplications } from "@/modules/enrollment/enrollment.controller";
import { basePrisma } from "@/lib/tenant-prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const headerTenantId =
      request.headers.get("x-tenant-id") ||
      request.headers.get("tenant-id") ||
      request.headers.get("x-school-id");

    const tenantId =
      headerTenantId ||
      searchParams.get("tenant_id") ||
      searchParams.get("schoolId") ||
      searchParams.get("schoolDomain");

    const status = searchParams.get("status") || undefined;

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id parameter or x-tenant-id header is required" },
        { status: 400 }
      );
    }

    const applications = await getAllApplications({
      tenantId: tenantId.trim(),
      status: status || undefined,
    });

    return NextResponse.json({
      success: true,
      count: applications.length,
      data: applications,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch admissions" },
      { status: 500 }
    );
  }
}
