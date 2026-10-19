import { ComponentType } from "react";
import {
  Home,
  Users,
  UserPlus,
  Briefcase,
  UserCheck,
  Calendar,
  GraduationCap,
  FileSpreadsheet,
  BookOpen,
  CreditCard,
  FileCheck2,
  Landmark,
  Coins,
  Building2,
  MessageSquare,
  Settings,
  LayoutDashboard,
  Clock,
} from "lucide-react";

export interface NavChildItem {
  id: string;
  label: string;
  href: (domain: string) => string;
  icon?: ComponentType<{ className?: string }>;
  exact?: boolean;
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
}

export interface NavGroupConfig {
  id: string;
  title?: string; // Group title: "DASHBOARD", "PEOPLE", "ACADEMIC", "FINANCE", "SYSTEM"
  items: NavItemConfig[];
}

/**
 * MASTER TENANT NAVIGATION CONFIGURATION
 * Single source of truth driving both Desktop and Mobile sidebars.
 *
 * Exact hierarchy:
 * - DASHBOARD: Dashboard
 * - PEOPLE: Students, Parents, Staff (collapsible Staff module: Staff Directory, Attendance & Leave)
 * - ACADEMIC: Classes & Sections, Subjects, Attendance, Assessments, Academic Records, Results, Timetable
 * - FINANCE: Fees, Payment Verifications, Bank Account, Bursar Workspace, Management & Payroll
 * - SYSTEM: Communications, Enrollment, Public Portal Settings
 */
export const TENANT_NAV_GROUPS: NavGroupConfig[] = [
  // DASHBOARD
  {
    id: "dashboard-group",
    title: "DASHBOARD",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: (domain) => `/${domain}/dashboard`,
        icon: Home,
        exact: true,
      },
    ],
  },

  // PEOPLE
  {
    id: "people",
    title: "PEOPLE",
    items: [
      {
        id: "students",
        label: "Students",
        href: (domain) => `/${domain}/students`,
        icon: Users,
      },
      {
        id: "parents",
        label: "Parents",
        href: (domain) => `/${domain}/parents`,
        icon: Users,
      },
      {
        id: "staff-group",
        label: "Staff",
        href: (domain) => `/${domain}/staff`,
        icon: Briefcase,
        children: [
          {
            id: "staff-directory",
            label: "Staff Directory",
            href: (domain) => `/${domain}/staff`,
            icon: Users,
            exact: true,
          },
          {
            id: "staff-attendance",
            label: "Attendance & Leave",
            href: (domain) => `/${domain}/staff?tab=attendance`,
            icon: Calendar,
          },
        ],
      },
    ],
  },

  // ACADEMIC
  {
    id: "academic",
    title: "ACADEMIC",
    items: [
      {
        id: "classes-sections",
        label: "Classes & Sections",
        href: (domain) => `/${domain}/classes`,
        icon: Building2,
      },
      {
        id: "subjects",
        label: "Subjects",
        href: (domain) => `/${domain}/subjects`,
        icon: BookOpen,
      },
      {
        id: "attendance",
        label: "Attendance",
        href: (domain) => `/${domain}/scheduling?tab=attendance`,
        icon: Calendar,
      },
      {
        id: "assessments",
        label: "Assessments",
        href: (domain) => `/${domain}/exams`,
        icon: GraduationCap,
      },
      {
        id: "academic-records",
        label: "Academic Records",
        href: (domain) => `/${domain}/transcripts`,
        icon: BookOpen,
      },
      {
        id: "results",
        label: "Results",
        href: (domain) => `/${domain}/report-cards`,
        icon: FileSpreadsheet,
      },
      {
        id: "timetable",
        label: "Timetable",
        href: (domain) => `/${domain}/scheduling?tab=timetable`,
        icon: Clock,
      },
    ],
  },

  // FINANCE
  {
    id: "finance",
    title: "FINANCE",
    items: [
      {
        id: "fees",
        label: "Fees",
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
        id: "bank-account",
        label: "Bank Account",
        href: (domain) => `/${domain}/finance/bank-account`,
        icon: Landmark,
      },
      {
        id: "bursar-workspace",
        label: "Bursar Workspace",
        href: (domain) => `/${domain}/finance/bursar-workspace`,
        icon: Coins,
      },
      {
        id: "management-payroll",
        label: "Management & Payroll",
        href: (domain) => `/${domain}/hr`,
        icon: Building2,
      },
    ],
  },

  // SYSTEM
  {
    id: "system",
    title: "SYSTEM",
    items: [
      {
        id: "communications",
        label: "Communications",
        href: (domain) => `/${domain}/communications`,
        icon: MessageSquare,
      },
      {
        id: "enrollment",
        label: "Enrollment",
        href: (domain) => `/${domain}/admissions`,
        icon: UserPlus,
      },
      {
        id: "public-portal-settings",
        label: "Public Portal Settings",
        href: (domain) => `/${domain}/portal-settings`,
        icon: Settings,
      },
    ],
  },
];

/**
 * Filtered Navigation by RBAC Role Tiers
 * - Teacher: My Classes, My Students, Attendance, Assessments, Results
 * - Bursar: Fees, Payment Verifications, Bank Account
 * - Parent/Student: My Children, Fees, Results, Communications
 * - Tenant Admin / Super Admin (View as Tenant): Master 5-group structure
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
            href: (d) => `/teacher/my-class`,
            icon: LayoutDashboard,
          },
          {
            id: "teacher-students",
            label: "My Students",
            href: (d) => `/teacher/students`,
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
