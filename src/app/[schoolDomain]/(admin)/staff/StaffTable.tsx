"use client";

import React, { useState, useTransition, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Staff } from "@prisma/client";
import {
  createStaff,
  updateStaff,
  deleteStaff,
  updateStaffStatus,
  fetchStaffPaginated,
  markStaffQuickAttendanceAction,
  fetchSchoolClassesAction,
  fetchSchoolSubjectsAction,
} from "./actions";
import { useTenant } from "@/lib/tenant-context";
import {
  StaffTierCategory,
  resolveStaffTierCategory,
  getRolesForTier,
  getDefaultRoleForTier,
  getStaffTierBadgeLabel,
  TERTIARY_ACADEMIC_STAFF_ROLES,
  TERTIARY_NON_ACADEMIC_STAFF_ROLES,
} from "@/lib/staff-roles-config";
import StaffProfileDrawer from "./StaffProfileDrawer";
import StaffDepartmentModal from "./StaffDepartmentModal";
import CrecheStaffOnboardingModal from "./components/CrecheStaffOnboardingModal";
import NurseryStaffOnboardingModal from "./components/NurseryStaffOnboardingModal";
import PrimaryStaffOnboardingModal from "./components/PrimaryStaffOnboardingModal";
import SecondaryStaffOnboardingModal from "./components/SecondaryStaffOnboardingModal";
import TertiaryStaffOnboardingModal from "./components/TertiaryStaffOnboardingModal";
import { fetchSchoolStaffMembersAction } from "./actions";
import {
  Users,
  Search,
  Plus,
  Building2,
  Printer,
  FileText,
  CheckCircle2,
  Clock,
  Trash2,
  Award,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Phone,
  Briefcase,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Key,
  X,
  Sparkles,
} from "lucide-react";

export interface StaffTableProps {
  staffList: any[];
  initialNextCursor?: string | null;
  initialHasMore?: boolean;
  schoolId: string;
  departments?: any[];
  schoolDomain?: string;
  schoolName?: string;
  activeTier?: string;
  classrooms?: Array<{ id: string; name: string }>;
}

const NIGERIAN_BANKS = [
  "Zenith Bank",
  "Guaranty Trust Bank (GTBank)",
  "First Bank of Nigeria",
  "Access Bank",
  "United Bank for Africa (UBA)",
  "Fidelity Bank",
  "Stanbic IBTC Bank",
  "Union Bank",
  "Sterling Bank",
  "Ecobank Nigeria",
  "Wema Bank",
  "Monnify / OPay",
  "Raenest",
];

const QUALIFICATIONS = [
  "N.C.E (Nigeria Certificate in Education)",
  "B.Ed (Bachelor of Education)",
  "B.Sc (Ed) / B.A (Ed)",
  "B.Sc / B.A / B.Tech + PGDE",
  "B.Sc / B.A (Non-Education)",
  "H.N.D (Higher National Diploma)",
  "M.Ed (Master of Education)",
  "M.Sc / M.A",
  "Ph.D (Doctor of Philosophy)",
];

const PRIMARY_EDUCATION_SUBJECTS = [
  "Mathematics",
  "English Language",
  "Basic Science & Technology",
  "Social Studies",
  "Civic Education",
  "Agricultural Science",
  "Computer Studies / ICT",
  "Cultural & Creative Arts (CCA)",
  "Physical & Health Education (PHE)",
  "Christian Religious Studies (CRS)",
  "Islamic Religious Studies (IRS)",
  "Home Economics",
  "Verbal Reasoning",
  "Quantitative Reasoning",
  "French",
];

const SECONDARY_EDUCATION_SUBJECTS = [
  "Mathematics",
  "Further Mathematics",
  "English Language",
  "Literature-in-English",
  "Biology",
  "Chemistry",
  "Physics",
  "Agricultural Science",
  "Economics",
  "Government",
  "Geography",
  "Civic Education",
  "Computer Science / ICT",
  "Commerce",
  "Financial Accounting",
  "History",
];

