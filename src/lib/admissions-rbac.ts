/**
 * Role-Based Access Control (RBAC) Specification for Admissions Module.
 * Client and Server safe (no Node.js filesystem or crypto dependencies).
 */

export const AUTHORIZED_ADMISSION_ROLES = [
  "SUPER_ADMIN",
  "SUPERADMIN",
  "SCHOOL_ADMIN",
  "ADMIN",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "HEADMASTER",
  "REGISTRAR",
  "ADMISSIONS_OFFICER",
  "ADMISSIONS",
  "BURSAR",
];

/**
 * Validates if the user profile role or staff role possesses structural
 * admissions mutation privileges (e.g. Mark Verified, Reject File, Convert to Student).
 */
export function isAdmissionsAuthorized(
  role?: string | null,
  staffRole?: string | null
): boolean {
  if (!role && !staffRole) return false;
  const r = (role || "").toUpperCase().trim();
  const s = (staffRole || "").toUpperCase().trim();

  return (
    AUTHORIZED_ADMISSION_ROLES.includes(r) ||
    AUTHORIZED_ADMISSION_ROLES.includes(s) ||
    r.includes("REGISTRAR") ||
    s.includes("REGISTRAR") ||
    r.includes("ADMISSION") ||
    s.includes("ADMISSION") ||
    r.includes("ADMIN") ||
    s.includes("ADMIN")
  );
}

/**
 * Throws an explicit error if the role does not have admissions authorization.
 */
export function assertAdmissionsAuthorized(
  role?: string | null,
  staffRole?: string | null,
  operation = "mutate"
): void {
  if (!isAdmissionsAuthorized(role, staffRole)) {
    throw new Error(
      `[RBAC_DENIED] Structural admissions mutation '${operation}' is restricted strictly to authorized Registrar, Admissions Officer, or Superadmin roles.`
    );
  }
}
