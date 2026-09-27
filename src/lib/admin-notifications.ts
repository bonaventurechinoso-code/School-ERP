import { basePrisma } from "./tenant-prisma";
import crypto from "crypto";
import nodemailer from "nodemailer";

export interface PlatformNotification {
  id: string;
  title: string;
  message: string;
  link: string;
  type: "TENANT_REGISTERED" | "TENANT_SUSPENDED" | "TENANT_ACTIVATED" | "TENANT_DELETED" | string;
  read: boolean;
  metadata: any;
  createdAt: string | Date;
}

export interface RecentActivityEvent {
  id: string;
  type: "CREATED" | "SUSPENDED" | "ACTIVATED" | "DELETED";
  title: string;
  description: string;
  schoolName: string;
  subdomain?: string;
  timestamp: string | Date;
  timeAgo: string;
}

/**
 * Format relative time (e.g. "Just now", "2m ago", "1h ago", "3d ago")
 */
export function formatTimeAgo(dateInput: string | Date): string {
  if (!dateInput) return "Recently";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 45) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Self-healing DB initialization for platform notifications
 */
export async function ensureNotificationTable(): Promise<void> {
  try {
    await basePrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_notifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT DEFAULT '/admin/tenants',
        type TEXT DEFAULT 'TENANT_REGISTERED',
        read BOOLEAN DEFAULT FALSE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await basePrisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_platform_notifications_read ON platform_notifications(read)
    `);

    await basePrisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_platform_notifications_created_at ON platform_notifications(created_at DESC)
    `);
  } catch (err: any) {
    console.error("[NOTIFICATION_TABLE_INIT_ERROR]:", err?.message || err);
  }
}

/**
 * Create a new platform notification in DB
 */
export async function createPlatformNotification(params: {
  title: string;
  message: string;
  link?: string;
  type?: string;
  metadata?: any;
}): Promise<string | null> {
  try {
    await ensureNotificationTable();
    const id = crypto.randomUUID();
    const link = params.link || "/admin/tenants";
    const type = params.type || "TENANT_REGISTERED";
    const metadataStr = JSON.stringify(params.metadata || {});

    await basePrisma.$executeRawUnsafe(`
      INSERT INTO platform_notifications (id, title, message, link, type, read, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, FALSE, $6::jsonb, NOW())
    `, id, params.title, params.message, link, type, metadataStr);

    return id;
  } catch (err: any) {
    console.error("[CREATE_NOTIFICATION_ERROR]:", err?.message || err);
    return null;
  }
}

/**
 * Triggered on new tenant provisioned. Creates notification and logs audit trail.
 */
export async function recordTenantCreated(params: {
  schoolId?: string;
  schoolName: string;
  subdomain: string;
  adminEmail?: string;
  tiers?: string[];
}): Promise<void> {
  const title = `New tenant registered: ${params.schoolName}`;
  const message = `New tenant registered: ${params.schoolName} (${params.subdomain})`;

  await createPlatformNotification({
    title,
    message,
    link: "/admin/tenants",
    type: "TENANT_REGISTERED",
    metadata: params,
  });

  try {
    await basePrisma.auditLog.create({
      data: {
        actorId: "super_admin",
        action: "create_tenant",
        schoolId: params.schoolId || null,
        tenantId: params.schoolId || null,
        target: params.schoolName,
        metadata: params,
      },
    });
  } catch {
    // Audit failure non-fatal
  }
}

/**
 * Triggered on tenant suspended
 */