function getStaffAssignmentLabel(tier?: string | null): string {
  if (!tier) return "Subject / Class Assigned";
  const norm = tier.toUpperCase().trim();

  // 3. Tertiary: Label = "Department / Faculty", no Subject
  if (
    norm.includes("TERTIARY") ||
    norm.includes("UNIVERSITY") ||
    norm.includes("POLYTECHNIC") ||
    norm.includes("COLLEGE OF EDUCATION") ||
    norm.includes("HIGHER") ||
    norm === "UNI" ||
    norm === "COE" ||
    norm === "HND"
  ) {
    return "Department / Faculty";
  }

  // 1. Basic (Nursery/Primary/JSS): Label = "Subject / Class Assigned"
  if (
    norm.includes("NURSERY") ||
    norm.includes("CRECHE") ||
    norm.includes("CRECHE") ||
    norm.includes("CRÈCHE") ||
    norm.includes("PRE-SCHOOL") ||
    norm.includes("KINDERGARTEN") ||
    norm.includes("EARLY") ||
    norm.includes("PRIMARY") ||
    norm.includes("BASIC") ||
    norm.includes("ELEMENTARY") ||
    norm.includes("JSS") ||
    norm.includes("JUNIOR")
  ) {
    return "Subject / Class Assigned";
  }

  // 2. Secondary (SSS): Label = "Subject Taught" only, no Department
  if (
    norm.includes("SECONDARY") ||
    norm.includes("SSS") ||
    norm.includes("SENIOR") ||
    norm.includes("HIGH SCHOOL")
  ) {
    return "Subject Taught";
  }

  return "Subject / Class Assigned";
}

