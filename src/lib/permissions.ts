/**
 * Core Role-Based Access Control (RBAC) & Route Authorization Engine
 *
 * Provides classification and authorization guards for both Edge Middleware
 * and React Server/Client Components across SchoolERP multi-tenant routes.
 */

export type RoleCategory =
  | "SUPER_ADMIN"
  | "ADMIN_EXECUTIVE"
  | "ACADEMIC_ADMIN"
  | "ACADEMIC_FACULTY"
  | "FINANCIAL"
  | "OPERATIONS_SUPPORT"
  | "STUDENT"
  | "GUEST";

/**
 * Normalizes and categorizes any raw role string (from token role or staffRole)
 * into a standardized architectural category.
 */
export function classifyRole(role?: string | null, staffRole?: string | null): RoleCategory {
  const combined = `${role || ""} ${staffRole || ""}`.trim().toUpperCase();

  if (!combined) return "GUEST";

  // 1. Master SaaS Super Admin
  if (combined.includes("SUPER_ADMIN")) {
    return "SUPER_ADMIN";
  }

  // 2. Student Role
  if (combined.includes("STUDENT")) {
    return "STUDENT";
  }

  // 3. Executive / School Leadership
  // e.g. Proprietor, Principal, Headmaster, Headmistress, Head Teacher, Vice Chancellor, Rector, Provost, Registrar, SCHOOL_ADMIN, TENANT_ADMIN, SCHOOL_OWNER
  if (
    combined.includes("PROPRIETOR") ||
    combined.includes("PROPRIETRESS") ||
    (combined.includes("PRINCIPAL") && !combined.includes("VICE PRINCIPAL (ACADEMIC)")) ||
    combined.includes("HEADMASTER") ||
    combined.includes("HEADMISTRESS") ||
    combined.includes("HEAD TEACHER") ||
    combined.includes("VICE CHANCELLOR") ||
    combined.includes("RECTOR") ||
    combined.includes("PROVOST") ||
    combined.includes("REGISTRAR") ||
    combined.includes("SCHOOL_ADMIN") ||
    combined.includes("TENANT_ADMIN") ||
    combined.includes("SCHOOL_OWNER") ||
    combined.includes("TENANT_OWNER") ||
    combined.includes("ADMIN_EXECUTIVE") ||
    combined.includes("ADMINISTRATOR") ||
    combined.includes("DIRECTOR") ||
    combined === "ADMIN" ||
    combined.split(/[\s_-]+/).includes("ADMIN")
  ) {
    return "ADMIN_EXECUTIVE";
  }

  // 4. Academic Leadership
  // e.g. Vice Principal (Academic), Dean of Studies, Dean of Faculty, Exam Officer
  if (
    combined.includes("VICE PRINCIPAL (ACADEMIC)") ||
    combined.includes("DEAN OF STUDIES") ||
    combined.includes("DEAN OF FACULTY") ||
    combined.includes("EXAM OFFICER") ||
    combined.includes("HOD") ||
    combined.includes("HEAD OF DEPARTMENT")
  ) {
    return "ACADEMIC_ADMIN";
  }

  // 5. Financial Roles
  // e.g. Bursar, School Bursar, Bursar / Accountant, Accountant, Cashier, Finance Officer
  if (
    combined.includes("BURSAR") ||
    combined.includes("ACCOUNTANT") ||
    combined.includes("CASHIER") ||
    combined.includes("FINANCE")
  ) {
    return "FINANCIAL";
  }

  // 6. Academic Faculty / Teaching Staff
  // e.g. Class Teacher, Subject Teacher, Form Teacher, Professor, Lecturer, Caregiver, Educator, Teacher
  if (
    combined.includes("TEACHER") ||
    combined.includes("PROFESSOR") ||
    combined.includes("LECTURER") ||
    combined.includes("CAREGIVER") ||
    combined.includes("EDUCATOR") ||
    combined.includes("INSTRUCTOR") ||
    combined.includes("READER") ||
    combined.includes("GRADUATE ASSISTANT")
  ) {
    return "ACADEMIC_FACULTY";
  }

  // 7. Support & Operations Roles
  // e.g. Vice Principal (Admin), Admin Officer, Secretary, Guidance Counsellor, Librarian, Nurse, Lab Attendant
  if (
    combined.includes("ADMINISTRATIVE") ||
    combined.includes("ADMIN OFFICER") ||
    combined.includes("SECRETARY") ||
    combined.includes("COUNSELLOR") ||
    combined.includes("LIBRARIAN") ||
    combined.includes("NURSE") ||
    combined.includes("LAB") ||
    combined.includes("STORE") ||
    combined.includes("CLEANER") ||
    combined.includes("NANNY")
  ) {
    return "OPERATIONS_SUPPORT";
  }

  // Generic STAFF fallback
  if (combined.includes("STAFF")) {
    return "OPERATIONS_SUPPORT";
  }

  return "GUEST";
}

