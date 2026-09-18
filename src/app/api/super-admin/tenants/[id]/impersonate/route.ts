import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createDatabaseSession } from "@/lib/session-manager";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (tenant.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Cannot impersonate a suspended tenant. Reactivate the tenant first." },
        { status: 400 }
      );
    }

    if (!tenant.isImpersonationAllowed) {
      return NextResponse.json(
        { error: "Administrative impersonation is disabled for this tenant." },
        { status: 403 }
      );
    }

    // 1. Generate an authoritative database session bound to the tenant domain
    const session = await createDatabaseSession({
      userId: `sa-impersonate-${tenant.id}`,
      email: tenant.adminEmail,
      tenantId: tenant.id,
      schoolDomain: tenant.subdomain,
      tenantName: tenant.schoolName,
      role: "ADMIN",
      staffRole: "SUPER_ADMIN_IMPERSONATOR",
      activeTiers: Array.isArray(tenant.institutionTypes)
        ? (tenant.institutionTypes as string[])
        : ["PRIMARY", "SECONDARY"],
      permissions: ["*"],
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      userAgent: req.headers.get("user-agent") || "SuperAdminConsole",
    });

    // 2. Record immutable audit log
    await prisma.auditLog.create({
      data: {
        actorId: "super_admin",
        action: "impersonate_tenant",
        tenantId: tenant.id,
        metadata: {
          schoolName: tenant.schoolName,
          subdomain: tenant.subdomain,
          adminEmail: tenant.adminEmail,
          sessionTokenPrefix: session.sessionToken.slice(0, 8),
        },
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    const redirectUrl = `/${tenant.subdomain}`;

    return NextResponse.json({
      success: true,
      message: `Impersonation session established for ${tenant.schoolName}`,
      redirectUrl,
    });
  } catch (error: any) {
    console.error("[SuperAdmin:Impersonate] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initialize impersonation session" },
      { status: 500 }
    );
  }
}
