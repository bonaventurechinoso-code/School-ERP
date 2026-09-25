import { basePrisma } from "./tenant-prisma";

export interface LogAuditParams {
  actorId?: string | null;
  action: string;
  target?: string | null;
  schoolId?: string | null;
  ip?: string | null;
  metadata?: any;
}

/**
 * Systematically logs sensitive actions to the AuditLog table:
 * - User authentication actions (LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, ACCOUNT_LOCKED)
 * - Password updates (PASSWORD_CHANGE, PASSWORD_RESET_REQUEST, PASSWORD_RESET_SUCCESS)
 * - Student enrollment actions (STUDENT_ENROLLED, STUDENT_CREATED)
 * - Billing adjustments (BILLING_ADJUSTMENT, INVOICE_PAID, SUBSCRIPTION_UPDATED)
 * - Role updates (ROLE_UPDATED)
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    const actorId = params.actorId || "SYSTEM";
    const ip = params.ip || "unknown";

    await basePrisma.auditLog.create({
      data: {
        actorId,
        action: params.action,
        target: params.target || null,
        schoolId: params.schoolId || null,
        ip: ip,
        ipAddress: ip,
        tenantId: params.schoolId || null,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });
  } catch (err: any) {
    // Fail-safe: Audit log failure should be recorded to server error console without halting primary transaction
    console.error(`[AUDIT_LOG_ERROR]: Failed to persist audit event "${params.action}":`, err?.message || err);
  }
}