export function isSuperAdmin(role?: string | null, staffRole?: string | null): boolean {
  return classifyRole(role, staffRole) === "SUPER_ADMIN";
}

export function isAdminExecutive(role?: string | null, staffRole?: string | null): boolean {
  const cat = classifyRole(role, staffRole);
  return cat === "SUPER_ADMIN" || cat === "ADMIN_EXECUTIVE";
}

export function isFinanceRole(role?: string | null, staffRole?: string | null): boolean {
  const cat = classifyRole(role, staffRole);
  return cat === "FINANCIAL" || cat === "SUPER_ADMIN" || cat === "ADMIN_EXECUTIVE";
}

export function isAcademicRole(role?: string | null, staffRole?: string | null): boolean {
  const cat = classifyRole(role, staffRole);
  return (
    cat === "ACADEMIC_FACULTY" ||
    cat === "ACADEMIC_ADMIN" ||
    cat === "ADMIN_EXECUTIVE" ||
    cat === "SUPER_ADMIN"
  );
}

export interface RouteAuthResult {
  allowed: boolean;
  reason?: string;
  category: RoleCategory;
  effectiveRoleName: string;
}

/**
 * Evaluates whether the given role is authorized to access a given URL path.
 */
export function checkRouteAuthorization(
  pathname: string,
  role?: string | null,
  staffRole?: string | null
): RouteAuthResult {
  const category = classifyRole(role, staffRole);
  const effectiveRoleName = staffRole || role || "Guest";

  // Master Global Admin Route Isolation:
  // Strictly reserved for platform super-admin on the platform apex console (/admin or /super-admin).
  // Note: Local tenant school workspaces (e.g., /[schoolDomain]/(admin) or /dashboard) must NOT be blocked.
  const isGlobalConsolePath =
    (pathname === "/admin" ||
     pathname.startsWith("/admin/") ||
     pathname === "/super-admin" ||
     pathname.startsWith("/super-admin/")) &&
    !pathname.includes("/dashboard") &&
    !pathname.includes("/portal-settings") &&
    !pathname.includes("/finance") &&
    !pathname.includes("/students") &&
    !pathname.includes("/staff") &&
    !pathname.includes("/admissions");

  if (isGlobalConsolePath) {
    if (category === "SUPER_ADMIN") {
      return { allowed: true, category, effectiveRoleName };
    }
    return {
      allowed: false,
      reason: "Access Denied: The Master SaaS Admin console is strictly reserved for Platform Super-Administrators.",
      category,
      effectiveRoleName,
    };
  }

  // Students trying to access administrative modules
  if (category === "STUDENT") {
    return {
      allowed: false,
      reason: "Access Denied: Students are not permitted to access administrative workspaces.",
      category,
      effectiveRoleName,
    };
  }

  // Super Admin and Tenant Administrative Executives (Tenant Admin, School Owner, Principal, etc.)
  // have full unrestricted access to all local tenant school workspaces and dashboard modules.
  if (category === "SUPER_ADMIN" || category === "ADMIN_EXECUTIVE") {
    return { allowed: true, category, effectiveRoleName };
  }

  // Dedicated Bursar Portal
  if (pathname === "/bursar" || pathname.startsWith("/bursar/")) {
    if (category === "FINANCIAL") {
      return { allowed: true, category, effectiveRoleName };
    }
    return {
      allowed: false,
      reason: `Access Denied: The Bursar Portal is strictly restricted to School Bursars, Accountants, and Executive Leadership. (${effectiveRoleName})`,
      category,
      effectiveRoleName,
    };
  }

  // 1. Finance & Ledgers
  if (pathname.includes("/finance")) {
    if (category === "FINANCIAL") {
      return { allowed: true, category, effectiveRoleName };
    }
    return {
      allowed: false,
      reason: `Access Denied: Financial ledgers, fee structures, and transaction audits are strictly restricted to the School Bursar, Accountants, and Executive Leadership. (${effectiveRoleName})`,
      category,
      effectiveRoleName,
    };
  }

  // 2. Management & Payroll (HR)
  if (pathname.includes("/hr")) {
    // Only Executive Admin has access to confidential staff payroll
    return {
      allowed: false,
      reason: `Access Denied: Human Resources, staff records, and payroll processing are restricted to Executive Leadership. (${effectiveRoleName})`,
      category,
      effectiveRoleName,
    };
  }

  // 3. Public Portal Settings & Bank Configuration
  if (pathname.includes("/settings/bank")) {
    if (category === "FINANCIAL") {
      return { allowed: true, category, effectiveRoleName };
    }
    return {
      allowed: false,
      reason: `Access Denied: Institutional bank account configuration is reserved for the School Bursar and Executive Administration. (${effectiveRoleName})`,
      category,
      effectiveRoleName,
    };
  }

  if (pathname.includes("/portal-settings")) {
    return {
      allowed: false,
      reason: `Access Denied: Public portal branding and tenant domain configuration are reserved for School Administrators. (${effectiveRoleName})`,
      category,
      effectiveRoleName,
    };
  }

  // 4. Staff Management Roster
  if (pathname.includes("/staff")) {
    if (category === "ACADEMIC_ADMIN") {
      return { allowed: true, category, effectiveRoleName };
    }
    return {
      allowed: false,
      reason: `Access Denied: Staff directory management and personnel administration are restricted to Department Leadership and Executive Administration. (${effectiveRoleName})`,
      category,
      effectiveRoleName,
    };
  }

  // 5. Academic Assessments, Exams, Report Cards, Transcripts
  if (
    pathname.includes("/exams") ||
    pathname.includes("/report-cards") ||
    pathname.includes("/transcripts")
  ) {
    if (category === "ACADEMIC_FACULTY" || category === "ACADEMIC_ADMIN") {
      return { allowed: true, category, effectiveRoleName };
    }
    if (category === "FINANCIAL") {
      return {
        allowed: false,
        reason: `Access Denied: Financial officers and Bursars are strictly prohibited from modifying assessment schedules, grading rosters, or academic transcripts. (${effectiveRoleName})`,
        category,
        effectiveRoleName,
      };
    }
    return {
      allowed: false,
      reason: `Access Denied: Academic assessments, grading rosters, and student transcripts are restricted to Teaching Faculty and Academic Administration. (${effectiveRoleName})`,
      category,
      effectiveRoleName,
    };
  }

  // 6. Timetable & Academic Scheduling
  if (pathname.includes("/scheduling")) {
    if (category === "ACADEMIC_FACULTY" || category === "ACADEMIC_ADMIN") {
      return { allowed: true, category, effectiveRoleName };
    }
    return {
      allowed: false,
      reason: `Access Denied: Timetable and academic scheduling is restricted to Teaching Faculty and Academic Administration. (${effectiveRoleName})`,
      category,
      effectiveRoleName,
    };
  }

  // 7. Enrollment & Admissions
  if (pathname.includes("/admissions")) {
    // Financial officers need admissions to verify fee payments; Academic Admins need it for applicant enrollment
    if (category === "FINANCIAL" || category === "ACADEMIC_ADMIN") {
      return { allowed: true, category, effectiveRoleName };
    }
    return {
      allowed: false,
      reason: `Access Denied: Admissions processing and applicant enrollment are restricted to Admissions Officers, Bursars, and Executive Leadership. (${effectiveRoleName})`,
      category,
      effectiveRoleName,
    };
  }

  // 8. Student Directory
  if (pathname.includes("/students")) {
    // Accessible by faculty, financial officers (fees info), academic admins, and support
    return { allowed: true, category, effectiveRoleName };
  }

  // 9. General Dashboard and Communications
  if (pathname.includes("/dashboard") || pathname.includes("/communications")) {
    return { allowed: true, category, effectiveRoleName };
  }

  // Default: Allow authenticated staff
  return { allowed: true, category, effectiveRoleName };
}