export async function recordTenantSuspended(params: {
  schoolId?: string;
  schoolName: string;
  subdomain?: string;
  reason?: string;
}): Promise<void> {
  const title = `Tenant suspended: ${params.schoolName}`;
  const message = `Tenant suspended: ${params.schoolName}${params.reason ? ` - ${params.reason}` : ""}`;

  await createPlatformNotification({
    title,
    message,
    link: "/admin/tenants",
    type: "TENANT_SUSPENDED",
    metadata: params,
  });

  try {
    await basePrisma.auditLog.create({
      data: {
        actorId: "super_admin",
        action: "suspend_tenant",
        schoolId: params.schoolId || null,
        tenantId: params.schoolId || null,
        target: params.schoolName,
        metadata: params,
      },
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Triggered on tenant reactivated / resumed
 */
export async function recordTenantActivated(params: {
  schoolId?: string;
  schoolName: string;
  subdomain?: string;
}): Promise<void> {
  const title = `Tenant reactivated: ${params.schoolName}`;
  const message = `Tenant reactivated: ${params.schoolName}`;

  await createPlatformNotification({
    title,
    message,
    link: "/admin/tenants",
    type: "TENANT_ACTIVATED",
    metadata: params,
  });

  try {
    await basePrisma.auditLog.create({
      data: {
        actorId: "super_admin",
        action: "reactivate_tenant",
        schoolId: params.schoolId || null,
        tenantId: params.schoolId || null,
        target: params.schoolName,
        metadata: params,
      },
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Triggered on tenant deleted
 */
export async function recordTenantDeleted(params: {
  schoolId?: string;
  schoolName: string;
  subdomain?: string;
}): Promise<void> {
  const title = `Tenant deleted: ${params.schoolName}`;
  const message = `Tenant deleted: ${params.schoolName}`;

  await createPlatformNotification({
    title,
    message,
    link: "/admin/tenants",
    type: "TENANT_DELETED",
    metadata: params,
  });

  try {
    await basePrisma.auditLog.create({
      data: {
        actorId: "super_admin",
        action: "delete_tenant",
        schoolId: params.schoolId || null,
        tenantId: params.schoolId || null,
        target: params.schoolName,
        metadata: params,
      },
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Fetch platform notifications with unread count
 */
export async function getPlatformNotifications(limit = 20): Promise<{
  notifications: PlatformNotification[];
  unreadCount: number;
}> {
  try {
    await ensureNotificationTable();

    const rows = (await basePrisma.$queryRawUnsafe(`
      SELECT 
        id, 
        title, 
        message, 
        link, 
        type, 
        read, 
        metadata, 
        created_at as "createdAt"
      FROM platform_notifications
      ORDER BY created_at DESC
      LIMIT $1
    `, limit)) as any[];

    const countRes = (await basePrisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as count 
      FROM platform_notifications 
      WHERE read = FALSE
    `)) as any[];

    let unreadCount = Number(countRes?.[0]?.count || 0);

    // If table was just created and is currently empty, seed from latest schools so admin sees immediate context
    if ((!rows || rows.length === 0)) {
      try {
        const recentSchools = await basePrisma.school.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, subdomain: true, createdAt: true },
        });

        for (const s of recentSchools) {
          const id = crypto.randomUUID();
          await basePrisma.$executeRawUnsafe(`
            INSERT INTO platform_notifications (id, title, message, link, type, read, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, FALSE, $6::jsonb, $7)
            ON CONFLICT (id) DO NOTHING
          `, 
            id, 
            `New tenant registered: ${s.name}`, 
            `New tenant registered: ${s.name} (${s.subdomain})`,
            "/admin/tenants",
            "TENANT_REGISTERED",
            JSON.stringify({ schoolId: s.id, schoolName: s.name, subdomain: s.subdomain }),
            s.createdAt
          );
        }

        // Re-query after seed
        const seededRows = (await basePrisma.$queryRawUnsafe(`
          SELECT 
            id, 
            title, 
            message, 
            link, 
            type, 
            read, 
            metadata, 
            created_at as "createdAt"
          FROM platform_notifications
          ORDER BY created_at DESC
          LIMIT $1
        `, limit)) as any[];

        const seededCount = (await basePrisma.$queryRawUnsafe(`
          SELECT COUNT(*)::int as count 
          FROM platform_notifications 
          WHERE read = FALSE
        `)) as any[];

        return {
          notifications: seededRows || [],
          unreadCount: Number(seededCount?.[0]?.count || 0),
        };
      } catch {
        // Fallback to empty
      }
    }

    return {
      notifications: rows || [],
      unreadCount,
    };
  } catch (err: any) {
    console.error("[GET_NOTIFICATIONS_ERROR]:", err?.message || err);
    return { notifications: [], unreadCount: 0 };
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(id: string): Promise<boolean> {
  try {
    await ensureNotificationTable();
    await basePrisma.$executeRawUnsafe(`
      UPDATE platform_notifications SET read = TRUE WHERE id = $1
    `, id);
    return true;
  } catch (err: any) {
    console.error("[MARK_READ_ERROR]:", err?.message || err);
    return false;
  }
}

/**
 * Mark all platform notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<boolean> {
  try {
    await ensureNotificationTable();
    await basePrisma.$executeRawUnsafe(`
      UPDATE platform_notifications SET read = TRUE WHERE read = FALSE
    `);
    return true;
  } catch (err: any) {
    console.error("[MARK_ALL_READ_ERROR]:", err?.message || err);
    return false;
  }
}

/**
 * Get Recent Activity Timeline showing latest 10 events:
 * tenant created, suspended, deleted (and reactivated)
 */
export async function getRecentActivityTimeline(limit = 10): Promise<RecentActivityEvent[]> {
  try {
    await ensureNotificationTable();

    // 1. Fetch relevant notification records
    const notificationRows = (await basePrisma.$queryRawUnsafe(`
      SELECT 
        id, 
        title, 
        message, 
        type, 
        metadata, 
        created_at as "createdAt"
      FROM platform_notifications
      WHERE type IN ('TENANT_REGISTERED', 'TENANT_SUSPENDED', 'TENANT_ACTIVATED', 'TENANT_DELETED')
      ORDER BY created_at DESC
      LIMIT $1
    `, limit)) as any[];

    const events: RecentActivityEvent[] = [];

    if (notificationRows && notificationRows.length > 0) {
      for (const row of notificationRows) {
        let type: RecentActivityEvent["type"] = "CREATED";
        if (row.type === "TENANT_SUSPENDED") type = "SUSPENDED";
        else if (row.type === "TENANT_ACTIVATED") type = "ACTIVATED";
        else if (row.type === "TENANT_DELETED") type = "DELETED";

        const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata || "{}") : (row.metadata || {});
        const schoolName = meta.schoolName || row.title.replace(/^New tenant registered:\s*|^Tenant suspended:\s*|^Tenant reactivated:\s*|^Tenant deleted:\s*/i, "");

        events.push({
          id: row.id,
          type,
          title: row.title,
          description: row.message,
          schoolName: schoolName || "Institution",
          subdomain: meta.subdomain,
          timestamp: row.createdAt,
          timeAgo: formatTimeAgo(row.createdAt),
        });
      }
    }

    // 2. Complement with AuditLog if needed to ensure we have up to 10 events
    if (events.length < limit) {
      try {
        const auditLogs = await basePrisma.auditLog.findMany({
          where: {
            action: {
              in: ["create_tenant", "suspend_tenant", "reactivate_tenant", "delete_tenant"],
            },
          },
          take: limit,
          orderBy: { createdAt: "desc" },
        });

        for (const log of auditLogs) {
          if (events.some(e => e.id === log.id)) continue;
          let type: RecentActivityEvent["type"] = "CREATED";
          let title = "Tenant Created";
          if (log.action.includes("suspend")) {
            type = "SUSPENDED";
            title = "Tenant Suspended";
          } else if (log.action.includes("reactivate")) {
            type = "ACTIVATED";
            title = "Tenant Reactivated";
          } else if (log.action.includes("delete")) {
            type = "DELETED";
            title = "Tenant Deleted";
          }

          const meta = (log.metadata as any) || {};
          const schoolName = meta.schoolName || log.target || "Institutional Tenant";

          events.push({
            id: log.id,
            type,
            title: `${title}: ${schoolName}`,
            description: `${title}: ${schoolName}${meta.subdomain ? ` (${meta.subdomain})` : ""}`,
            schoolName,
            subdomain: meta.subdomain,
            timestamp: log.createdAt,
            timeAgo: formatTimeAgo(log.createdAt),
          });
        }
      } catch {
        // Ignore audit log query failure
      }
    }

    // 3. Fallback: If still under limit and schools exist, populate from School records
    if (events.length < limit) {
      try {
        const schools = await basePrisma.school.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
        });

        for (const s of schools) {
          if (events.some(e => e.schoolName === s.name || e.subdomain === s.subdomain)) continue;
          events.push({
            id: `sch-${s.id}`,
            type: s.isActive ? "CREATED" : "SUSPENDED",
            title: s.isActive ? `Tenant Registered: ${s.name}` : `Tenant Suspended: ${s.name}`,
            description: s.isActive 
              ? `Tenant registered: ${s.name} (${s.subdomain})`
              : `Tenant is currently suspended: ${s.name}`,
            schoolName: s.name,
            subdomain: s.subdomain,
            timestamp: s.createdAt,
            timeAgo: formatTimeAgo(s.createdAt),
          });
        }
      } catch {
        // Ignore
      }
    }

    // Sort by timestamp desc and take exactly latest 10
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events.slice(0, limit);
  } catch (err: any) {
    console.error("[GET_TIMELINE_ERROR]:", err?.message || err);
    return [];
  }
}

/**
 * Trigger Super-Admin notification email on tenant registration if SMTP is configured.
 * Non-blocking, failsafe delivery.
 */
export async function sendSuperAdminTenantRegistrationEmail(payload: {
  schoolName: string;
  subdomain: string;
  adminEmail: string;
  contactPhone?: string | null;
  tiers?: string[];
  schoolId?: string;
}): Promise<{ delivered: boolean; mode: string }> {
  const isSmtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);

  if (!isSmtpConfigured) {
    console.log(
      `[SUPER_ADMIN_EMAIL] SMTP not configured (SMTP_HOST/SMTP_USER missing). Skipped email delivery for new tenant: "${payload.schoolName}".`
    );
    return { delivered: false, mode: "SKIPPED_NOT_CONFIGURED" };
  }

  const superAdminEmail =
    process.env.SUPER_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "admin@bonaveeict.com.ng";

  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BASE_URL ||
    "https://bonaveeict.com.ng"
  ).replace(/\/$/, "");

  const tenantConsoleUrl = `${baseUrl}/admin/tenants`;
  const portalUrl = `${baseUrl}/${payload.subdomain}`;
  const tiersList = Array.isArray(payload.tiers) && payload.tiers.length > 0 
    ? payload.tiers.join(", ") 
    : "Standard Tier";

  const formattedDate = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>New Tenant Registered</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 24px 32px; text-align: left; }
    .badge { display: inline-block; background: #3b82f6; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px; letter-spacing: 0.05em; }
    .title { font-size: 22px; font-weight: 800; margin: 0; }
    .content { padding: 32px; }
    .field-row { margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
    .label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
    .value { font-size: 15px; font-weight: 600; color: #0f172a; }
    .subdomain-tag { font-family: monospace; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 6px; font-size: 13px; font-weight: 700; }
    .btn { display: inline-block; background: #0f172a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 10px; margin-top: 20px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">Super-Admin Alert</span>
      <h1 class="title">New Tenant Provisioned</h1>
    </div>
    <div class="content">
      <p style="font-size: 14px; color: #475569; margin-top: 0; margin-bottom: 24px;">
        A new institutional tenant has registered and completed automated provisioning on the School ERP platform.
      </p>

      <div class="field-row">
        <div class="label">School Name</div>
        <div class="value">${payload.schoolName}</div>
      </div>

      <div class="field-row">
        <div class="label">Subdomain Slug</div>
        <div class="value"><span class="subdomain-tag">${payload.subdomain}</span> &bull; <a href="${portalUrl}" style="color: #4f46e5; text-decoration: none; font-size: 13px;">${payload.subdomain}.bonaveeict.com.ng</a></div>
      </div>

      <div class="field-row">
        <div class="label">Primary Administrator Email</div>
        <div class="value">${payload.adminEmail}</div>
      </div>

      ${payload.contactPhone ? `
      <div class="field-row">
        <div class="label">Contact Phone</div>
        <div class="value">${payload.contactPhone}</div>
      </div>` : ''}

      <div class="field-row">
        <div class="label">Academic Tiers</div>
        <div class="value">${tiersList}</div>
      </div>

      <div class="field-row">
        <div class="label">Registered At</div>
        <div class="value">${formattedDate}</div>
      </div>

      <a href="${tenantConsoleUrl}" class="btn">Open Super-Admin Console &rarr;</a>
    </div>
    <div class="footer">
      Automated dispatch from School ERP Platform Notification Service &bull; BonaVee ICT
    </div>
  </div>
</body>
</html>
  `;

  try {
    console.log(`[SUPER_ADMIN_EMAIL] Attempting SMTP dispatch to ${superAdminEmail} via ${process.env.SMTP_HOST}...`);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || "School ERP Platform <noreply@bonaveeict.com.ng>",
      to: superAdminEmail,
      subject: `[New Tenant] ${payload.schoolName} (${payload.subdomain})`,
      html: htmlContent,
    });

    console.log(`[SUPER_ADMIN_EMAIL] Successfully sent notification to ${superAdminEmail}:`, info.messageId);
    return { delivered: true, mode: `SMTP (${info.messageId})` };
  } catch (err: any) {
    console.error("[SUPER_ADMIN_EMAIL_EXCEPTION]:", err?.message || err);
    return { delivered: false, mode: "FAILED" };
  }
}