export default function StaffTable({
  staffList,
  initialNextCursor,
  initialHasMore,
  schoolId,
  departments = [],
  schoolDomain: propDomain,
  schoolName: propSchoolName,
  activeTier,
  classrooms: propClassrooms = [],
}: StaffTableProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const tenant = useTenant();
  const searchParams = useSearchParams();
  const paramTier = searchParams.get("tier");

  const schoolDomain = propDomain || tenant.subdomain || "greenwood";
  const schoolName = propSchoolName || tenant.name || "Greenwood Academy";

  // Onboarding Success Notification Banner State
  const [onboardSuccessMessage, setOnboardSuccessMessage] = useState<{
    name: string;
    role: string;
    email: string;
    tempPassword?: string;
    emailDispatched?: boolean;
    emailDeliveryStatus?: string;
  } | null>(null);

  // Auto-dismiss confirmation banner after 15 seconds
  useEffect(() => {
    if (!onboardSuccessMessage) return;
    const timer = setTimeout(() => {
      setOnboardSuccessMessage(null);
    }, 15000);
    return () => clearTimeout(timer);
  }, [onboardSuccessMessage]);

  // Tier category resolution
  const effectiveTier = paramTier || activeTier || (tenant as any)?.activeTier || tenant?.preciseTier || "PRIMARY";
  const tierCategory: StaffTierCategory = useMemo(() => {
    return resolveStaffTierCategory(effectiveTier);
  }, [effectiveTier]);

  const activeRolesList = useMemo(() => getRolesForTier(tierCategory), [tierCategory]);
  const defaultRole = useMemo(() => getDefaultRoleForTier(tierCategory), [tierCategory]);
  const tierBadgeLabel = useMemo(() => getStaffTierBadgeLabel(tierCategory), [tierCategory]);
  const isTertiary = tierCategory === "TERTIARY";

  const staffAssignmentLabel = useMemo(() => {
    return getStaffAssignmentLabel(effectiveTier);
  }, [effectiveTier]);

  // Classrooms resolution & auto-fetching for modal dropdowns
  const [tableClassrooms, setTableClassrooms] = useState<Array<{ id: string; name: string }>>(propClassrooms);

  useEffect(() => {
    if (propClassrooms && propClassrooms.length > 0) {
      setTableClassrooms(propClassrooms);
    } else if (schoolDomain) {
      fetchSchoolClassesAction(schoolDomain)
        .then((res) => {
          if (res.success && res.data && res.data.length > 0) {
            setTableClassrooms(res.data.map((c: any) => ({ id: c.id, name: c.name })));
          }
        })
        .catch(() => {});
    }
  }, [schoolDomain, propClassrooms]);

  // Roster & Pagination state
  const [currentStaff, setCurrentStaff] = useState<any[]>(staffList);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore ?? false);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const paramRole = searchParams.get("role");
  const paramFilter = searchParams.get("filter");
  const paramTab = searchParams.get("tab");

  const initialRole = useMemo(() => {
    const raw = (paramFilter || paramRole || "").trim().toUpperCase();
    if (raw.includes("TEACH")) return "TEACHER";
    if (raw.includes("NON")) return "NON_TEACHING";
    if (raw && raw !== "ALL") return raw;
    return "ALL";
  }, [paramFilter, paramRole]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>(initialRole);
  const [filterDepartment, setFilterDepartment] = useState<string>("ALL");

  useEffect(() => {
    const raw = (paramFilter || paramRole || "").trim().toUpperCase();
    if (raw) {
      const target = raw.includes("NON") ? "NON_TEACHING" : raw.includes("TEACH") ? "TEACHER" : raw;
      setFilterRole(target);
      refreshRoster(undefined, target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramFilter, paramRole]);

  // Drawers & Modals
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [lineManagers, setLineManagers] = useState<any[]>([]);

  useEffect(() => {
    fetchSchoolStaffMembersAction(schoolDomain)
      .then((res) => {
        if (res.success && res.data) {
          setLineManagers(res.data);
        }
      })
      .catch(() => {});
  }, [schoolDomain]);

  // Refresh roster with optional bypassCache support
  const refreshRoster = (query?: string, role?: string, dept?: string, bypassCache?: boolean) => {
    const q = query !== undefined ? query : searchQuery;
    const r = role !== undefined ? role : filterRole;
    const d = dept !== undefined ? dept : filterDepartment;

    startTransition(async () => {
      const res = await fetchStaffPaginated(schoolDomain, {
        search: q || undefined,
        role: r !== "ALL" ? r : undefined,
        departmentId: d !== "ALL" ? d : undefined,
        limit: 25,
        bypassCache,
      });
      if (res?.items) {
        setCurrentStaff(res.items);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      }
    });
  };

  // Immediate optimistic update and UI confirmation handler for all onboarding modals
  const handleStaffOnboardingSuccess = (newStaff: any) => {
    setIsOnboardModalOpen(false);

    if (newStaff) {
      const optimisticStaff = {
        id: newStaff.id || `temp-${Date.now()}`,
        staffId: newStaff.staffId || null,
        firstName: newStaff.firstName || "New",
        lastName: newStaff.lastName || "Staff",
        email: newStaff.email || "",
        role: newStaff.role || defaultRole,
        department: newStaff.department || null,
        metadata: newStaff.metadata || {
          qualification: "B.Ed",
          trcn_number: null,
          trcnCategory: "Category C",
        },
        baseSalary: newStaff.baseSalary || 220000,
        bankName: newStaff.bankName || "Zenith Bank",
        status: newStaff.status || "ACTIVE",
        todayAttendance: null,
      };

      // Reset search filter if one was active so the newly created staff member is immediately visible
      if (searchQuery) {
        setSearchQuery("");
      }

      // If active filter would hide this role, adjust filter
      if (newStaff.role) {
        const isTeacher = newStaff.role.toUpperCase().includes("TEACH");
        if (filterRole === "TEACHER" && !isTeacher) {
          setFilterRole("ALL");
        } else if (filterRole === "NON_TEACHING" && isTeacher) {
          setFilterRole("ALL");
        }
      }

      // Optimistic instant prepend to table
      setCurrentStaff((prev) => {
        const exists = prev.some(
          (s) =>
            s.id === optimisticStaff.id ||
            (s.email && optimisticStaff.email && s.email.toLowerCase() === optimisticStaff.email.toLowerCase())
        );
        if (exists) return prev;
        return [optimisticStaff, ...prev];
      });

      // Show confirmation banner
      setOnboardSuccessMessage({
        name: `${newStaff.firstName} ${newStaff.lastName}`.trim(),
        role: newStaff.role || "Staff Member",
        email: newStaff.email || "",
        tempPassword: newStaff.tempPassword,
        emailDispatched: newStaff.emailDispatched,
        emailDeliveryStatus: newStaff.emailDeliveryStatus,
      });

      // Trigger background sync with bypassCache=true & server component router refresh
      refreshRoster("", undefined, undefined, true);
      router.refresh();
    } else {
      refreshRoster(undefined, undefined, undefined, true);
      router.refresh();
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setPageIndex(0);
    setCursorHistory([]);
    refreshRoster(val, filterRole, filterDepartment);
  };

  const handleFilterRoleChange = (newRole: string) => {
    setFilterRole(newRole);
    setPageIndex(0);
    setCursorHistory([]);
    refreshRoster(searchQuery, newRole, filterDepartment);
  };

  const handleFilterDeptChange = (newDept: string) => {
    setFilterDepartment(newDept);
    setPageIndex(0);
    setCursorHistory([]);
    refreshRoster(searchQuery, filterRole, newDept);
  };

  const handleNextPage = () => {
    if (!nextCursor || isPending) return;
    const currentCursor = nextCursor;
    startTransition(async () => {
      const res = await fetchStaffPaginated(schoolDomain, {
        cursor: currentCursor,
        limit: 25,
        search: searchQuery || undefined,
        role: filterRole !== "ALL" ? filterRole : undefined,
        departmentId: filterDepartment !== "ALL" ? filterDepartment : undefined,
      });
      setCursorHistory((prev) => [...prev, currentCursor]);
      setCurrentStaff(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setPageIndex((prev) => prev + 1);
    });
  };

  const handlePrevPage = () => {
    if (pageIndex === 0 || isPending) return;
    const newHistory = [...cursorHistory];
    newHistory.pop();
    const targetCursor = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
    startTransition(async () => {
      const res = await fetchStaffPaginated(schoolDomain, {
        cursor: targetCursor,
        limit: 25,
        search: searchQuery || undefined,
        role: filterRole !== "ALL" ? filterRole : undefined,
        departmentId: filterDepartment !== "ALL" ? filterDepartment : undefined,
      });
      setCursorHistory(newHistory);
      setCurrentStaff(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setPageIndex((prev) => Math.max(0, prev - 1));
    });
  };

  const handleDeleteStaff = async (staffId: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete staff member "${name}"?\n\nThis will permanently delete their staff record, linked user login credentials, assignments, and portal access. This action cannot be undone.`
      )
    )
      return;

    startTransition(async () => {
      const res = await deleteStaff(schoolDomain, staffId);
      if (res?.success) {
        setCurrentStaff((prev) => prev.filter((s) => s.id !== staffId));
      } else {
        alert(res?.error || "Failed to permanently delete staff member.");
      }
    });
  };

  const handleQuickClockIn = async (staffId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === "PRESENT" ? "LATE" : "PRESENT";
    startTransition(async () => {
      const res = await markStaffQuickAttendanceAction(schoolDomain, staffId, nextStatus as any);
      if (res.success) {
        setCurrentStaff((prev) =>
          prev.map((s) => (s.id === staffId ? { ...s, todayAttendance: res.data } : s))
        );
      }
    });
  };

  const openDossier = (staffMember: any) => {
    setSelectedStaff(staffMember);
    setIsDrawerOpen(true);
  };

  // -------------------------------------------------------------
  // PRINTABLE OFFICIAL STAFF IDENTITY CARD
  // -------------------------------------------------------------
  const printStaffIdCard = (staffMember: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const staffIdNo = `EMP-${(tenant?.subdomain || "GW").toUpperCase()}/${new Date().getFullYear()}/${staffMember.id.substring(0, 6).toUpperCase()}`;
    const departmentName = staffMember.department?.name || "Academic Staff";
    const qualification = staffMember.metadata?.qualification || "Certified Staff";
    const nin = staffMember.metadata?.nin || "NIN VERIFIED";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Official Staff Identity Card - ${staffMember.firstName} ${staffMember.lastName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 32px; 
              background-color: #f8fafc; 
              color: #0f172a; 
            }
            @media print { 
              .print\\:hidden, [class*="print:hidden"] { display: none !important; }
              body { padding: 0 !important; background: transparent !important; }
            }
          </style>
        </head>
        <body class="flex flex-col items-center justify-center min-h-screen">
          <div class="print:hidden mb-6 flex items-center gap-3">
            <button onclick="window.close()" class="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs">
              Close
            </button>
            <button onclick="window.print()" class="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md">
              Print Official Staff Card
            </button>
          </div>

          <!-- DUAL ID CARD PRINT WRAPPER -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
            <!-- CARD FRONT -->
            <div class="w-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-2xl border-2 border-indigo-500/30 flex flex-col justify-between h-[360px] relative overflow-hidden">
              <div class="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-indigo-600/10 blur-2xl pointer-events-none"></div>

              <!-- Top Bar -->
              <div class="flex items-center justify-between border-b border-indigo-500/30 pb-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-black text-xs">
                    GW
                  </div>
                  <div>
                    <h2 class="text-xs font-black uppercase tracking-wider text-white">${schoolName}</h2>
                    <p class="text-[9px] text-indigo-300 font-semibold tracking-widest uppercase">Office of the Registrar • Staff Card</p>
                  </div>
                </div>
                <span class="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  STAFF
                </span>
              </div>

              <!-- Center Bio -->
              <div class="flex items-center gap-5 my-auto">
                <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-3xl font-black shadow-lg border-2 border-white/20 shrink-0">
                  ${staffMember.firstName?.[0]}${staffMember.lastName?.[0]}
                </div>
                <div class="min-w-0">
                  <h3 class="text-base font-black text-white leading-tight">
                    ${staffMember.firstName} ${staffMember.lastName}
                  </h3>
                  <p class="text-xs font-bold text-indigo-300 mt-0.5">${staffMember.role}</p>
                  <p class="text-[11px] text-slate-300 font-medium mt-1">${departmentName}</p>
                  <p class="text-[10px] text-emerald-400 font-mono mt-1 font-semibold">${staffIdNo}</p>
                </div>
              </div>

              <!-- Footer Details -->
              <div class="pt-3 border-t border-indigo-500/30 grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <span class="text-indigo-400 block text-[9px] uppercase font-bold">Expires</span>
                  <span class="font-black text-white">DEC 2028</span>
                </div>
                <div>
                  <span class="text-indigo-400 block text-[9px] uppercase font-bold">Qualification</span>
                  <span class="font-black text-white truncate block">${qualification.split(" ")[0]}</span>
                </div>
                <div class="text-right">
                  <span class="text-indigo-400 block text-[9px] uppercase font-bold">TRCN Status</span>
                  <span class="font-black text-emerald-400">CERTIFIED</span>
                </div>
              </div>
            </div>

            <!-- CARD BACK -->
            <div class="w-full bg-white text-slate-900 rounded-3xl p-6 shadow-2xl border-2 border-slate-200 flex flex-col justify-between h-[360px]">
              <div>
                <h4 class="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
                  Institutional Security & Terms of Use
                </h4>
                <ul class="text-[10px] text-slate-600 mt-3 space-y-1.5 list-disc pl-4 leading-relaxed font-medium">
                  <li>This card is the official property of <strong>${schoolName}</strong>.</li>
                  <li>The holder is an accredited member of the institutional academic/administrative staff.</li>
                  <li>Loss or theft of this card must be reported immediately to the Office of the Registrar.</li>
                  <li>If found, please return to any branch of ${schoolName} or call +234 800 000 0000.</li>
                </ul>
              </div>

              <!-- Barcode & Authorized Signature -->
              <div class="pt-4 border-t border-slate-200 flex items-end justify-between">
                <div>
                  <div class="h-9 w-32 bg-slate-900 rounded flex items-center justify-center text-white font-mono text-[9px] tracking-widest">
                    |||||| | ||||||||
                  </div>
                  <span class="text-[8px] font-mono text-slate-400 mt-1 block">NIN: ${nin}</span>
                </div>
                <div class="text-right">
                  <div class="border-b border-slate-900 w-28 pb-1 mb-1 text-center font-serif text-[11px] italic font-bold">
                    Registrar Seal
                  </div>
                  <span class="text-[8px] uppercase font-bold text-slate-500 block">Authorized Signature</span>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // -------------------------------------------------------------
  // PRINTABLE APPOINTMENT LETTER / EMPLOYMENT CONTRACT
  // -------------------------------------------------------------
  const printAppointmentLetter = (staffMember: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const refNo = `REF/${(tenant?.subdomain || "GW").toUpperCase()}/HR/${new Date().getFullYear()}/${staffMember.id.substring(0, 6).toUpperCase()}`;
    const todayStr = new Date().toLocaleDateString("en-NG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const monthlySalary = staffMember.baseSalary
      ? `₦${Number(staffMember.baseSalary).toLocaleString()}`
      : "₦220,000.00";
    const annualSalary = staffMember.baseSalary
      ? `₦${(Number(staffMember.baseSalary) * 12).toLocaleString()}`
      : "₦2,640,000.00";
    const departmentName = staffMember.department?.name || "General Academic Department";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Letter of Appointment - ${staffMember.firstName} ${staffMember.lastName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { 
              font-family: Georgia, Cambria, "Times New Roman", Times, serif; 
              padding: 48px; 
              color: #0f172a; 
              max-width: 800px; 
              margin: 0 auto; 
              line-height: 1.6; 
              background-color: #ffffff;
            }
            @media print { 
              .print\\:hidden, [class*="print:hidden"] { display: none !important; }
              body { padding: 0 !important; max-width: 100% !important; }
            }
          </style>
        </head>
        <body>
          <div class="print:hidden mb-8 flex items-center justify-between border-b pb-4">
            <button onclick="window.close()" class="px-4 py-2 bg-slate-100 text-slate-700 font-sans font-bold rounded-xl text-xs">
              Back to Directory
            </button>
            <button onclick="window.print()" class="px-5 py-2 bg-slate-900 text-white font-sans font-bold rounded-xl text-xs shadow-md">
              Print Appointment Letter
            </button>
          </div>

          <!-- INSTITUTION LETTERHEAD -->
          <div class="text-center border-b-2 border-slate-900 pb-5 mb-8">
            <div class="inline-block w-16 h-16 rounded-2xl bg-indigo-900 text-white font-sans font-black text-2xl flex items-center justify-center mb-2 border-2 border-amber-400">
              GW
            </div>
            <h1 class="text-2xl font-black uppercase tracking-tight text-slate-900">${schoolName}</h1>
            <p class="text-xs uppercase tracking-widest text-slate-600 font-sans mt-0.5">
              Office of the Human Resources Director & Governing Council
            </p>
            <p class="text-[11px] text-slate-500 font-sans mt-1">Official Ref: <strong class="font-mono">${refNo}</strong> • Date: ${todayStr}</p>
          </div>

          <!-- CANDIDATE ADDRESS -->
          <div class="mb-6 font-sans text-xs space-y-1">
            <p class="font-bold text-sm text-slate-900">${staffMember.firstName} ${staffMember.lastName}</p>
            <p class="text-slate-600">Email: ${staffMember.email}</p>
            <p class="text-slate-600">Appointed Department: ${departmentName}</p>
          </div>

          <p class="text-sm font-bold mb-4 font-sans uppercase">
            Dear ${staffMember.firstName},
          </p>

          <h2 class="text-base font-bold underline mb-4 text-center font-sans uppercase tracking-wide">
            OFFER OF PROVISIONAL APPOINTMENT AS ${staffMember.role.toUpperCase()}
          </h2>

          <div class="text-xs space-y-3 leading-relaxed text-slate-800">
            <p>
              The Governing Council and Executive Management of <strong>${schoolName}</strong> are pleased to offer you an appointment as <strong>${staffMember.role}</strong> in the Department of <strong>${departmentName}</strong> effective from the commencement of the active academic session.
            </p>

            <h3 class="font-bold font-sans uppercase text-slate-900 text-[11px] mt-3">1. Remuneration & Compensation Package</h3>
            <p>
              Your consolidated gross monthly remuneration shall be <strong>${monthlySalary}</strong> (${annualSalary} per annum), payable in arrears in accordance with the institution's official payroll calendar through electronic bank disbursement.
            </p>

            <h3 class="font-bold font-sans uppercase text-slate-900 text-[11px] mt-3">2. Statutory Standards & TRCN Accreditation</h3>
            <p>
              In compliance with Federal Republic of Nigeria educational statutes, all teaching personnel are mandated to maintain active licensure with the <strong>Teachers Registration Council of Nigeria (TRCN)</strong> and abide by the institutional Code of Professional Ethics.
            </p>

            <h3 class="font-bold font-sans uppercase text-slate-900 text-[11px] mt-3">3. Acceptance of Offer</h3>
            <p>
              Please sign and return the duplicate copy of this letter within fourteen (14) days of receipt to confirm your formal acceptance of this appointment offer.
            </p>
          </div>

          <!-- SIGNATURE BLOCKS -->
          <div class="mt-14 pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 font-sans text-xs">
            <div>
              <div class="border-b border-slate-900 pb-1 mb-1 font-serif italic text-sm">
                Dr. A. B. Adeleke
              </div>
              <p class="font-bold text-slate-900">Registrar & Secretary to Council</p>
              <p class="text-[10px] text-slate-500">${schoolName}</p>
            </div>

            <div class="text-right">
              <div class="border-b border-slate-900 pb-1 mb-1 text-center font-serif italic text-sm text-slate-400">
                (Sign & Date Here)
              </div>
              <p class="font-bold text-slate-900">${staffMember.firstName} ${staffMember.lastName}</p>
              <p class="text-[10px] text-slate-500">Candidate Acceptance Endorsement</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* ONBOARDING SUCCESS CONFIRMATION BANNER */}
      {onboardSuccessMessage && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white p-5 shadow-xl border border-emerald-500/30 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 shadow-inner">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-sm text-white tracking-wide flex items-center gap-1.5">
                    <span>Staff Member Successfully Onboarded!</span>
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Added to Directory Instantly
                  </span>
                </div>
                <p className="text-xs text-emerald-100/90 leading-relaxed">
                  <strong className="text-white font-bold">{onboardSuccessMessage.name}</strong> has been onboarded as{" "}
                  <span className="text-emerald-300 font-semibold">{onboardSuccessMessage.role}</span> and added directly to the staff directory below.
                </p>
                <div className="flex items-center gap-3 pt-1.5 flex-wrap text-xs">
                  {onboardSuccessMessage.email && (
                    <div className="flex items-center gap-1.5 text-emerald-200/90 bg-emerald-900/40 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      <Mail className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{onboardSuccessMessage.email}</span>
                      {onboardSuccessMessage.emailDispatched ? (
                        <span className="text-[10px] text-emerald-300 font-semibold">• Credentials Dispatched</span>
                      ) : (
                        <span className="text-[10px] text-emerald-300/80 font-semibold">• Credentials Dispatched</span>
                      )}
                    </div>
                  )}
                  {onboardSuccessMessage.tempPassword && (
                    <div className="flex items-center gap-1.5 text-indigo-200 bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-500/30 font-mono text-[11px]">
                      <Key className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Temp Password: <strong className="text-white">{onboardSuccessMessage.tempPassword}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOnboardSuccessMessage(null)}
              className="text-emerald-300/70 hover:text-white hover:bg-emerald-800/40 p-1.5 rounded-lg transition shrink-0"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TOOLBAR & SEARCH BAR */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
        {/* ROW 1: HEADER & FILTER CHIPS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">Staff Directory</h3>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                  {tierBadgeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Showing personnel assigned to {schoolName} ({tierBadgeLabel || "Institutional Tier"})</p>
            </div>
          </div>

          {/* FILTER CHIPS: All Staff | Teachers | Non-Teaching Staff */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 self-start md:self-auto overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => handleFilterRoleChange("ALL")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filterRole === "ALL"
                  ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Staff
            </button>
            <button
              type="button"
              onClick={() => handleFilterRoleChange("TEACHER")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                filterRole === "TEACHER"
                  ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Teachers</span>
            </button>
            <button
              type="button"
              onClick={() => handleFilterRoleChange("NON_TEACHING")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                filterRole === "NON_TEACHING"
                  ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Non-Teaching Staff</span>
            </button>
          </div>
        </div>

        {/* ROW 2: SEARCH, SPECIFIC ROLE DROPDOWN, DEPARTMENTS, ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* SEARCH */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff by name or email..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-64 bg-slate-50/50"
              />
            </div>

            {/* FILTER ROLE */}
            <select
              value={filterRole}
              onChange={(e) => handleFilterRoleChange(e.target.value)}
              disabled={isPending}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-indigo-500 bg-white shadow-2xs"
            >
              <option value="ALL">All Roles ({activeRolesList.length})</option>
              {isTertiary ? (
                <>
                  <optgroup label="Academic Staff Roles">
                    {TERTIARY_ACADEMIC_STAFF_ROLES.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Non-Academic Staff Roles">
                    {TERTIARY_NON_ACADEMIC_STAFF_ROLES.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                </>
              ) : (
                activeRolesList.map((r: string) => (
                  <option key={r} value={r}>{r}</option>
                ))
              )}
            </select>

            {/* FILTER DEPT */}
            <select
              value={filterDepartment}
              onChange={(e) => handleFilterDeptChange(e.target.value)}
              disabled={isPending}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-indigo-500 bg-white shadow-2xs"
            >
              <option value="ALL">All {staffAssignmentLabel} ({departments.length})</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* ADD STAFF BUTTON */}
            <button
              onClick={() => setIsOnboardModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Onboard New Staff</span>
            </button>
          </div>
        </div>
      </div>

      {/* MASTER STAFF TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden w-full max-w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[700px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-4">Staff Member & ID</th>
                <th className="p-4">Role & Tier</th>
                <th className="p-4">{staffAssignmentLabel}</th>
                <th className="p-4">TRCN & Credentials</th>
                <th className="p-4">Today&apos;s Clock-In</th>
                <th className="p-4">Remuneration</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentStaff.length > 0 ? (
                currentStaff.map((staff) => {
                  const meta = staff.metadata || {};
                  const todayAtt = staff.todayAttendance;
                  const employeeId = `GW/STF/2026/${staff.id.substring(0, 5).toUpperCase()}`;

                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/70 transition">
                      {/* NAME & AVATAR */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div 
                            onClick={() => openDossier(staff)}
                            className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-black text-xs cursor-pointer shadow-2xs hover:scale-105 transition shrink-0"
                          >
                            {staff.firstName?.[0]}{staff.lastName?.[0]}
                          </div>
                          <div>
                            <button
                              onClick={() => openDossier(staff)}
                              className="font-bold text-slate-800 hover:text-indigo-600 transition text-left cursor-pointer"
                            >
                              {staff.firstName} {staff.lastName}
                            </button>
                            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                              <span>{employeeId}</span>
                              <span>•</span>
                              <span>{staff.email}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* ROLE */}
                      <td className="p-4">
                        <span className="font-semibold text-slate-700 block">{staff.role}</span>
                        <span className="text-[10px] text-indigo-600 font-medium">{tierBadgeLabel}</span>
                      </td>

                      {/* DEPARTMENT */}
                      <td className="p-4">
                        {staff.department ? (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            {staff.department.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* TRCN & QUALIFICATION */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-800 block">
                            {meta.qualification ? meta.qualification.split(" ")[0] : "B.Ed"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>{meta.trcn_number ? "TRCN Licensed" : "TRCN Reg"}</span>
                          </span>
                        </div>
                      </td>

                      {/* ATTENDANCE TODAY */}
                      <td className="p-4">
                        <button
                          onClick={() => handleQuickClockIn(staff.id, todayAtt?.status)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition active:scale-95 ${
                            todayAtt?.status === "PRESENT"
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : todayAtt?.status === "LATE"
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                          title="Click to toggle Present / Late status"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            todayAtt?.status === "PRESENT" ? "bg-emerald-600" :
                            todayAtt?.status === "LATE" ? "bg-amber-600" : "bg-slate-400"
                          }`} />
                          <span>{todayAtt?.status || "Mark Clock-In"}</span>
                        </button>
                      </td>

                      {/* REMUNERATION */}
                      <td className="p-4">
                        <span className="font-black text-slate-800 font-mono block">
                          ₦{(staff.baseSalary || 220000).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {staff.bankName ? staff.bankName.split(" ")[0] : "Zenith"}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openDossier(staff)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] transition"
                          >
                            Dossier
                          </button>
                          <button
                            onClick={() => printStaffIdCard(staff)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                            title="Print Staff ID Card"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => printAppointmentLetter(staff)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                            title="Print Appointment Letter"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(staff.id, `${staff.firstName} ${staff.lastName}`)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Permanently Delete Staff"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                    No staff records found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Page {pageIndex + 1} ({currentStaff.length} personnel displayed)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={pageIndex === 0 || isPending}
              className="px-3 py-1.5 border border-slate-200 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40 transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || isPending}
              className="px-3 py-1.5 border border-slate-200 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40 transition flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* STAFF PROFILE DOSSIER DRAWER */}
      <StaffProfileDrawer
        staff={selectedStaff}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedStaff(null);
        }}
        departments={departments}
        schoolId={schoolId}
        schoolDomain={schoolDomain}
        schoolName={schoolName}
        onStaffUpdated={refreshRoster}
        onPrintIdCard={printStaffIdCard}
        onPrintAppointmentLetter={printAppointmentLetter}
        activeTier={effectiveTier}
        tierCategory={tierCategory}
      />

      
      {/* 5 TIER-AWARE ONBOARDING MODALS */}
      {tierCategory === "CRECHE" && (
        <CrecheStaffOnboardingModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboardModalOpen(false)}
          onSuccess={(created) => handleStaffOnboardingSuccess(created)}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          classrooms={tableClassrooms}
          lineManagers={lineManagers}
        />
      )}
      {tierCategory === "NURSERY" && (
        <NurseryStaffOnboardingModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboardModalOpen(false)}
          onSuccess={(created) => handleStaffOnboardingSuccess(created)}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          classrooms={tableClassrooms}
          lineManagers={lineManagers}
        />
      )}
      {tierCategory === "PRIMARY" && (
        <PrimaryStaffOnboardingModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboardModalOpen(false)}
          onSuccess={(created) => handleStaffOnboardingSuccess(created)}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          classrooms={tableClassrooms}
          lineManagers={lineManagers}
        />
      )}
      {tierCategory === "SECONDARY" && (
        <SecondaryStaffOnboardingModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboardModalOpen(false)}
          onSuccess={(created) => handleStaffOnboardingSuccess(created)}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          classrooms={tableClassrooms}
          lineManagers={lineManagers}
        />
      )}
      {tierCategory === "TERTIARY" && (
        <TertiaryStaffOnboardingModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboardModalOpen(false)}
          onSuccess={(created) => handleStaffOnboardingSuccess(created)}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          lineManagers={lineManagers}
        />
      )}

      {/* DEPARTMENTS MODAL */}
      <StaffDepartmentModal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        departments={departments}
        schoolDomain={schoolDomain}
        schoolId={schoolId}
        onDepartmentChanged={refreshRoster}
      />
    </div>
  );
}
