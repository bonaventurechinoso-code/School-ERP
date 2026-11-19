export type PlanTier = "Free" | "Basic" | "Premium" | "Enterprise";
export type SubscriptionStatus = "Active" | "Pending Verification" | "Suspended" | "Expired" | "Free Trial" | "TRIALING";

export interface SchoolTenant {
  id: string;
  name: string;
  code: string;
  subdomain: string;
  tier: PlanTier;
  studentsCount: number;
  planStatus: "Active" | "Trial" | "Expired" | "Suspended";
  subscriptionStatus: SubscriptionStatus;
  monthlyRevenue: number;
  contactEmail: string;
  contactPhone: string;
  joinedDate: string;
  adminName: string;
  lastPaymentDate?: string;
  paymentProofUrl?: string;
  address?: string;
  lga?: string;
  state?: string;
  isDemo?: boolean;
  isTrial?: boolean;
  trialEndsAt?: string;
}

export interface BankTransferProof {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  amount: number;
  referenceId: string;
  bankName: string;
  uploadedAt: string;
  planRequested: PlanTier;
  depositorName: string;
  proofImageUrl: string;
  status: "Pending" | "Approved" | "Rejected";
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  details: string;
  category: "Security" | "Tenant" | "Financial" | "System";
  ipAddress: string;
  severity: "info" | "warning" | "success" | "critical";
}

export interface PricingPlan {
  id: PlanTier;
  name: string;
  tagline: string;
  pricePerTerm: number;
  priceDisplay: string;
  badge?: string;
  popular?: boolean;
  maxStudents: string;
  features: string[];
}

// --- MOCK DATA ---
export const INITIAL_SCHOOLS: SchoolTenant[] = [];

export const INITIAL_PROOFS: BankTransferProof[] = [
  {
    id: "proof-1",
    schoolId: "sch-3",
    schoolName: "Royal Crown School",
    schoolCode: "RCS003",
    amount: 150000,
    referenceId: "TRX-8841029",
    bankName: "Zenith Bank PLC",
    uploadedAt: "Oct 11, 2026 • 14:22",
    planRequested: "Premium",
    depositorName: "Pastor Emeka Okonkwo",
    proofImageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
    status: "Pending",
  },
  {
    id: "proof-2",
    schoolId: "sch-8",
    schoolName: "Crescent Heights Academy",
    schoolCode: "CHS008",
    amount: 150000,
    referenceId: "TRX-9923014",
    bankName: "Guaranty Trust Bank (GTBank)",
    uploadedAt: "Oct 12, 2026 • 09:40",
    planRequested: "Premium",
    depositorName: "Crescent Educational Services",
    proofImageUrl: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80",
    status: "Pending",
  },
  {
    id: "proof-3",
    schoolId: "sch-9",
    schoolName: "St. Saviour Academy",
    schoolCode: "SSA009",
    amount: 350000,
    referenceId: "TRX-5519802",
    bankName: "Access Bank PLC",
    uploadedAt: "Oct 10, 2026 • 18:15",
    planRequested: "Enterprise",
    depositorName: "St Saviour Board of Trustees",
    proofImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80",
    status: "Pending",
  },
];

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "Free",
    name: "Free Trial Tier",
    tagline: "14-Day Pilot / Single Term Trial for evaluation",
    pricePerTerm: 0,
    priceDisplay: "₦0",
    badge: "Evaluation",
    maxStudents: "Up to 100 Students",
    features: [
      "Up to 100 Students capacity",
      "Basic Gradebook & Daily Attendance",
      "Standard schoolerp.com Subdomain",
      "Admin & Teacher Login Portals",
      "Community Email Support",
    ],
  },
  {
    id: "Basic",
    name: "Basic Tier",
    tagline: "Essential ERP operations for small private schools",
    pricePerTerm: 75000,
    priceDisplay: "₦75,000 / term",
    maxStudents: "Up to 400 Students",
    features: [
      "Up to 400 Students capacity",
      "Student & Parent Dedicated Portals",
      "Automated PDF Report Card Generation",
      "Class Timetable & Staff Management",
      "Manual Bank Deposit Tracking",
      "Standard Priority Support",
    ],
  },
  {
    id: "Premium",
    name: "Premium Tier",
    tagline: "Complete financial and academic operating system",
    pricePerTerm: 150000,
    priceDisplay: "₦150,000 / term",
    badge: "Most Popular",
    popular: true,
    maxStudents: "Up to 1,000 Students",
    features: [
      "Up to 1,000 Students capacity",
      "Bursar Office & Comprehensive Fee Billing",
      "CBT Online Examination Engine",
      "Automated SMS & Web Push Notifications",
      "Library & Inventory Tracking",
      "Parent Fee Payment Reminders",
      "Dedicated WhatsApp Support Agent",
    ],
  },
  {
    id: "Enterprise",
    name: "Enterprise Tier",
    tagline: "Multi-campus control with custom domains & AI copilot",
    pricePerTerm: 350000,
    priceDisplay: "₦350,000 / term",
    badge: "Multi-Campus",
    maxStudents: "Unlimited Students",
    features: [
      "Unlimited Students & Multi-Branch Campuses",
      "Custom Domain SSL (e.g. portal.schoolname.edu.ng)",
      "Dedicated Account Manager & Phone SLA",
      "AI Academic Performance Copilot",
      "Custom Automated Grade Conversion (WAEC/NECO/IGCSE)",
      "Automated Database Snapshot Backups",
      "Biometric Attendance Device API Sync",
    ],
  },
];

