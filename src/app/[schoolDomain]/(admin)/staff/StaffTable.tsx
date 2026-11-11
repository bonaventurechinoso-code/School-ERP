"use client";

import React, { useState, useTransition, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
}: StaffTableProps) {
  const [isPending, startTransition] = useTransition();
  const tenant = useTenant();
  const searchParams = useSearchParams();
  const paramTier = searchParams.get("tier");

  const schoolDomain = propDomain || tenant.subdomain || "greenwood";
  const schoolName = propSchoolName || tenant.name || "Greenwood Academy";

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
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create Staff Form State
  const [createData, setCreateData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: defaultRole,
    status: "ACTIVE",
    departmentId: "",
    baseSalary: "220000",
    bankName: "Zenith Bank",
    bankAccountNumber: "",
    phone: "",
    qualification: "B.Ed (Bachelor of Education)",
    trcnNumber: "",
    trcnStatus: "REGISTERED",
    password: "",
    confirmPassword: "",
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);
  const [customRole, setCustomRole] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Searchable bank dropdown for Create Staff form
  const [bankCreateSearch, setBankCreateSearch] = useState("");
  const [bankCreateDropdownOpen, setBankCreateDropdownOpen] = useState(false);
  const bankCreateDropdownRef = useRef<HTMLDivElement>(null);

  const filteredCreateBanks = NIGERIAN_BANKS.filter((b) =>
    b.toLowerCase().includes(bankCreateSearch.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bankCreateDropdownRef.current && !bankCreateDropdownRef.current.contains(e.target as Node)) {
        setBankCreateDropdownOpen(false);
        setBankCreateSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Dynamic querying and Searchable Combobox for Subject / Class Assigned select field
  const [assignmentOptions, setAssignmentOptions] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentDropdownOpen, setAssignmentDropdownOpen] = useState(false);
  const assignmentDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (assignmentDropdownRef.current && !assignmentDropdownRef.current.contains(e.target as Node)) {
        setAssignmentDropdownOpen(false);
        setAssignmentSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const roleLower = (createData.role || "").toLowerCase();

    async function loadAssignmentOptions() {
      setIsLoadingOptions(true);
      try {
        if (roleLower.includes("class teacher") || roleLower.includes("form teacher")) {
          // If Class Teacher, fetch items from Class / Section database records and filter strictly by active tier
          const res = await fetchSchoolClassesAction(schoolDomain);
          if (isMounted) {
            const rawClasses = res.data || [];
            let filteredClasses: { id: string; name: string }[] = [];

            if (tierCategory === "PRIMARY") {
              // STRICT PRIMARY FILTER: Exclude Nursery, JSS, SSS, and Higher Education 100-400 levels
              filteredClasses = rawClasses
                .filter((c: any) => {
                  const cName = (c.name || "").trim();
                  const cTierName = (c.tier?.name || "").toLowerCase();

                  // Explicit exclusions: Nursery, Secondary, Higher Education
                  const isNursery =
                    /creche|nursery|creche|crèche|kg|kindergarten|pre-school|early/i.test(cName) ||
                    cTierName.includes("nursery") ||
                    cTierName.includes("creche");
                  const isSecondary =
                    /jss|sss|junior|senior|secondary|high school|grade 7|grade 8|grade 9|grade 10|grade 11|grade 12/i.test(cName) ||
                    cTierName.includes("secondary");
                  const isHigherEd =
                    /level|100|200|300|400|500|nd |hnd |university|college/i.test(cName) ||
                    cTierName.includes("higher") ||
                    cTierName.includes("university");

                  if (isNursery || isSecondary || isHigherEd) return false;

                  // Inclusion: Matches primary pattern or primary tier
                  const isPrimaryMatch =
                    /primary|basic|grade [1-6]|class [1-6]/i.test(cName) ||
                    cTierName.includes("primary");
                  return isPrimaryMatch;
                })
                .map((c: any) => ({
                  id: c.id,
                  name: c.name,
                }));
            } else if (tierCategory === "NURSERY") {
              filteredClasses = rawClasses
                .filter((c: any) => {
                  const cName = (c.name || "").trim();
                  const cTierName = (c.tier?.name || "").toLowerCase();
                  return (
                    /creche|nursery|creche|crèche|kg|kindergarten|pre-school|early/i.test(cName) ||
                    cTierName.includes("nursery") ||
                    cTierName.includes("creche")
                  );
                })
                .map((c: any) => ({
                  id: c.id,
                  name: c.name,
                }));
            } else if (tierCategory === "SECONDARY") {
              filteredClasses = rawClasses
                .filter((c: any) => {
                  const cName = (c.name || "").trim();
                  const cTierName = (c.tier?.name || "").toLowerCase();
                  return (
                    /jss|sss|junior|senior|secondary/i.test(cName) ||
                    cTierName.includes("secondary")
                  );
                })
                .map((c: any) => ({
                  id: c.id,
                  name: c.name,
                }));
            } else {
              filteredClasses = rawClasses
                .filter((c: any) => {
                  const cName = (c.name || "").trim();
                  const cTierName = (c.tier?.name || "").toLowerCase();
                  return (
                    /level|100|200|300|400|500|nd|hnd/i.test(cName) ||
                    cTierName.includes("higher") ||
                    cTierName.includes("university")
                  );
                })
                .map((c: any) => ({
                  id: c.id,
                  name: c.name,
                }));
            }

            setAssignmentOptions(filteredClasses);
          }
        } else if (roleLower.includes("subject teacher") || roleLower.includes("subject")) {
          // If Subject Teacher, fetch records from Subject database layout and filter strictly by active tier
          const res = await fetchSchoolSubjectsAction(schoolDomain);
          if (isMounted) {
            const rawCourses = res.data || [];
            let filteredSubjects: { id: string; name: string }[] = [];

            // Helper to detect higher institution university course codes like MATH101, CSC201, 200 Level
            const isUniversityCourseCode = (course: any) => {
              const name = (course.name || "").trim();
              const code = (course.code || "").trim().toUpperCase();
              const tierName = (course.tier?.name || "").toLowerCase();
              const hasCurriculumCode =
                /\b[A-Z]{2,4}\s*\d{3}\b/i.test(code) ||
                /\b[A-Z]{2,4}\s*\d{3}\b/i.test(name);
              const hasHigherEdTerms =
                /100\s*level|200\s*level|300\s*level|400\s*level|faculty|polytechnic|university/i.test(name) ||
                tierName.includes("higher") ||
                tierName.includes("university") ||
                tierName.includes("tertiary");
              return hasCurriculumCode || hasHigherEdTerms;
            };

            const isSecondary =
              tierCategory === "SECONDARY" ||
              /secondary|jss|sss|senior|high/i.test(effectiveTier);
            const isPrimary =
              tierCategory === "PRIMARY" ||
              /primary|basic|elementary|nursery|creche/i.test(effectiveTier);

            if (isSecondary) {
              // 1. SECONDARY TIER: Exclude university course codes unless explicitly higher institution
              const dbSecondaryCourses = rawCourses
                .filter((c: any) => {
                  const tierName = (c.tier?.name || "").toLowerCase();
                  return tierName.includes("secondary") || (!tierName && !isUniversityCourseCode(c));
                })
                .map((c: any) => ({
                  id: c.id,
                  // Strip university code suffix like (MATH101) for secondary school display
                  name: c.name,
                }));

              // Baseline standard Nigerian secondary school subjects (Junior & Senior levels)
              const standardSubjects = SECONDARY_EDUCATION_SUBJECTS.map((s) => {
                const existing = dbSecondaryCourses.find(
                  (c: any) => c.name.toLowerCase() === s.toLowerCase()
                );
                return {
                  id: existing ? existing.id : s,
                  name: s,
                };
              });

              // Combine DB secondary courses with standard secondary subjects, eliminating duplicates
              const seenNames = new Set<string>();
              filteredSubjects = [];
              for (const s of [...dbSecondaryCourses, ...standardSubjects]) {
                const lower = s.name.toLowerCase();
                if (!seenNames.has(lower)) {
                  seenNames.add(lower);
                  filteredSubjects.push(s);
                }
              }
            } else if (isPrimary) {
              // 2. PRIMARY TIER: Exclude university course codes (like MATH101) & secondary-only subjects
              const dbPrimaryCourses = rawCourses
                .filter((c: any) => {
                  if (isUniversityCourseCode(c)) return false;
                  const tierName = (c.tier?.name || "").toLowerCase();
                  return tierName.includes("primary") || !tierName;
                })
                .map((c: any) => ({
                  id: c.id,
                  name: c.name,
                }));

              // Baseline standard Nigerian primary school subjects
              const standardSubjects = PRIMARY_EDUCATION_SUBJECTS.map((s) => {
                const existing = dbPrimaryCourses.find(
                  (c: any) => c.name.toLowerCase() === s.toLowerCase()
                );
                return {
                  id: existing ? existing.id : s,
                  name: s,
                };
              });

              const seenNames = new Set<string>();
              filteredSubjects = [];
              for (const s of [...dbPrimaryCourses, ...standardSubjects]) {
                const lower = s.name.toLowerCase();
                if (!seenNames.has(lower)) {
                  seenNames.add(lower);
                  filteredSubjects.push(s);
                }
              }
            } else {
              // 3. TERTIARY / HIGHER INSTITUTION TIER: Expose university courses with codes
              filteredSubjects = rawCourses.map((c: any) => ({
                id: c.id,
                name: c.code ? `${c.name} (${c.code})` : c.name,
              }));
            }

            setAssignmentOptions(filteredSubjects);
          }
        } else {
          // Fallback to department / faculty records
          if (isMounted) {
            setAssignmentOptions(
              (departments || []).map((d: any) => ({
                id: d.id,
                name: d.name,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load assignment options:", err);
        if (isMounted) setAssignmentOptions([]);
      } finally {
        if (isMounted) setIsLoadingOptions(false);
      }
    }

    loadAssignmentOptions();

    return () => {
      isMounted = false;
    };
  }, [createData.role, schoolDomain, departments, tierCategory, effectiveTier]);

  const dynamicAssignmentLabel = useMemo(() => {
    const roleLower = (createData.role || "").toLowerCase();
    if (roleLower.includes("class teacher") || roleLower.includes("form teacher")) {
      return "Class / Section Assigned";
    }
    if (roleLower.includes("subject teacher") || roleLower.includes("subject")) {
      return "Subject Assigned";
    }
    return staffAssignmentLabel;
  }, [createData.role, staffAssignmentLabel]);

  // Real-time search filtered options for Combobox
  const filteredAssignmentOptions = useMemo(() => {
    const q = assignmentSearch.toLowerCase().trim();
    if (!q) return assignmentOptions;
    return assignmentOptions.filter((opt) =>
      opt.name.toLowerCase().includes(q)
    );
  }, [assignmentOptions, assignmentSearch]);

  const selectedAssignmentOption = useMemo(() => {
    return assignmentOptions.find((opt) => opt.id === createData.departmentId);
  }, [assignmentOptions, createData.departmentId]);

  // Refresh roster
  const refreshRoster = (query?: string, role?: string, dept?: string) => {
    const q = query !== undefined ? query : searchQuery;
    const r = role !== undefined ? role : filterRole;
    const d = dept !== undefined ? dept : filterDepartment;

    startTransition(async () => {
      const res = await fetchStaffPaginated(schoolDomain, {
        search: q || undefined,
        role: r !== "ALL" ? r : undefined,
        departmentId: d !== "ALL" ? d : undefined,
        limit: 25,
      });
      if (res?.items) {
        setCurrentStaff(res.items);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      }
    });
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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let finalRole = createData.role;
    if (createData.role === "Other (Type Custom Role...)") {
      const trimmed = customRole.trim();
      if (!trimmed) {
        setFormError("Please enter custom role title.");
        return;
      }
      finalRole = trimmed;
    }

    if (createData.bankAccountNumber && createData.bankAccountNumber.trim()) {
      if (!/^\d{10}$/.test(createData.bankAccountNumber.trim())) {
        setFormError("NUBAN account number must be exactly 10 numerical digits.");
        return;
      }
    }

    if (createData.password.trim() || createData.confirmPassword.trim()) {
      if (createData.password.length < 8) {
        setFormError("Password must be at least 8 characters long.");
        return;
      }
      if (!/[a-zA-Z]/.test(createData.password) || !/[0-9]/.test(createData.password)) {
        setFormError("Password must be alphanumeric (contain at least one letter and at least one number).");
        return;
      }
      if (createData.password !== createData.confirmPassword) {
        setFormError("Account password and confirm password do not match.");
        return;
      }
    }

    startTransition(async () => {
      const res = await createStaff(schoolDomain, {
        ...createData,
        role: finalRole,
        baseSalary: createData.baseSalary ? parseFloat(createData.baseSalary) : null,
      });

      if (res.success) {
        setShowCreateForm(false);
        setCreateData({
          firstName: "",
          lastName: "",
          email: "",
          role: defaultRole,
          status: "ACTIVE",
          departmentId: "",
          baseSalary: "220000",
          bankName: "Zenith Bank",
          bankAccountNumber: "",
          phone: "",
          qualification: "B.Ed (Bachelor of Education)",
          trcnNumber: "",
          trcnStatus: "REGISTERED",
          password: "",
          confirmPassword: "",
        });
        setCustomRole("");
        refreshRoster();
      } else {
        setFormError(res.error || "Failed to create staff member.");
      }
    });
  };

  const handleDeleteStaff = async (staffId: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate and remove staff member "${name}"?`)) return;

    startTransition(async () => {
      const res = await deleteStaff(schoolDomain, staffId);
      if (res?.success) {
        setCurrentStaff((prev) => prev.filter((s) => s.id !== staffId));
      } else {
        alert(res?.error || "Failed to remove staff member.");
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
                    {TERTIARY_ACADEMIC_STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Non-Academic Staff Roles">
                    {TERTIARY_NON_ACADEMIC_STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                </>
              ) : (
                activeRolesList.map((r) => (
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
            {/* DEPARTMENTS BUTTON */}
            <button
              onClick={() => setIsDeptModalOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>{staffAssignmentLabel} ({departments.length})</span>
            </button>

            {/* ADD STAFF BUTTON */}
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Onboard New Staff</span>
            </button>
          </div>
        </div>
      </div>

      {/* CREATE STAFF INLINE FORM / MODAL */}
      {showCreateForm && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Onboard New Staff Member</h4>
              <p className="text-xs text-slate-500">Record biographical details, TRCN credentials, and bank account for payroll.</p>
            </div>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">First Name</label>
              <input
                type="text"
                required
                value={createData.firstName}
                onChange={(e) => setCreateData({ ...createData, firstName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Last Name</label>
              <input
                type="text"
                required
                value={createData.lastName}
                onChange={(e) => setCreateData({ ...createData, lastName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={createData.email}
                onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Role / Designation</label>
              <select
                value={createData.role}
                onChange={(e) => setCreateData({ ...createData, role: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
                required
              >
                {activeRolesList.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Searchable Subject / Class Assigned Combobox */}
            <div ref={assignmentDropdownRef} className="relative">
              <label className="block font-semibold text-slate-600 mb-1 flex items-center justify-between">
                <span>{dynamicAssignmentLabel}</span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  {tierCategory === "SECONDARY" ? "Secondary School" : tierCategory === "PRIMARY" ? "Primary School" : tierBadgeLabel}
                </span>
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setAssignmentDropdownOpen((o) => !o);
                    setAssignmentSearch("");
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white text-xs flex items-center justify-between text-left focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <span className={selectedAssignmentOption ? "text-slate-800 font-semibold truncate" : "text-slate-400"}>
                    {isLoadingOptions
                      ? "Loading records..."
                      : selectedAssignmentOption
                      ? selectedAssignmentOption.name
                      : `-- Select ${dynamicAssignmentLabel} --`}
                  </span>
                  <span className="text-slate-400 text-xs ml-2">&#9660;</span>
                </button>

                {assignmentDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-in fade-in-50 duration-150">
                    {/* Sticky search input at top */}
                    <div className="sticky top-0 p-2 bg-slate-50 border-b border-slate-100 z-10">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          autoFocus
                          type="text"
                          value={assignmentSearch}
                          onChange={(e) => setAssignmentSearch(e.target.value)}
                          placeholder={`Search ${dynamicAssignmentLabel.toLowerCase()}...`}
                          className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                        />
                      </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                      {/* Optional clear selection option */}
                      <div
                        onClick={() => {
                          setCreateData({ ...createData, departmentId: "" });
                          setAssignmentDropdownOpen(false);
                          setAssignmentSearch("");
                        }}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-50 cursor-pointer italic transition"
                      >
                        -- Unassigned / Clear --
                      </div>

                      {filteredAssignmentOptions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          {isLoadingOptions ? "Loading records..." : "No matching items found."}
                        </div>
                      ) : (
                        filteredAssignmentOptions.map((opt) => (
                          <div
                            key={opt.id}
                            onClick={() => {
                              setCreateData({ ...createData, departmentId: opt.id });
                              setAssignmentDropdownOpen(false);
                              setAssignmentSearch("");
                            }}
                            className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition ${
                              createData.departmentId === opt.id
                                ? "bg-indigo-50 font-bold text-indigo-700"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span>{opt.name}</span>
                            {createData.departmentId === opt.id && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Telephone Phone</label>
              <input
                type="tel"
                placeholder="+234 803 123 4567"
                value={createData.phone}
                onChange={(e) => setCreateData({ ...createData, phone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Highest Qualification</label>
              <select
                value={createData.qualification}
                onChange={(e) => setCreateData({ ...createData, qualification: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
              >
                {QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">TRCN License No.</label>
              <input
                type="text"
                placeholder="e.g. TRCN/LA/2024/..."
                value={createData.trcnNumber}
                onChange={(e) => setCreateData({ ...createData, trcnNumber: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Base Monthly Salary (₦)</label>
              <input
                type="number"
                placeholder="220000"
                value={createData.baseSalary}
                onChange={(e) => setCreateData({ ...createData, baseSalary: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white font-mono"
              />
            </div>
            {/* Searchable Bank Dropdown */}
            <div ref={bankCreateDropdownRef}>
              <label className="block font-semibold text-slate-600 mb-1">Bank Name</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setBankCreateDropdownOpen((o) => !o); setBankCreateSearch(""); }}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white text-xs flex items-center justify-between text-left"
                >
                  <span>{createData.bankName || "Select bank..."}</span>
                  <span className="text-slate-400 text-xs">&#9660;</span>
                </button>

                {bankCreateDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                    <div className="p-1.5 border-b border-slate-100">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          autoFocus
                          type="text"
                          value={bankCreateSearch}
                          onChange={(e) => setBankCreateSearch(e.target.value)}
                          placeholder="Search bank..."
                          className="w-full pl-6 pr-2 py-1 text-xs rounded border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <ul className="max-h-48 overflow-y-auto">
                      {filteredCreateBanks.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-slate-400 text-center">No banks found.</li>
                      ) : (
                        filteredCreateBanks.map((b) => (
                          <li
                            key={b}
                            onClick={() => {
                              setCreateData({ ...createData, bankName: b });
                              setBankCreateDropdownOpen(false);
                              setBankCreateSearch("");
                            }}
                            className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-indigo-50 transition ${
                              createData.bankName === b
                                ? "bg-indigo-50 font-bold text-indigo-700"
                                : "text-slate-700"
                            }`}
                          >
                            {b}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Account No. (NUBAN)</label>
              <input
                type="text"
                maxLength={10}
                placeholder="0123456789"
                value={createData.bankAccountNumber}
                onChange={(e) => setCreateData({ ...createData, bankAccountNumber: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white font-mono"
              />
            </div>

            {/* Staff Account Password Fields */}
            <div className="md:col-span-4 border-t border-slate-200/80 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Staff Account Credentials
                </span>
                <span className="text-[10px] text-slate-400">
                  (Default temporary password: <strong>Welcome123</strong> with forced reset on initial login)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Set Default Account Password</label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showCreatePassword ? "text" : "password"}
                      placeholder="Set Default Account Password or leave blank for Welcome123"
                      value={createData.password}
                      onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 pr-9 font-medium bg-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showCreatePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      name="confirmPassword"
                      type={showCreateConfirmPassword ? "text" : "password"}
                      placeholder="Confirm account password"
                      value={createData.confirmPassword}
                      onChange={(e) => setCreateData({ ...createData, confirmPassword: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 pr-9 font-medium bg-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreateConfirmPassword(!showCreateConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showCreateConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Validation Badges */}
              {(createData.password.length > 0 || createData.confirmPassword.length > 0) && (
                <div className="flex flex-wrap items-center gap-3 text-[11px] pt-2">
                  <span className={`inline-flex items-center gap-1 ${
                    createData.password.length >= 8 ? "text-emerald-600 font-bold" : "text-slate-400"
                  }`}>
                    {createData.password.length >= 8 ? "✓" : "•"} Min. 8 characters
                  </span>
                  <span className={`inline-flex items-center gap-1 ${
                    (/[a-zA-Z]/.test(createData.password) && /[0-9]/.test(createData.password)) ? "text-emerald-600 font-bold" : "text-slate-400"
                  }`}>
                    {(/[a-zA-Z]/.test(createData.password) && /[0-9]/.test(createData.password)) ? "✓" : "•"} Alphanumeric
                  </span>
                  {createData.confirmPassword.length > 0 && (
                    <span className={`inline-flex items-center gap-1 font-bold ${
                      createData.password === createData.confirmPassword ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      {createData.password === createData.confirmPassword ? "✓ Passwords match" : "⚠ Passwords do not match"}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition"
              >
                {isPending ? "Onboarding..." : "Onboard Staff Member"}
              </button>
            </div>
          </form>
        </div>
      )}

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
                            title="Deactivate Staff"
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
      />

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
