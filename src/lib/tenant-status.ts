import { prisma } from "@/lib/prisma";
import { invalidateTenantMetadata } from "@/lib/cache-invalidation";
import { getSchoolsStore } from "@/app/dashboard/super-admin/mock-data";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

let hasHealedInitialState = false;

/**
 * Resolves both School and Tenant records by ID, subdomain, or slug (case-insensitive).
 */
export async function findSchoolAndTenant(idOrSlug: string) {
  const clean = (idOrSlug || "").trim();
  if (!clean) return { school: null, tenant: null };

  let school = await prisma.school.findFirst({
    where: {
      OR: [
        { id: clean },
        { subdomain: { equals: clean, mode: "insensitive" } },
        { slug: { equals: clean, mode: "insensitive" } },
      ],
    },
    include: {
      users: {
        where: {
          role: { in: ["SCHOOL_ADMIN", "PRINCIPAL", "HEADMASTER", "VICE_PRINCIPAL"] },
        },
        select: { id: true, email: true, role: true },
      },
      staff: {
        take: 5,
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      academicTiers: {
        select: { name: true },
      },
    },
  });

  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { id: clean },
        ...(school?.subdomain
          ? [{ subdomain: { equals: school.subdomain, mode: "insensitive" as const } }]
          : [{ subdomain: { equals: clean, mode: "insensitive" as const } }]),
      ],
    },
    include: { plan: true },
  });

  // If matched via Tenant ID first, also resolve the corresponding School by subdomain
  if (!school && tenant?.subdomain) {
    school = await prisma.school.findFirst({
      where: {
        OR: [
          { subdomain: { equals: tenant.subdomain, mode: "insensitive" } },
          { slug: { equals: tenant.subdomain, mode: "insensitive" } },
        ],
      },
      include: {
        users: {
          where: {
            role: { in: ["SCHOOL_ADMIN", "PRINCIPAL", "HEADMASTER", "VICE_PRINCIPAL"] },
          },
          select: { id: true, email: true, role: true },
        },
        staff: {
          take: 5,
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        academicTiers: {
          select: { name: true },
        },
      },
    });
  }

  return { school, tenant };
}

/**
 * Notifies all Tenant Admins of a specific school (DB Notice + AuditLog + Email)
 * when their institution is SUSPENDED or REACTIVATED by the Super Admin.
 * Strictly isolated to the target school/tenant.
 */
