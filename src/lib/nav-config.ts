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
  UserPlus,
  Sparkles,
  User,
  Award,
  CheckSquare,
  Receipt,
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
            matchPaths: ["/report-cards", "/transcripts", "/assessments", "/results"],
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
          },
          {
            id: "admissions",
            label: "Admissions Pipeline",
            href: (domain) => `/${domain}/admissions`,
            icon: UserPlus,
            matchPaths: ["/admissions", "/admin/admissions", "/settings/admissions"],
          },
          {
            id: "entrance-exam-schedules",
            label: "Entrance Exam Schedules",
            href: (domain) => `/${domain}/admissions?tab=exams`,
            icon: Calendar,
            matchPaths: ["/admissions?tab=exams"],
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
            href: (domain) => `/${domain}/finance/receipts`,
            icon: FileCheck2,
            matchPaths: ["/finance/verifications", "/finance/receipts", "/dashboard/finance/receipts"],
          },
          {
            id: "payment-settings-tenant",
            label: "Payment Settings",
            href: (domain) => `/${domain}/settings/payments`,
            icon: Settings,
            badge: "NEW",
            matchPaths: ["/settings/payments", "/dashboard/settings/payments"],
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
            id: "subscription-billing",
            label: "Subscription & Billing",
            href: () => `/dashboard/subscription`,
            icon: CreditCard,
            matchPaths: ["/dashboard/subscription", "/subscription", "/settings/billing"],
          },
          {
            id: "system-payment-settings",
            label: "Payment Settings",
            href: (domain) => `/${domain}/settings/payments`,
            icon: Settings,
            badge: "NEW",
            matchPaths: ["/settings/payments", "/dashboard/settings/payments"],
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

  // 1. HIGHER INSTITUTIONS / TERTIARY FACULTY TIER (University, Polytechnic, COE)
  if (
    normalized.includes("LECTURER") ||
    normalized.includes("PROFESSOR") ||
    normalized.includes("READER") ||
    normalized.includes("DEAN") ||
    normalized.includes("HOD") ||
    normalized.includes("TERTIARY") ||
    normalized.includes("FACULTY")
  ) {
    return [
      {
        id: "academic-faculty-engine",
        title: "ACADEMIC & FACULTY ENGINE",
        items: [
          {
            id: "tertiary-course-outline",
            label: "Course Outline Manager",
            href: (d) => `/${d}/portal/staff?tab=lessons`,
            icon: BookOpen,
          },
          {
            id: "tertiary-lecture-timetables",
            label: "Lecture Timetables",
            href: (d) => `/${d}/portal/staff?tab=schedule`,
            icon: Calendar,
          },
          {
            id: "tertiary-student-registrations",
            label: "Semester Student Registrations",
            href: (d) => `/${d}/portal/staff?tab=rosters`,
            icon: Users,
          },
          {
            id: "tertiary-grading-bookmarks",
            label: "Examination Grading Bookmarks",
            href: (d) => `/${d}/portal/staff?tab=gradebook`,
            icon: Award,
          },
        ],
      },
      {
        id: "research-institution",
        title: "RESEARCH & INSTITUTION",
        items: [
          {
            id: "tertiary-departmental-circulars",
            label: "Departmental Circulars",
            href: (d) => `/${d}/portal/staff?tab=circulars`,
            icon: MessageSquare,
          },
          {
            id: "tertiary-research-trackers",
            label: "Research / Grant Trackers",
            href: (d) => `/${d}/portal/staff?tab=research`,
            icon: Sparkles,
          },
          {
            id: "tertiary-leave-portals",
            label: "Staff Leave Portals",
            href: (d) => `/${d}/portal/staff?tab=leaves`,
            icon: Clock,
          },
          {
            id: "tertiary-profile-settings",
            label: "My Profile Settings",
            href: (d) => `/${d}/portal/staff?tab=profile`,
            icon: User,
          },
        ],
      },
    ];
  }

  // 2. CRECHE / CRECHE TIER (Early Childhood Care & Education)
  if (
    normalized.includes("CAREGIVER") ||
    normalized.includes("CRECHE") ||
    normalized.includes("NURSERY") ||
    normalized.includes("EARLY YEARS") ||
    normalized.includes("NANNY") ||
    normalized.includes("CRECHE") ||
    normalized.includes("PLAYGROUP") ||
    normalized.includes("KINDERGARTEN")
  ) {
    return [
      {
        id: "early-academics-care",
        title: "EARLY ACADEMICS & CARE",
        items: [
          {
            id: "creche-rosters",
            label: "Classroom Rosters (Infant Lists)",
            href: (d) => `/${d}/portal/staff?tab=rosters`,
            icon: Users,
          },
          {
            id: "creche-activity-logs",
            label: "Daily Activity logs (Feeding/Nap schedules)",
            href: (d) => `/${d}/portal/staff?tab=schedule`,
            icon: Calendar,
          },
          {
            id: "creche-growth-trackers",
            label: "Child Growth Trackers (Milestones)",
            href: (d) => `/${d}/portal/staff?tab=gradebook`,
            icon: Award,
          },
          {
            id: "creche-health-vitals",
            label: "Immunization & Health Vitals",
            href: (d) => `/${d}/portal/staff?tab=lessons`,
            icon: BookOpen,
          },
        ],
      },
      {
        id: "guardian-engine",
        title: "GUARDIAN ENGINE",
        items: [
          {
            id: "creche-circulars",
            label: "Parent Circulars/Memos",
            href: (d) => `/${d}/portal/staff?tab=circulars`,
            icon: MessageSquare,
          },
          {
            id: "creche-dropoff-logs",
            label: "Drop-off/Pick-up Logs",
            href: (d) => `/${d}/portal/staff?tab=attendance`,
            icon: Clock,
          },
          {
            id: "creche-leave-portals",
            label: "Staff Leave Portals",
            href: (d) => `/${d}/portal/staff?tab=leaves`,
            icon: Briefcase,
          },
          {
            id: "creche-profile-settings",
            label: "My Profile Settings",
            href: (d) => `/${d}/portal/staff?tab=profile`,
            icon: User,
          },
        ],
      },
    ];
  }

  // 3. TEACHER TIER (Primary & Secondary K-12)
  if (
    normalized.includes("TEACHER") ||
    normalized.includes("INSTRUCTOR")
  ) {
    return [
      {
        id: "academic-engine",
        title: "ACADEMIC ENGINE",
        items: [
          {
            id: "teacher-overview",
            label: "Dashboard Overview",
            href: (d) => `/${d}/portal/staff`,
            icon: LayoutDashboard,
          },
          {
            id: "teacher-rosters",
            label: "Classroom Rosters",
            href: (d) => `/${d}/portal/staff?tab=rosters`,
            icon: Users,
          },
          {
            id: "teacher-attendance",
            label: "Daily Attendance",
            href: (d) => `/${d}/portal/staff?tab=attendance`,
            icon: CheckSquare,
          },
          {
            id: "teacher-gradebook",
            label: "Gradebook & Assessments",
            href: (d) => `/${d}/portal/staff?tab=gradebook`,
            icon: Award,
          },
          {
            id: "teacher-schedule",
            label: "Teaching Schedule",
            href: (d) => `/${d}/portal/staff?tab=schedule`,
            icon: Calendar,
          },
          {
            id: "teacher-lessons",
            label: "Lesson Notes & Schemes",
            href: (d) => `/${d}/portal/staff?tab=lessons`,
            icon: BookOpen,
          },
        ],
      },
      {
        id: "personnel-account",
        title: "PERSONNEL & ACCOUNT",
        items: [
          {
            id: "teacher-leaves",
            label: "Staff Leave Requests",
            href: (d) => `/${d}/portal/staff?tab=leaves`,
            icon: Clock,
          },
          {
            id: "teacher-payslips",
            label: "My Remuneration & Payslips",
            href: (d) => `/${d}/portal/staff?tab=payslips`,
            icon: Receipt,
          },
          {
            id: "teacher-profile-settings",
            label: "My Profile Settings",
            href: (d) => `/${d}/portal/staff?tab=profile`,
            icon: User,
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
            href: (d) => `/${d}/finance/receipts`,
            icon: FileCheck2,
            matchPaths: ["/finance/verifications", "/finance/receipts", "/dashboard/finance/receipts"],
          },
          {
            id: "bursar-payment-settings",
            label: "Payment Settings",
            href: (d) => `/${d}/settings/payments`,
            icon: Settings,
            badge: "NEW",
            matchPaths: ["/settings/payments", "/dashboard/settings/payments"],
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

  // 3. REGISTRAR & ADMISSIONS OFFICER TIER
  // Strictly restricted from institutional bank modules & payment settings.
  // Granted authority over admissions, student enrollment, and entrance examination schedules.
  if (
    normalized.includes("REGISTRAR") ||
    normalized.includes("ADMISSION")
  ) {
    return [
      {
        id: "admissions-engine",
        title: "ADMISSIONS & ENTRANCE EXAMINATION",
        items: [
          {
            id: "admissions-pipeline",
            label: "Admissions Pipeline",
            href: (d) => `/${d}/admissions`,
            icon: UserPlus,
            matchPaths: ["/admissions", "/admin/admissions"],
          },
          {
            id: "entrance-exam-schedules",
            label: "Entrance Examination Schedules",
            href: (d) => `/${d}/admissions?tab=exams`,
            icon: Calendar,
            badge: "EXAM",
            matchPaths: ["/admissions?tab=exams"],
          },
          {
            id: "admissions-register-table",
            label: "Admissions Register Table",
            href: (d) => `/${d}/admissions?tab=register`,
            icon: FileSpreadsheet,
            matchPaths: ["/admissions?tab=register"],
          },
          {
            id: "students-enrollment-roster",
            label: "Students Roster & Enrollment",
            href: (d) => `/${d}/students`,
            icon: Users,
          },
        ],
      },
      {
        id: "academic-records",
        title: "ACADEMICS & EXAMINATIONS",
        items: [
          {
            id: "classes-sections",
            label: "Classes & Sections",
            href: (d) => `/${d}/classes`,
            icon: Building2,
          },
          {
            id: "assessments-results",
            label: "Assessments, Records & Results",
            href: (d) => `/${d}/exams`,
            icon: Award,
          },
          {
            id: "communications-desk",
            label: "Communications Desk",
            href: (d) => `/${d}/communications`,
            icon: MessageSquare,
          },
        ],
      },
    ];
  }

  // 4. PARENT TIER
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
