import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { prisma } from "@/lib/prisma";
import { createDatabaseSession } from "@/lib/session-manager";
import { buildTenantUrl } from "@/lib/tenant-resolver";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ id }, { subdomain: id }, { slug: id }],
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Platform Owner Super Admin has the authoritative right to access ANY tenant dashboard
    // through the SaaS layer without restriction (even if suspended or impersonation is toggled).

    // 1. Generate an authoritative database session bound to the tenant domain
    const session = await createDatabaseSession({
      userId: `sa-impersonate-${tenant.id}`,
      email: tenant.adminEmail || "superadmin@bonaveeict.com.ng",
      tenantId: tenant.id,
      schoolDomain: tenant.subdomain,
      tenantName: tenant.schoolName,
      role: "SUPER_ADMIN",
      userRole: "SUPER_ADMIN",
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

    // 3. Issue cross-subdomain SSO handshake token
    const ssoToken = await new jose.SignJWT({
      userId: `sa-impersonate-${tenant.id}`,
      email: tenant.adminEmail || "superadmin@bonaveeict.com.ng",
      tenantId: tenant.id,
      tenantSlug: tenant.subdomain,
      schoolDomain: tenant.subdomain,
      tenantName: tenant.schoolName,
      role: "SUPER_ADMIN",
      userRole: "SUPER_ADMIN",
      staffRole: "SUPER_ADMIN_IMPERSONATOR",
      activeTiers: Array.isArray(tenant.institutionTypes)
        ? (tenant.institutionTypes as string[])
        : ["PRIMARY", "SECONDARY"],
      permissions: ["*"],
      sessionToken: session.sessionToken,
      isSuperAdmin: true,
      type: "super_admin_sso",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(SECRET_KEY);

    const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const protoHeader = req.headers.get("x-forwarded-proto");
    const tenantSubdomainUrl = buildTenantUrl(tenant.subdomain, hostHeader, "/dashboard", protoHeader);
    const redirectUrl = `${tenantSubdomainUrl}?sso_token=${ssoToken}`;

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