export async function notifyTenantAdmins(
  tenantIdOrSlug: string,
  type: "SUSPENDED" | "REACTIVATED",
  reason?: string
): Promise<{ notifiedCount: number; emails: string[] }> {
  const { school, tenant } = await findSchoolAndTenant(tenantIdOrSlug);
  const schoolId = school?.id || null;
  const tenantId = tenant?.id || school?.id || tenantIdOrSlug;
  const schoolName = school?.name || tenant?.schoolName || "Your Institution";
  const subdomain = (school?.subdomain || tenant?.subdomain || tenantIdOrSlug).trim().toLowerCase();
  const slug = (school?.slug || subdomain).trim().toLowerCase();

  // 1. Collect all unique admin emails strictly belonging to this tenant
  const emailSet = new Set<string>();
  const adminUserIds: string[] = [];

  if (schoolId) {
    const dbAdmins = await prisma.user
      .findMany({
        where: {
          schoolId,
          role: { in: ["SCHOOL_ADMIN", "PRINCIPAL", "HEADMASTER", "VICE_PRINCIPAL"] },
        },
        select: { id: true, email: true },
      })
      .catch(() => []);

    for (const a of dbAdmins) {
      if (a.id) adminUserIds.push(a.id);
      if (a.email && a.email.includes("@")) emailSet.add(a.email.trim().toLowerCase());
    }
  }

  if (tenant?.adminEmail && tenant.adminEmail.includes("@")) {
    emailSet.add(tenant.adminEmail.trim().toLowerCase());
  }
  if (school?.staff?.[0]?.email && school.staff[0].email.includes("@")) {
    emailSet.add(school.staff[0].email.trim().toLowerCase());
  }

  const emails = Array.from(emailSet);

  const isSuspended = type === "SUSPENDED";
  const title = isSuspended
    ? `Your school ${schoolName} has been suspended`
    : `Your school ${schoolName} has been reactivated`;

  const message = isSuspended
    ? `Reason: ${reason || "Contact Super Admin at support@bonaveeict.com.ng"}. Access is blocked until reactivated.`
    : `Your school is now ACTIVE again. You can login at https://${subdomain}.bonaveeict.com.ng/login or https://bonaveeict.com.ng/${slug}/login. Trial extended 30 days.`;

  // 2. Persist in-app Notice (scoped strictly to schoolId) + AuditLog
  if (schoolId) {
    await prisma.notice
      .create({
        data: {
          schoolId,
          title,
          content: message,
          targetAudience: "STAFF",
          priority: "HIGH",
        },
      })
      .catch(() => null);
  }

  await prisma.auditLog
    .create({
      data: {
        actorId: "super_admin",
        action: isSuspended ? "TENANT_SUSPENDED" : "TENANT_REACTIVATED",
        schoolId,
        tenantId,
        target: schoolName,
        metadata: {
          subdomain,
          slug,
          type,
          reason: reason || null,
          notifiedAdmins: emails,
          adminUserIds,
          title,
          message,
        },
      },
    })
    .catch(() => null);

  // 3. Send emails to each tenant admin of this school
  if (emails.length > 0) {
    try {
      const { sendMail } = await import("@/lib/mail");
      const htmlBody = isSuspended
        ? `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #fed7aa;border-radius:12px;background:#fff7ed;">
            <h2 style="color:#c2410c;margin-top:0;">${title}</h2>
            <p>Dear Administrator of <strong>${schoolName}</strong>,</p>
            <p>${message}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>To reactivate:</strong></p>
            <ol>
              <li>Login to <a href="https://bonaveeict.com.ng/admin/billing">bonaveeict.com.ng/admin/billing</a></li>
              <li>Pay outstanding subscription and upload receipt</li>
              <li>Contact <a href="mailto:support@bonaveeict.com.ng">support@bonaveeict.com.ng</a> — School Code: <strong>${slug}</strong></li>
            </ol>
          </div>`
        : `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4;">
            <h2 style="color:#15803d;margin-top:0;">${title}</h2>
            <p>Dear Administrator of <strong>${schoolName}</strong>,</p>
            <p>${message}</p>
            <p style="margin-top:16px;">
              <a href="https://bonaveeict.com.ng/${slug}/login" style="display:inline-block;background:#16a34a;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">
                Sign In to ${schoolName}
              </a>
            </p>
          </div>`;

      await Promise.all(
        emails.map((toEmail) =>
          sendMail({
            to: toEmail,
            subject: title,
            html: htmlBody,
            schoolId: schoolId || undefined,
            recipientType: "ADMIN",
            logCategory: isSuspended ? "TENANT_SUSPENDED" : "TENANT_REACTIVATED",
          }).catch(() => null)
        )
      );
    } catch (e) {
      console.error("[notifyTenantAdmins] Email dispatch warning:", e);
    }
  }

  return { notifiedCount: emails.length, emails };
}

/**
 * Reactivates a tenant across both School and Tenant tables:
 * - Sets status = 'ACTIVE', isActive = true, isBanned = false, deletedAt = null
 * - Clears suspendedAt and suspendedReason
 * - Sets subscriptionStatus = 'ACTIVE'
 * - Extends trialEndDate / trialEndsAt by 30 days if expired or missing
 */