/**
 * Resolves local development mock role configuration from NEXT_PUBLIC_DEV_MOCK_ROLE.
 * Returns normalized { role, staffRole } or null if dev mode mocking is inactive.
 */
export function getDevMockRoleConfig(input?: string | null): { role: string; staffRole: string } | null {
  const raw = (input || process.env.NEXT_PUBLIC_DEV_MOCK_ROLE || "").trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (upper === "SUPER_ADMIN") {
    return { role: "SUPER_ADMIN", staffRole: "Platform Super-Admin" };
  }
  if (upper === "STUDENT") {
    return { role: "STUDENT", staffRole: "Student" };
  }
  if (
    upper.includes("PRINCIPAL") ||
    upper.includes("HEADMASTER") ||
    upper.includes("HEADMISTRESS") ||
    upper.includes("HEAD TEACHER") ||
    upper.includes("PROPRIETOR") ||
    upper.includes("VICE CHANCELLOR") ||
    upper.includes("RECTOR") ||
    upper.includes("PROVOST") ||
    upper.includes("REGISTRAR") ||
    upper.includes("ADMIN")
  ) {
    return { role: "SCHOOL_ADMIN", staffRole: raw };
  }

  // Any other Nigerian role (Bursar, Class Teacher, Subject Teacher, Professor, Lecturer, etc.)
  return { role: "STAFF", staffRole: raw };
}

