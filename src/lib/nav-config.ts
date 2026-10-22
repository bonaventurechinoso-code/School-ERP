import { ComponentType } from "react";
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Calendar,
  GraduationCap,
  Users,
  UserCheck,
  Briefcase,
  CreditCard,
  FileCheck2,
  Landmark,
  Coins,
  MessageSquare,
  Settings,
  FileSpreadsheet,
  Clock,
} from "lucide-react";

export interface NavChildItem {
  id: string;
  label: string;
  href: (domain: string) => string;
  icon?: ComponentType<{ className?: string }>;
  exact?: boolean;
  matchPaths?: string[];
  badge?: string;
}

export interface NavItemConfig {
  id: string;
  label: string;
  href: (domain: string) => string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  exact?: boolean;
  children?: NavChildItem[];
  allowedRoles?: string[];
  matchPaths?: string[];
}

export interface NavGroupConfig {
  id: string;
  title?: string;
  items: NavItemConfig[];
}

/**
 * MASTER TENANT ACCORDION NAVIGATION ARCHITECTURE
 * 4 Distinct, Elegant Parent Accordion Folders:
 * - 📂 Academic Engine
 *   * Dashboard Overview
 *   * Classes & Sections
 *   * Subjects & Timetables
 *   * Attendance Tracking
 *   * Assessments, Records & Results
 * - 📂 People Management
 *   * Students Roster & Enrollment
 *   * Parents Directory
 *   * Staff Directory & Attendance / Leave
 * - 📂 Finance Hub
 *   * Fees Management
 *   * Payment Verifications
 *   * Bank Account Configurations
 *   * Bursar Workspace & Payroll
 * - 📂 System Administration
 *   * Communications Desk
 *   * Public Portal Settings
 */
export const TENANT_NAV_GROUPS: NavGroupConfig[] = [
  {
    id: "main-accordions",
    items: [
      // 1. 📂 Academic Engine
      {
        id: "academic-engine",
        label: "Academic Engine",
        href: (domain) => `/${domain}/dashboard`,
        icon: GraduationCap,
        children: [
          {
            id: "dashboard-overview",
            label: "Dashboard Overview",
            href: (domain) => `/${domain}/dashboard`,
            icon: LayoutDashboard,
            exact: true,
          },
          {
            id: "classes-sections",
            label: "Classes & Sections",
            href: (domain) => `/${domain}/classes`,
            icon: Building2,
          },
          {
            id: "subjects-timetables",
            label: "Subjects & Timetables",
            href: (domain) => `/${domain}/subjects`,
            icon: BookOpen,
            matchPaths: ["/timetable", "/scheduling?tab=timetable"],
          },
          {
            id: "attendance-tracking",
            label: "Attendance Tracking",
            href: (domain) => `/${domain}/scheduling?tab=attendance`,
            icon: Calendar,
          },
          {
            id: "assessments-records-results",
            label: "Assessments, Records & Results",
            href: (domain) => `/${domain}/exams`,
            icon: FileSpreadsheet,
            matchPaths: ["/report-cards", "/transcripts", "/assessments"],
          },
        ],
      },

      // 2. 📂 People Management
      {
        id: "people-management",
        label: "People Management",
        href: (domain) => `/${domain}/students`,
        icon: Users,
        children: [
          {
            id: "students-enrollment",
            label: "Students Roster & Enrollment",
            href: (domain) => `/${domain}/students`,
            icon: Users,
            matchPaths: ["/admissions"],
          },
          {
            id: "parents-directory",
            label: "Parents Directory",
            href: (domain) => `/${domain}/parents`,
            icon: UserCheck,
          },
          {
            id: "staff-directory-attendance",
            label: "Staff Directory & Attendance / Leave",
            href: (domain) => `/${domain}/staff`,
            icon: Briefcase,
            matchPaths: ["/hr"],
          },
        ],
      },

      // 3. 📂 Finance Hub
      {
        id: "finance-hub",
        label: "Finance Hub",
        href: (domain) => `/${domain}/finance/fees`,
        icon: Landmark,
        children: [
          {
            id: "fees-management",
            label: "Fees Management",
            href: (domain) => `/${domain}/finance/fees`,
            icon: CreditCard,
          },
          {
            id: "payment-verifications",
            label: "Payment Verifications",
            href: (domain) => `/${domain}/finance/verifications`,
            icon: FileCheck2,
          },
          {
            id: "bank-account-configs",
            label: "Bank Account Configurations",
            href: (domain) => `/${domain}/finance/bank-account`,
            icon: Landmark,
          },
          {
            id: "bursar-workspace-payroll",
            label: "Bursar Workspace & Payroll",
            href: (domain) => `/${domain}/finance/bursar-workspace`,
            icon: Coins,
            matchPaths: ["/hr"],
          },
        ],
      },

      // 4. 📂 System Administration
      {
        id: "system-admin",
        label: "System Administration",
        href: (domain) => `/${domain}/communications`,
        icon: Settings,
        children: [
          {
            id: "communications-desk",
            label: "Communications Desk",
            href: (domain) => `/${domain}/communications`,
            icon: MessageSquare,
          },
          {
            id: "public-portal-settings",
            label: "Public Portal Settings",
            href: (domain) => `/${domain}/portal-settings`,
            icon: Settings,
          },
        ],
      },
    ],
  },
];