export async function reactivateTenant(id: string) {
  const now = new Date();
  const { school, tenant } = await findSchoolAndTenant(id);

  const future30Days = new Date(now.getTime() + THIRTY_DAYS_MS);
  const resolvedSubdomain = (
    school?.subdomain ||
    tenant?.subdomain ||
    id
  )
    .trim()
    .toLowerCase();

  let updatedSchool: any = null;
  if (school) {
    const schoolTrialEnd =
      school.trialEndDate && school.trialEndDate > now
        ? school.trialEndDate
        : future30Days;
    const schoolSubExpires =
      school.subscriptionExpiresAt && school.subscriptionExpiresAt > now
        ? school.subscriptionExpiresAt
        : future30Days;

    updatedSchool = await prisma.school.update({
      where: { id: school.id },
      data: {
        status: "ACTIVE",
        isActive: true,
        isBanned: false,
        deletedAt: null,
        subscriptionStatus: "ACTIVE",
        trialEndDate: schoolTrialEnd,
        subscriptionExpiresAt: schoolSubExpires,
        isPublicPortalEnabled: true,
        subdomain: school.subdomain.trim().toLowerCase(),
        slug: (school.slug || school.subdomain).trim().toLowerCase(),
      },
    });

    await prisma.subscription
      .updateMany({
        where: { schoolId: school.id },
        data: {
          status: "ACTIVE",
          expiresAt: schoolSubExpires,
        },
      })
      .catch(() => {});

    await prisma.user
      .updateMany({
        where: { schoolId: school.id },
        data: { status: "ACTIVE" },
      })
      .catch(() => {});
  } else if (tenant) {
    try {
      updatedSchool = await prisma.school.upsert({
        where: { subdomain: resolvedSubdomain },
        update: {
          status: "ACTIVE",
          isActive: true,
          isBanned: false,
          deletedAt: null,
          subscriptionStatus: "ACTIVE",
          trialEndDate: future30Days,
          subscriptionExpiresAt: future30Days,
          isPublicPortalEnabled: true,
        },
        create: {
          id: tenant.id,
          name: tenant.schoolName,
          subdomain: resolvedSubdomain,
          slug: resolvedSubdomain,
          status: "ACTIVE",
          isActive: true,
          isBanned: false,
          deletedAt: null,
          subscriptionStatus: "ACTIVE",
          trialStartDate: now,
          trialEndDate: future30Days,
          subscriptionExpiresAt: future30Days,
          contactPhone: tenant.contactPhone || "+234 800 000 0000",
          isPublicPortalEnabled: true,
        },
      });
    } catch {}
  }

  let updatedTenant: any = null;
  if (tenant) {
    const trialEndsAt =
      tenant.trialEndsAt && tenant.trialEndsAt > now
        ? tenant.trialEndsAt
        : future30Days;

    updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        suspendedReason: null,
        suspendedAt: null,
        isTrial: false,
        trialEndsAt,
      },
    });
  } else if (updatedSchool) {
    try {
      const adminEmail =
        school?.users?.[0]?.email ||
        school?.staff?.[0]?.email ||
        `${resolvedSubdomain}@bonaveeict.com.ng`;

      updatedTenant = await prisma.tenant.upsert({
        where: { subdomain: resolvedSubdomain },
        update: {
          status: "ACTIVE",
          subscriptionStatus: "ACTIVE",
          suspendedReason: null,
          suspendedAt: null,
          isTrial: false,
          trialEndsAt: future30Days,
        },
        create: {
          id: updatedSchool.id,
          schoolName: updatedSchool.name,
          subdomain: resolvedSubdomain,
          adminEmail,
          contactPhone: updatedSchool.contactPhone || "+234 800 000 0000",
          institutionTypes: (school?.academicTiers || []).map((t) => t.name),
          status: "ACTIVE",
          subscriptionStatus: "ACTIVE",
          suspendedReason: null,
          suspendedAt: null,
          isTrial: false,
          trialEndsAt: future30Days,
        },
      });
    } catch {}
  }

  try {
    const store = getSchoolsStore();
    for (const s of store) {
      if (
        s.id.toLowerCase() === id.toLowerCase() ||
        s.subdomain.toLowerCase() === resolvedSubdomain
      ) {
        s.planStatus = "Active";
        s.subscriptionStatus = "Active";
        (s as any).status = "ACTIVE";
        (s as any).isActive = true;
        (s as any).isDeleted = false;
      }
    }
  } catch {}

  if (resolvedSubdomain) {
    await invalidateTenantMetadata(resolvedSubdomain).catch(() => {});
  }

  return { school: updatedSchool || school, tenant: updatedTenant || tenant, resolvedSubdomain };
}