export const AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "log-1",
    timestamp: "14 mins ago",
    actor: "Super Administrator (Root)",
    action: "Approved Bank Transfer Proof",
    target: "Royal Crown School (RCS003)",
    details: "Approved TRX-8841029 (₦150,000 via Zenith Bank). Upgraded tenant to Premium Tier.",
    category: "Financial",
    ipAddress: "102.89.34.12",
    severity: "success",
  },
  {
    id: "log-2",
    timestamp: "2 hours ago",
    actor: "Super Administrator (Root)",
    action: "Provisioned New Tenant Instance",
    target: "divinegrace.schoolerp.com",
    details: "Database schema provisioned for Divine Grace College on Enterprise Tier.",
    category: "Tenant",
    ipAddress: "102.89.34.12",
    severity: "info",
  },
  {
    id: "log-3",
    timestamp: "5 hours ago",
    actor: "System Guard / Security Policy",
    action: "Enforced Global Password Policy",
    target: "All Tenants",
    details: "Minimum length 8 + uppercase + numbers rule enforced across all 8 institutions.",
    category: "Security",
    ipAddress: "127.0.0.1 (Internal Daemon)",
    severity: "warning",
  },
  {
    id: "log-4",
    timestamp: "Yesterday • 18:30",
    actor: "Super Administrator (Root)",
    action: "Suspended Tenant Access",
    target: "St. Gregory Academy (SGA006)",
    details: "Account locked out due to expired term subscription over 90 days unpaid.",
    category: "Tenant",
    ipAddress: "197.210.55.84",
    severity: "critical",
  },
  {
    id: "log-5",
    timestamp: "Oct 10, 2026 • 11:15",
    actor: "Admin (bursar@crescentheights.edu.ng)",
    action: "Uploaded Bank Transfer Slip",
    target: "TRX-9923014",
    details: "₦150,000 GTBank proof uploaded for Term 1 Premium renewal.",
    category: "Financial",
    ipAddress: "105.112.44.20",
    severity: "info",
  },
  {
    id: "log-6",
    timestamp: "Oct 09, 2026 • 08:00",
    actor: "Automated Backup Daemon",
    action: "PostgreSQL Database Snapshot",
    target: "All Tenant Schemas",
    details: "Multi-tenant snapshot backup (8 institutions, 4,315 student records) completed in 4.2s.",
    category: "System",
    ipAddress: "Internal cron",
    severity: "success",
  },
];

// Helper to find a school by id, code, or subdomain
export function findSchool(idOrCode: string): SchoolTenant | undefined {
  if (!idOrCode) return undefined;
  const normalized = idOrCode.toLowerCase().trim();
  return INITIAL_SCHOOLS.find(
    (s) =>
      s.id.toLowerCase() === normalized ||
      s.code.toLowerCase() === normalized ||
      s.subdomain.toLowerCase() === normalized
  );
}

export function formatNaira(amount: number): string {
  return "₦" + amount.toLocaleString("en-NG");
}

// Global in-memory tenant store across API handlers
declare global {
  // eslint-disable-next-line no-var
  var __registeredTenantsStore: SchoolTenant[] | undefined;
}

export function getSchoolsStore(): SchoolTenant[] {
  if (typeof globalThis !== "undefined") {
    if (!globalThis.__registeredTenantsStore) {
      globalThis.__registeredTenantsStore = [...INITIAL_SCHOOLS];
    }
    return globalThis.__registeredTenantsStore;
  }
  return INITIAL_SCHOOLS;
}

export function registerTenantInStore(tenant: SchoolTenant): SchoolTenant {
  const store = getSchoolsStore();
  const existingIdx = store.findIndex((s) => s.id === tenant.id || s.subdomain === tenant.subdomain);
  if (existingIdx >= 0) {
    store[existingIdx] = { ...store[existingIdx], ...tenant };
    return store[existingIdx];
  } else {
    store.unshift(tenant);
    return tenant;
  }
}

export function removeTenantFromStore(idOrSubdomain: string): void {
  if (!idOrSubdomain) return;
  const norm = idOrSubdomain.toLowerCase().trim();
  if (typeof globalThis !== "undefined" && globalThis.__registeredTenantsStore) {
    globalThis.__registeredTenantsStore = globalThis.__registeredTenantsStore.filter(
      (s) => s.id.toLowerCase() !== norm && (s.subdomain || "").toLowerCase() !== norm
    );
  }
}

export function getTrialDaysLeft(trialEndsAt?: string): string {
  if (!trialEndsAt) return "14d left";
  const diffMs = new Date(trialEndsAt).getTime() - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Expired";
  return `${days}d left`;
}