/**
 * Filtered Navigation by RBAC Role Tiers
 * - Teacher: My Classes, My Students, Attendance, Assessments, Results
 * - Bursar: Fees, Payment Verifications, Bank Account, Workspace
 * - Parent/Student: My Children, Fees, Results, Communications
 * - Tenant Admin / Super Admin (View as Tenant): Master 4-accordion structure
 */
export function getTenantNavigation(
  role?: string | null,
  staffRole?: string | null,
  schoolDomain: string = "egede"
): NavGroupConfig[] {
  const normalized = `${role || ""} ${staffRole || ""}`.trim().toUpperCase();

  // 1. TEACHER TIER
  if (
    normalized.includes("TEACHER") ||
    normalized.includes("INSTRUCTOR") ||
    normalized.includes("LECTURER")
  ) {
    return [
      {
        id: "teacher-nav",
        items: [
          {
            id: "teacher-classes",
            label: "My Classes",
            href: (d) => `/${d}/portal/staff`,
            icon: LayoutDashboard,
          },
          {
            id: "teacher-students",
            label: "My Students",
            href: (d) => `/${d}/portal/staff?tab=rosters`,
            icon: Users,
          },
          {
            id: "teacher-attendance",
            label: "Attendance",
            href: (d) => `/${d}/scheduling?tab=attendance`,
            icon: Calendar,
          },
          {
            id: "teacher-assessments",
            label: "Assessments",
            href: (d) => `/${d}/exams`,
            icon: GraduationCap,
          },
          {
            id: "teacher-results",
            label: "Results",
            href: (d) => `/${d}/report-cards`,
            icon: FileSpreadsheet,
          },
        ],
      },
    ];
  }

  // 2. BURSAR TIER
  if (
    normalized.includes("BURSAR") ||
    normalized.includes("ACCOUNTANT") ||
    normalized.includes("CASHIER")
  ) {
    return [
      {
        id: "bursar-nav",
        items: [
          {
            id: "bursar-fees",
            label: "Fees",
            href: (d) => `/${d}/finance/fees`,
            icon: CreditCard,
          },
          {
            id: "bursar-verifications",
            label: "Payment Verifications",
            href: (d) => `/${d}/finance/verifications`,
            icon: FileCheck2,
          },
          {
            id: "bursar-bank",
            label: "Bank Account",
            href: (d) => `/${d}/finance/bank-account`,
            icon: Landmark,
          },
          {
            id: "bursar-workspace",
            label: "Bursar Workspace",
            href: (d) => `/${d}/finance/bursar-workspace`,
            icon: Coins,
          },
        ],
      },
    ];
  }

  // 3. PARENT TIER
  if (normalized.includes("PARENT") || normalized.includes("GUARDIAN")) {
    return [
      {
        id: "parent-nav",
        items: [
          {
            id: "parent-children",
            label: "My Children",
            href: (d) => `/${d}/parents`,
            icon: Users,
          },
          {
            id: "parent-fees",
            label: "Fees",
            href: (d) => `/${d}/finance/fees`,
            icon: CreditCard,
          },
          {
            id: "parent-results",
            label: "Results",
            href: (d) => `/${d}/report-cards`,
            icon: FileSpreadsheet,
          },
          {
            id: "parent-communications",
            label: "Communications",
            href: (d) => `/${d}/communications`,
            icon: MessageSquare,
          },
        ],
      },
    ];
  }

  // 4. STUDENT TIER
  if (normalized.includes("STUDENT")) {
    return [
      {
        id: "student-nav",
        items: [
          {
            id: "student-results",
            label: "Results",
            href: (d) => `/${d}/report-cards`,
            icon: FileSpreadsheet,
          },
          {
            id: "student-timetable",
            label: "Timetable",
            href: (d) => `/${d}/scheduling?tab=timetable`,
            icon: Clock,
          },
          {
            id: "student-records",
            label: "Academic Records",
            href: (d) => `/${d}/transcripts`,
            icon: BookOpen,
          },
        ],
      },
    ];
  }

  // 5. MASTER TENANT ADMIN / SUPER ADMIN (VIEW AS TENANT)
  return TENANT_NAV_GROUPS;
}