/**
 * Suspends a tenant across both School and Tenant tables (never deletes data).
 */
export async function suspendTenant(id: string, reason = "Subscription overdue") {
  const now = new Date();
  const { school, tenant } = await findSchoolAndTenant(id);
  const resolvedSubdomain = (
    school?.subdomain ||
    tenant?.subdomain ||
    id
  )
    .trim()
    .toLowerCase();

  let updatedSchool: any = null;
  if (school) {
    updatedSchool = await prisma.school.update({
      where: { id: school.id },
      data: {
        status: "SUSPENDED",
        isActive: false,
        isBanned: true,
      },
    });
  }

  let updatedTenant: any = null;
  if (tenant) {
    updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status: "SUSPENDED",
        subscriptionStatus: "SUSPENDED",
        suspendedReason: reason,
        suspendedAt: now,
      },
    });
  } else if (school) {
    try {
      const adminEmail =
        school.users?.[0]?.email ||
        school.staff?.[0]?.email ||
        `${resolvedSubdomain}@bonaveeict.com.ng`;

      updatedTenant = await prisma.tenant.upsert({
        where: { subdomain: resolvedSubdomain },
        update: {
          status: "SUSPENDED",
          subscriptionStatus: "SUSPENDED",
          suspendedReason: reason,
          suspendedAt: now,
        },
        create: {
          id: school.id,
          schoolName: school.name,
          subdomain: resolvedSubdomain,
          adminEmail,
          contactPhone: school.contactPhone || "+234 800 000 0000",
          institutionTypes: (school.academicTiers || []).map((t) => t.name),
          status: "SUSPENDED",
          subscriptionStatus: "SUSPENDED",
          suspendedReason: reason,
          suspendedAt: now,
        },
      });
    } catch {}
  }

  try {
    const store = getSchoolsStore();
    for (const s of store) {
      if (
        s.id.toLowerCase() === id.toLowerCase() ||
        s.subdomain.toLowerCase() === resolvedSubdomain
      ) {
        s.planStatus = "Suspended";
        s.subscriptionStatus = "Suspended";
        (s as any).status = "SUSPENDED";
        (s as any).isActive = false;
      }
    }
  } catch {}

  if (resolvedSubdomain) {
    await invalidateTenantMetadata(resolvedSubdomain).catch(() => {});
  }

  return { school: updatedSchool || school, tenant: updatedTenant || tenant, resolvedSubdomain };
}

/**
 * Soft-deletes a tenant across School and Tenant tables (sets status='DELETED', deletedAt=now, isActive=false).
 * Never performs a hard DELETE.
 */
export async function softDeleteTenant(id: string, reason = "Soft-deleted by Super Admin") {
  const now = new Date();
  const { school, tenant } = await findSchoolAndTenant(id);
  const resolvedSubdomain = (
    school?.subdomain ||
    tenant?.subdomain ||
    id
  )
    .trim()
    .toLowerCase();

  let updatedSchool: any = null;
  if (school) {
    updatedSchool = await prisma.school.update({
      where: { id: school.id },
      data: {
        status: "DELETED",
        isActive: false,
        isBanned: true,
        deletedAt: now,
      },
    });
  }

  let updatedTenant: any = null;
  if (tenant) {
    updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status: "DELETED",
        subscriptionStatus: "SUSPENDED",
        suspendedReason: reason,
        suspendedAt: now,
      },
    });
  }

  try {
    const store = getSchoolsStore();
    for (const s of store) {
      if (
        s.id.toLowerCase() === id.toLowerCase() ||
        s.subdomain.toLowerCase() === resolvedSubdomain
      ) {
        (s as any).status = "DELETED";
        (s as any).isActive = false;
        (s as any).isDeleted = true;
      }
    }
  } catch {}

  try {
    await prisma.auditLog.create({
      data: {
        actorId: "super_admin",
        action: "SOFT_DELETE_TENANT",
        schoolId: school?.id || null,
        tenantId: tenant?.id || school?.id || id,
        target: school?.name || tenant?.schoolName || resolvedSubdomain,
        metadata: {
          subdomain: resolvedSubdomain,
          reason,
          deletedAt: now.toISOString(),
        },
      },
    });
  } catch {}

  if (resolvedSubdomain) {
    await invalidateTenantMetadata(resolvedSubdomain).catch(() => {});
  }

  return { school: updatedSchool || school, tenant: updatedTenant || tenant, resolvedSubdomain };
}

/**
 * One-time startup heal for Egede (e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8) and Demo School
 * (cmvmpetxa0000d0i0kstf3idu / b8864963-5f77-4e6b-a859-9b9defa5b6bb).
 */
export async function ensureEgedeAndDemoRestored(): Promise<void> {
  if (hasHealedInitialState) return;
  hasHealedInitialState = true;

  try {
    const egedeSchool = await prisma.school.findFirst({
      where: {
        OR: [
          { id: "e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8" },
          { name: { contains: "Egede", mode: "insensitive" } },
          { subdomain: { contains: "egede", mode: "insensitive" } },
          { slug: { contains: "egede", mode: "insensitive" } },
        ],
      },
    });
    const egedeTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { schoolName: { contains: "Egede", mode: "insensitive" } },
          { subdomain: { contains: "egede", mode: "insensitive" } },
        ],
      },
    });

    const egedeTargetId =
      egedeSchool?.id ||
      egedeTenant?.id ||
      egedeSchool?.subdomain ||
      egedeTenant?.subdomain;
    if (egedeTargetId) {
      await reactivateTenant(egedeTargetId);
    }

    const now = new Date();
    const future30Days = new Date(now.getTime() + THIRTY_DAYS_MS);

    await prisma.school.upsert({
      where: { subdomain: "demo" },
      update: {
        status: "ACTIVE",
        isActive: true,
        isBanned: false,
        deletedAt: null,
        subscriptionStatus: "ACTIVE",
        trialEndDate: future30Days,
        subscriptionExpiresAt: future30Days,
        isPublicPortalEnabled: true,
      },
      create: {
        id: "b8864963-5f77-4e6b-a859-9b9defa5b6bb",
        name: "Demo School",
        subdomain: "demo",
        slug: "demo",
        status: "ACTIVE",
        isActive: true,
        isBanned: false,
        deletedAt: null,
        subscriptionStatus: "ACTIVE",
        trialStartDate: now,
        trialEndDate: future30Days,
        subscriptionExpiresAt: future30Days,
        contactPhone: "+234 800 000 0000",
        isPublicPortalEnabled: true,
      },
    });

    await prisma.tenant.upsert({
      where: { subdomain: "demo" },
      update: {
        status: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        suspendedReason: null,
        suspendedAt: null,
        isDemo: true,
        isTrial: false,
        trialEndsAt: future30Days,
      },
      create: {
        id: "cmvmpetxa0000d0i0kstf3idu",
        schoolName: "Demo School",
        subdomain: "demo",
        adminEmail: "headmaster@demo.edu.ng",
        contactPhone: "+234 800 000 0000",
        institutionTypes: ["Primary School", "Secondary School"],
        status: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        isDemo: true,
        isTrial: false,
        trialEndsAt: future30Days,
      },
    });

    await invalidateTenantMetadata("demo").catch(() => {});
  } catch (err) {
    console.warn("[TenantStatus:ensureEgedeAndDemoRestored] Non-fatal warning:", err);
  }
}
