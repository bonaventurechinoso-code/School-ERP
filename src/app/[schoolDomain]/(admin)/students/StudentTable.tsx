"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Student, AcademicTier } from "@prisma/client";
import { 
  createStudent, 
  updateStudent, 
  deleteStudent, 
  updateStudentStatus, 
  bulkGraduateClass, 
  bulkGraduateStudents, 
  fetchStudentsPaginated,
  fetchStudentMetrics,
  toggleStudentSuspension,
  graduateTierCohort,
  executeTermEndPromotionAction
} from "./actions";
import { useTenant } from "@/lib/tenant-context";
import StudentProfileDrawer from "./StudentProfileDrawer";
import { User, X, GraduationCap, ShieldAlert } from "lucide-react";

type StudentWithTier = Student & { tier?: AcademicTier | null };

export interface StudentMetricsData {
  totalEnrolled: number;
  suspendedStudents: number;
  alumniCount: number;
  activeProspects: number;
  totalApplicants: number;
}

interface StudentTableProps {
  students: StudentWithTier[];
  initialNextCursor?: string | null;
  initialHasMore?: boolean;
  schoolId: string;
  tiers: AcademicTier[];
  activeTier?: string;
  classrooms?: Array<{ id: string; name: string }>;
  initialMetrics?: StudentMetricsData;
}

export function matchesClass(studentClass?: string | null, targetClass?: string): boolean {
  if (!targetClass || targetClass === "ALL") return true;
  if (!studentClass) return false;
  const sNorm = studentClass.trim().toLowerCase();
  const tNorm = targetClass.trim().toLowerCase();
  if (sNorm === tNorm) return true;

  // Word boundary or prefix match (e.g., "Class 1" matches "Class 1 Gold", "Class 1A", but not "Class 10")
  const escaped = tNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\b)${escaped}(\\b|[^0-9]|$)`, "i");
  if (pattern.test(sNorm)) return true;

  // Check aliases like Class 1 <-> Primary 1 <-> Basic 1
  const tClassNum = tNorm.match(/\d+/)?.[0];
  const sClassNum = sNorm.match(/\d+/)?.[0];
  if (tClassNum && sClassNum && tClassNum === sClassNum) {
    if (
      (tNorm.includes("class") || tNorm.includes("primary") || tNorm.includes("basic")) &&
      (sNorm.includes("class") || sNorm.includes("primary") || sNorm.includes("basic"))
    ) {
      return true;
    }
  }

  return false;
}

export function getClassOptionsForTier(
  activeTierName?: string,
  tiersList: AcademicTier[] = [],
  classroomsList: Array<{ id: string; name: string }> = []
): string[] {
  let tierIdentifier = (activeTierName || "").trim().toLowerCase();

  // If activeTierName matches a tier ID or name in tiersList, use that tier's name
  const matchingTier = tiersList.find(
    (t) => t.id === activeTierName || t.name.toLowerCase() === activeTierName?.toLowerCase()
  );
  if (matchingTier) {
    tierIdentifier = matchingTier.name.toLowerCase();
  } else if ((!tierIdentifier || tierIdentifier === "all") && tiersList.length > 0) {
    tierIdentifier = tiersList[0].name.toLowerCase();
  }

  // 1. Daycare / Nursery
  if (
    tierIdentifier.includes("nursery") ||
    tierIdentifier.includes("daycare") ||
    tierIdentifier.includes("creche") ||
    tierIdentifier.includes("early") ||
    tierIdentifier.includes("preschool") ||
    tierIdentifier.includes("kindergarten")
  ) {
    return ["Creche", "Pre-Nursery", "Nursery 1", "Nursery 2"];
  }

  // 2. Primary School
  if (
    tierIdentifier.includes("primary") ||
    tierIdentifier.includes("elementary") ||
    tierIdentifier.includes("basic")
  ) {
    return ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6"];
  }

  // 3. Secondary School
  if (
    tierIdentifier.includes("secondary") ||
    tierIdentifier.includes("high") ||
    tierIdentifier.includes("junior") ||
    tierIdentifier.includes("senior") ||
    tierIdentifier.includes("jss") ||
    tierIdentifier.includes("sss") ||
    tierIdentifier.includes("college")
  ) {
    return ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"];
  }

  // If tierIdentifier is "all" and multiple tiers exist, aggregate across tiers
  if (tierIdentifier === "all" && tiersList.length > 1) {
    const combined: string[] = [];
    tiersList.forEach((t) => {
      const opts = getClassOptionsForTier(t.name, [], []);
      opts.forEach((o) => {
        if (!combined.includes(o)) combined.push(o);
      });
    });
    if (combined.length > 0) return combined;
  }

  // Fallback: If classrooms provided, use their unique names; otherwise default to Primary classes
  if (classroomsList && classroomsList.length > 0) {
    return Array.from(new Set(classroomsList.map((c) => c.name)));
  }

  return ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6"];
}

export function getGraduatingClassForTier(
  activeTierName?: string,
  tiersList: AcademicTier[] = [],
  classroomsList: Array<{ id: string; name: string }> = []
): { primaryClass: string; aliases: string[] } {
  const options = getClassOptionsForTier(activeTierName, tiersList, classroomsList);
  const highest = options[options.length - 1] || "Class 6";

  const aliases: string[] = [highest];
  if (highest.toLowerCase().startsWith("class ")) {
    aliases.push(highest.replace(/class\s+/i, "Primary "));
    aliases.push(highest.replace(/class\s+/i, "Basic "));
  } else if (highest.toLowerCase().startsWith("primary ")) {
    aliases.push(highest.replace(/primary\s+/i, "Class "));
  }
  return { primaryClass: highest, aliases };
}

export default function StudentTable({ 
  students, 
  initialNextCursor,
  initialHasMore,
  schoolId,
  tiers,
  activeTier,
  classrooms = [],
  initialMetrics,
}: StudentTableProps) {
  const [isPending, startTransition] = useTransition();
  const tenant = useTenant();

  const [studentList, setStudentList] = useState<StudentWithTier[]>(students);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore ?? false);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const [showForm, setShowForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithTier | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [showBulkGraduate, setShowBulkGraduate] = useState(false);
  const [bulkClass, setBulkClass] = useState("");
  const [repeatingStudentIds, setRepeatingStudentIds] = useState<string[]>([]);
  const [repeaterSearch, setRepeaterSearch] = useState("");
  const [formData, setFormData] = useState({ 
    firstName: "", 
    lastName: "", 
    email: "", 
    status: "ENROLLED", 
    tierId: "", 
    currentClass: "",
    admissionNumber: "",
    dateOfBirth: "",
    stateOfOrigin: "",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    dynamicFields: {} as Record<string, any> 
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const classOptions = getClassOptionsForTier(activeTier, tiers, classrooms);
  const graduatingInfo = getGraduatingClassForTier(activeTier, tiers, classrooms);
  const targetGraduatingClass = bulkClass || (filterClass !== "ALL" ? filterClass : graduatingInfo.primaryClass);

  const [metrics, setMetrics] = useState<StudentMetricsData>(
    initialMetrics || {
      totalEnrolled: students.filter((s) => s.status === "ENROLLED").length,
      suspendedStudents: students.filter((s) => s.status === "SUSPENDED").length,
      alumniCount: students.filter((s) => s.status === "ALUMNI").length,
      activeProspects: 0,
      totalApplicants: 0,
    }
  );

  const refreshMetrics = async () => {
    try {
      const res = await fetchStudentMetrics(schoolId, activeTier);
      if (res.success) {
        setMetrics((prev) => ({
          ...prev,
          totalEnrolled: res.totalEnrolled,
          suspendedStudents: res.suspendedStudents,
          alumniCount: res.alumniCount,
        }));
      }
    } catch {}
  };

  useEffect(() => {
    if (initialMetrics) {
      setMetrics(initialMetrics);
    }
  }, [initialMetrics]);

  useEffect(() => {
    setFilterClass("ALL");
  }, [activeTier]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const openCreateForm = () => {
    setEditingStudentId(null);
    const matchingTier = tiers.find(t => 
      activeTier && (t.name.toLowerCase() === activeTier.toLowerCase() || t.name.toLowerCase().includes(activeTier.toLowerCase()))
    ) || (tiers.length > 0 ? tiers[0] : null);

    const initialTierClasses = getClassOptionsForTier(matchingTier?.name, tiers, classrooms);

    setFormData({ 
      firstName: "", 
      lastName: "", 
      email: "", 
      status: "ENROLLED", 
      tierId: matchingTier ? matchingTier.id : (tiers.length > 0 ? tiers[0].id : ""), 
      currentClass: initialTierClasses[0] || (classrooms.length > 0 ? classrooms[0].name : ""),
      admissionNumber: "",
      dateOfBirth: "",
      stateOfOrigin: "",
      parentName: "",
      parentPhone: "",
      parentEmail: "",
      dynamicFields: {} 
    });
    setShowForm(true);
  };

  const openEditForm = (student: StudentWithTier) => {
    setEditingStudentId(student.id);
    let parsedFields = {};
    if (student.dynamicFields && typeof student.dynamicFields === "object") {
      parsedFields = student.dynamicFields;
    }
    setFormData({ 
      firstName: student.firstName, 
      lastName: student.lastName, 
      email: student.email || "", 
      status: student.status,
      tierId: student.tierId,
      currentClass: student.currentClass || "",
      admissionNumber: student.admissionNumber || "",
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split("T")[0] : "",
      stateOfOrigin: student.stateOfOrigin || "",
      parentName: student.parentName || "",
      parentPhone: student.parentPhone || "",
      parentEmail: (student as any).parentEmail || "",
      dynamicFields: parsedFields
    });
    setShowForm(true);
  };

  const handleDynamicFieldChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      dynamicFields: { ...prev.dynamicFields, [key]: value }
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      const payload = {
        ...formData,
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : undefined,
        currentClass: formData.currentClass || undefined,
        admissionNumber: formData.admissionNumber || undefined,
        stateOfOrigin: formData.stateOfOrigin || undefined,
        parentEmail: formData.parentEmail || undefined,
        dynamicFields: formData.dynamicFields
      };
      
      let res;
      if (editingStudentId) {
        res = await updateStudent(schoolId, editingStudentId, payload, activeTier);
      } else {
        res = await createStudent(schoolId, payload, activeTier);
      }
      
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setShowForm(false);
        if (editingStudentId) {
          const chosenTier = tiers.find(t => t.id === formData.tierId);
          setStudentList(prev => prev.map(s => {
            if (s.id === editingStudentId) {
              return {
                ...s,
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                currentClass: formData.currentClass,
                tierId: formData.tierId,
                tier: chosenTier || s.tier,
                status: formData.status,
                admissionNumber: formData.admissionNumber,
                stateOfOrigin: formData.stateOfOrigin,
                dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : null,
                parentName: formData.parentName,
                parentPhone: formData.parentPhone,
                dynamicFields: formData.dynamicFields
              };
            }
            return s;
          }));
        }
        setEditingStudentId(null);
        await refreshMetrics();
      }
    });
  };

  const handleDelete = async (studentId: string) => {
    if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
      startTransition(async () => {
        const res = await deleteStudent(schoolId, studentId, activeTier);
        if (res?.error) {
          alert(res.error);
        } else {
          setStudentList(prev => prev.filter(s => s.id !== studentId));
          await refreshMetrics();
        }
      });
    }
  };

  const handleUpdateStatus = (studentId: string, newStatus: string) => {
    setStudentList(prev => prev.map(s => s.id === studentId ? { ...s, status: newStatus } : s));
    startTransition(async () => {
      await updateStudentStatus(schoolId, studentId, newStatus, activeTier);
      await refreshMetrics();
    });
  };

  const handleToggleSuspend = async (student: StudentWithTier) => {
    const isCurrentlySuspended = student.status === "SUSPENDED";
    const confirmPrompt = isCurrentlySuspended
      ? `Reinstate ${student.firstName} ${student.lastName}? This will restore their active status and re-enable portal credentials.`
      : `Are you sure you want to suspend ${student.firstName} ${student.lastName}? This will deactivate their portal login credentials and flag them as SUSPENDED.`;

    if (!confirm(confirmPrompt)) return;

    const optimisticStatus = isCurrentlySuspended ? "ENROLLED" : "SUSPENDED";
    setStudentList((prev) =>
      prev.map((s) => (s.id === student.id ? { ...s, status: optimisticStatus } : s))
    );

    setMetrics((prev) => ({
      ...prev,
      totalEnrolled: isCurrentlySuspended ? prev.totalEnrolled + 1 : Math.max(0, prev.totalEnrolled - 1),
      suspendedStudents: isCurrentlySuspended ? Math.max(0, prev.suspendedStudents - 1) : prev.suspendedStudents + 1,
    }));

    startTransition(async () => {
      const res = await toggleStudentSuspension(schoolId, student.id, activeTier);
      if (res?.error) {
        alert(res.error);
        setStudentList((prev) =>
          prev.map((s) => (s.id === student.id ? { ...s, status: student.status } : s))
        );
      }
      await refreshMetrics();
    });
  };

  const handleClassFilterChange = (newClass: string) => {
    setFilterClass(newClass);
    setCursorHistory([]);
    setPageIndex(0);
    startTransition(async () => {
      const res = await fetchStudentsPaginated(schoolId, {
        tierName: activeTier,
        status: "ENROLLED",
        className: newClass !== "ALL" ? newClass : undefined,
        cursor: null,
        limit: 25,
      });
      setStudentList(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    });
  };

  const handleNextPage = () => {
    if (!nextCursor || isPending) return;
    const currentCursor = nextCursor;
    startTransition(async () => {
      const res = await fetchStudentsPaginated(schoolId, {
        tierName: activeTier,
        status: "ENROLLED",
        className: filterClass !== "ALL" ? filterClass : undefined,
        cursor: currentCursor,
        limit: 25,
      });
      setCursorHistory(prev => [...prev, currentCursor]);
      setStudentList(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setPageIndex(prev => prev + 1);
    });
  };

  const handlePrevPage = () => {
    if (pageIndex === 0 || isPending) return;
    const newHistory = [...cursorHistory];
    newHistory.pop();
    const targetCursor = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
    startTransition(async () => {
      const res = await fetchStudentsPaginated(schoolId, {
        tierName: activeTier,
        status: "ENROLLED",
        className: filterClass !== "ALL" ? filterClass : undefined,
        cursor: targetCursor,
        limit: 25,
      });
      setCursorHistory(newHistory);
      setStudentList(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setPageIndex(prev => Math.max(0, prev - 1));
    });
  };

  const filteredStudents = studentList.filter(s => {
    if (filterClass !== "ALL" && !matchesClass(s.currentClass, filterClass)) return false;
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map(s => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkGraduate = async () => {
    if (selectedIds.length > 0) {
      if (confirm(`Are you sure you want to graduate ${selectedIds.length} selected students to Alumni?`)) {
        startTransition(async () => {
          const res = await bulkGraduateStudents(schoolId, selectedIds, activeTier);
          if (res?.error) alert(res.error);
          else {
            setStudentList((prev) =>
              prev.map((s) => (selectedIds.includes(s.id) ? { ...s, status: "ALUMNI", alumniAt: new Date() } : s))
            );
            setSelectedIds([]);
            setShowBulkGraduate(false);
            await refreshMetrics();
          }
        });
      }
    } else {
      if (confirm(`Are you sure you want to graduate all active (Enrolled) students in ${targetGraduatingClass}? This will safely transition them to 'Alumni'.`)) {
        startTransition(async () => {
          const res = await graduateTierCohort(schoolId, activeTier, targetGraduatingClass);
          if (!res.success) {
            alert(res.error || "Failed to graduate cohort.");
          } else {
            setStudentList((prev) =>
              prev.map((s) => {
                if (matchesClass(s.currentClass, targetGraduatingClass) && s.status === "ENROLLED") {
                  return { ...s, status: "ALUMNI", alumniAt: new Date() };
                }
                return s;
              })
            );
            setShowBulkGraduate(false);
            await refreshMetrics();
            alert(`Successfully graduated ${res.count} student(s) in ${targetGraduatingClass} to Alumni.`);
          }
        });
      }
    }
  };

  const handleExecuteTermEndPromotion = async () => {
    startTransition(async () => {
      const res = await executeTermEndPromotionAction(schoolId, {
        tierName: activeTier,
        repeatingStudentIds,
      });

      if (!res.success) {
        alert(res.error || "Failed to execute term-end promotion.");
      } else {
        const freshList = await fetchStudentsPaginated(schoolId, {
          tierName: activeTier,
          status: "ENROLLED",
          className: filterClass !== "ALL" ? filterClass : undefined,
          limit: 25,
        });
        setStudentList(freshList.items);
        setNextCursor(freshList.nextCursor);
        setHasMore(freshList.hasMore);
        setShowBulkGraduate(false);
        setRepeatingStudentIds([]);
        await refreshMetrics();

        const summaryLines = (res.summary || [])
          .map((s) => `  • ${s.fromClass} ➔ ${s.toClass}: ${s.count} student(s)`)
          .join("\n");

        alert(
          `🎉 Term-End Processing Completed Successfully!\n\n` +
          `• Total Promoted: ${res.promotedCount} student(s)\n` +
          `• Graduated to Alumni: ${res.graduatedCount} student(s)\n` +
          `• Repeating Current Grade: ${res.repeatedCount} student(s)\n\n` +
          (summaryLines ? `Progression Summary:\n${summaryLines}` : "")
        );
      }
    });
  };

  // Dynamic field definitions based on Tier keywords
  const getDynamicFieldsForTier = (tierId: string) => {
    const tier = tiers.find(t => t.id === tierId);
    if (!tier) return [];
    
    const name = tier.name.toLowerCase();
    if (name.includes("daycare") || name.includes("nursery")) {
      return [
        { key: "pottyTrained", label: "Potty Trained?", type: "select", options: ["Yes", "No", "In Progress"] },
        { key: "allergies", label: "Allergies", type: "text" }
      ];
    }
    if (name.includes("high") || name.includes("secondary")) {
      return [
        { key: "previousSchool", label: "Previous School", type: "text" },
        { key: "extracurricular", label: "Extracurricular Interests", type: "text" }
      ];
    }
    if (name.includes("higher") || name.includes("university") || name.includes("college")) {
      return [
        { key: "previousDegree", label: "Previous Degree", type: "text" },
        { key: "major", label: "Declared Major/Program", type: "text" }
      ];
    }
    // Default elementary/middle
    return [
      { key: "medicalNotes", label: "Medical Notes", type: "text" }
    ];
  };

  const currentDynamicFields = getDynamicFieldsForTier(formData.tierId);

  const selectedTier = tiers.find(t => t.id === formData.tierId);
  const formClassOptions = getClassOptionsForTier(selectedTier?.name, tiers, classrooms);

  let bulkActionLabel = "Graduate Selected";
  let bulkActionGlobalLabel = "Graduate Class / Term-End Processing";

  const currentBulkLabel = selectedIds.length > 0 ? `${bulkActionLabel} (${selectedIds.length})` : bulkActionGlobalLabel;

  const getLadderForTier = (tierName?: string) => {
    const t = (tierName || "").toLowerCase();
    if (t.includes("secondary") || t.includes("high") || t.includes("senior") || t.includes("college")) {
      return ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3", "Alumni (Class Slot Cleared)"];
    }
    if (t.includes("nursery") || t.includes("daycare") || t.includes("creche") || t.includes("early")) {
      return ["Creche", "Pre-Nursery", "Nursery 1", "Nursery 2", "Alumni (Class Slot Cleared)"];
    }
    return ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Alumni (Class Slot Cleared)"];
  };

  return (
    <div className="space-y-6">

      {/* Dynamic Metric Overview Blocks */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-emerald-500 min-w-0 transition-all hover:shadow-md">
          <h3 className="text-slate-700 dark:text-zinc-300 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider mb-1.5 truncate">Total Enrolled</h3>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-none truncate">{metrics.totalEnrolled}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-amber-500 min-w-0 transition-all hover:shadow-md">
          <h3 className="text-slate-700 dark:text-zinc-300 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider mb-1.5 truncate">Active Prospects</h3>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-none truncate">{metrics.activeProspects}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-indigo-500 min-w-0 transition-all hover:shadow-md">
          <h3 className="text-slate-700 dark:text-zinc-300 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider mb-1.5 truncate">Total Applicants</h3>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-none truncate">{metrics.totalApplicants}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-rose-500 min-w-0 transition-all hover:shadow-md">
          <h3 className="text-slate-700 dark:text-zinc-300 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider mb-1.5 truncate">Suspended</h3>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-none truncate">{metrics.suspendedStudents}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-blue-500 min-w-0 col-span-2 sm:col-span-1 transition-all hover:shadow-md">
          <h3 className="text-slate-700 dark:text-zinc-300 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider mb-1.5 truncate">Alumni</h3>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-none truncate">{metrics.alumniCount}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
          <label htmlFor="filter-by-class" className="text-sm font-medium text-slate-700 dark:text-zinc-300">Filter by Class:</label>
          <select 
            id="filter-by-class"
            className="border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-sm bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 w-full sm:w-auto min-w-[200px]"
            value={filterClass}
            onChange={(e) => handleClassFilterChange(e.target.value)}
          >
            <option value="ALL">All Classes</option>
            {classOptions.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button 
            onClick={() => {
              if (filterClass !== "ALL") setBulkClass(filterClass);
              else setBulkClass(graduatingInfo.primaryClass);
              setShowBulkGraduate(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-medium rounded-lg shadow-sm hover:bg-slate-300 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-2"
          >
            <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{currentBulkLabel}</span>
          </button>
          {(tenant.userRole === "ADMIN" || tenant.userRole === "REGISTRAR") && (
            <button 
              onClick={showForm ? () => setShowForm(false) : openCreateForm}
              className="w-full sm:w-auto px-4 py-2 text-white font-medium rounded-lg shadow-sm transition"
              style={{ backgroundColor: tenant.branding.primaryColor }}
            >
              Add Student
            </button>
          )}
        </div>
      </div>

      {/* Slide-Over Administrative Side Panel for Edit / Create */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm animate-in fade-in" onClick={() => setShowForm(false)}>
          <div 
            className="w-full max-w-2xl bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {editingStudentId ? "Edit Student Bio-Data & Tier" : "Enroll New Student"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                    {editingStudentId ? `${formData.firstName} ${formData.lastName} • ${formData.admissionNumber || "No ID"}` : "Register student into the active roster"}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Form Body (Scrollable) */}
            <form id="student-edit-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-sm font-medium border border-red-200 dark:border-red-900">
                  {errorMsg}
                </div>
              )}

              {/* 1. Academic Placement & Tier */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2">
                  <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Academic Placement & Tier
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Assigned Academic Tier *</label>
                    <select 
                      required
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500" 
                      value={formData.tierId} 
                      onChange={e => {
                        const newTierId = e.target.value;
                        const newTier = tiers.find(t => t.id === newTierId);
                        const newTierClasses = getClassOptionsForTier(newTier?.name, tiers, classrooms);
                        setFormData({
                          ...formData, 
                          tierId: newTierId, 
                          currentClass: newTierClasses[0] || "",
                          dynamicFields: {}
                        });
                      }}
                    >
                      <option value="" disabled>Select a Tier</option>
                      {tiers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Classroom / Grade *</label>
                    <select 
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500"
                      value={formData.currentClass} 
                      onChange={e => setFormData({...formData, currentClass: e.target.value})}
                    >
                      <option value="">Select Class...</option>
                      {formClassOptions.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Lifecycle Status</label>
                    <select 
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500" 
                      value={formData.status} 
                      onChange={e => setFormData({...formData, status: e.target.value})}
                    >
                      <option value="ENROLLED">Enrolled (Active)</option>
                      <option value="PROSPECT">Prospect</option>
                      <option value="APPLICANT">Applicant</option>
                      <option value="SCREENED">Screened</option>
                      <option value="SUSPENDED">Suspended (Portal Deactivated)</option>
                      <option value="EXPELLED">Expelled</option>
                      <option value="ALUMNI">Alumni (Graduated)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Student Bio-Data */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Student Bio-Data
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">First Name *</label>
                    <input 
                      required 
                      type="text" 
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500" 
                      value={formData.firstName} 
                      onChange={e => setFormData({...formData, firstName: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Last Name *</label>
                    <input 
                      required 
                      type="text" 
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500" 
                      value={formData.lastName} 
                      onChange={e => setFormData({...formData, lastName: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Student Email</label>
                    <input 
                      type="email" 
                      placeholder="student@school.org"
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500" 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Admission Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g., ADM-2026-001"
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500" 
                      value={formData.admissionNumber} 
                      onChange={e => setFormData({...formData, admissionNumber: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Date of Birth</label>
                    <input 
                      type="date" 
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500" 
                      value={formData.dateOfBirth} 
                      onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">State / Region of Origin</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Lagos, Anambra, Ontario"
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500" 
                      value={formData.stateOfOrigin} 
                      onChange={e => setFormData({...formData, stateOfOrigin: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              {/* 3. Guardian Profile */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    👪 Guardian Profile & Contact
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Guardian Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Ike Mmadu"
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500" 
                      value={formData.parentName} 
                      onChange={e => setFormData({...formData, parentName: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Guardian Phone</label>
                    <input 
                      type="tel"
                      placeholder="+234..."
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500" 
                      value={formData.parentPhone} 
                      onChange={e => setFormData({...formData, parentPhone: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              {/* 4. Tier-Specific Dynamic Fields */}
              {currentDynamicFields.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                      ⚙️ Tier-Specific Details
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentDynamicFields.map(field => (
                      <div key={field.key}>
                        <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">{field.label}</label>
                        {field.type === "select" ? (
                          <select 
                            className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500"
                            value={formData.dynamicFields[field.key] || ""}
                            onChange={(e) => handleDynamicFieldChange(field.key, e.target.value)}
                          >
                            <option value="">Select...</option>
                            {field.options?.map(o => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input 
                            type="text" 
                            className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500"
                            value={formData.dynamicFields[field.key] || ""}
                            onChange={(e) => handleDynamicFieldChange(field.key, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>

            {/* Sticky Drawer Footer */}
            <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button 
                form="student-edit-form"
                disabled={isPending}
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 transition flex items-center gap-2"
              >
                {isPending ? "Saving Changes..." : editingStudentId ? "Update Student" : "Save Student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Select All & Count Bar */}
      {filteredStudents.length > 0 && (
        <div className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-slate-100 dark:bg-zinc-800/80 rounded-xl text-xs font-medium text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input 
              type="checkbox" 
              className="rounded border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              checked={selectedIds.length === filteredStudents.length && filteredStudents.length > 0}
              onChange={toggleSelectAll}
            />
            <span className="font-semibold">Select All ({filteredStudents.length} Students)</span>
          </label>
          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{selectedIds.length} selected</span>
        </div>
      )}

      {/* DESKTOP TABLE VIEW (md+) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 w-12">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  checked={selectedIds.length === filteredStudents.length && filteredStudents.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-6 py-4 font-semibold">Student ID</th>
              <th className="px-6 py-4 font-semibold">Student Name</th>
              <th className="px-6 py-4 font-semibold">Current Class</th>
              <th className="px-6 py-4 font-semibold">Guardian Name</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-zinc-500 text-base italic">
                  No students found in the roster.
                </td>
              </tr>
            )}
            {filteredStudents.map((student) => (
              <tr 
                key={student.id} 
                className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                onClick={() => setSelectedStudent(student)}
              >
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    checked={selectedIds.includes(student.id)}
                    onChange={() => toggleSelect(student.id)}
                  />
                </td>
                <td className="px-6 py-4 font-mono text-sm text-slate-600 dark:text-zinc-400">
                  {student.admissionNumber || "N/A"}
                </td>
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                  {student.firstName} {student.lastName}
                </td>
                <td className="px-6 py-4 text-slate-600 dark:text-zinc-300">
                  {student.currentClass || student.tier?.name || "—"}
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-zinc-400">{student.parentName || "—"}</td>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <select 
                    disabled={isPending}
                    value={student.status}
                    onChange={(e) => handleUpdateStatus(student.id, e.target.value)}
                    className={`border rounded-lg p-1.5 text-xs font-bold outline-none transition-colors cursor-pointer
                      ${student.status === "ENROLLED" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" : ""}
                      ${["SUSPENDED", "EXPELLED"].includes(student.status) ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20" : ""}
                      ${student.status === "ALUMNI" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" : ""}
                    `}
                  >
                    <option value="ENROLLED">Enrolled</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="EXPELLED">Expelled</option>
                    <option value="ALUMNI">Alumni</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center gap-1.5">
                    <button 
                      disabled={isPending}
                      onClick={() => openEditForm(student)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200/60 dark:border-indigo-800/60 transition"
                    >
                      Edit
                    </button>
                    <button 
                      disabled={isPending}
                      onClick={() => handleToggleSuspend(student)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                        student.status === "SUSPENDED"
                          ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                          : "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                      }`}
                    >
                      {student.status === "SUSPENDED" ? "Reinstate" : "Suspend"}
                    </button>
                    <button 
                      disabled={isPending}
                      onClick={() => handleDelete(student.id)}
                      className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                      title="Delete Student"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARDS VIEW (< md) - Zero Features Dropped */}
      <div className="md:hidden space-y-3.5">
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-zinc-500 italic bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            No students found in the roster matching this filter.
          </div>
        ) : (
          filteredStudents.map((student) => (
            <div 
              key={student.id} 
              className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-3 transition-shadow hover:shadow-md"
            >
              {/* Card Header: Checkbox, Name, and Status Selector */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="pt-0.5">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      checked={selectedIds.includes(student.id)}
                      onChange={() => toggleSelect(student.id)}
                    />
                  </div>
                  <div className="min-w-0 cursor-pointer" onClick={() => setSelectedStudent(student)}>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      {student.firstName} {student.lastName}
                    </h4>
                    <p className="font-mono text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      ID: {student.admissionNumber || "Not Assigned"}
                    </p>
                  </div>
                </div>

                {/* Status Dropdown */}
                <div className="shrink-0">
                  <select 
                    disabled={isPending}
                    value={student.status}
                    onChange={(e) => handleUpdateStatus(student.id, e.target.value)}
                    className={`border rounded-lg px-2 py-1 text-xs font-bold outline-none transition-colors cursor-pointer
                      ${student.status === "ENROLLED" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" : ""}
                      ${["SUSPENDED", "EXPELLED"].includes(student.status) ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20" : ""}
                      ${student.status === "ALUMNI" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" : ""}
                    `}
                  >
                    <option value="ENROLLED">Enrolled</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="EXPELLED">Expelled</option>
                    <option value="ALUMNI">Alumni</option>
                  </select>
                </div>
              </div>

              {/* Data Grid: Class & Guardian Info */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/60 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800/40">
                  <span className="text-slate-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Class / Tier</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate block mt-0.5">
                    {student.currentClass || student.tier?.name || "—"}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800/40">
                  <span className="text-slate-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Guardian</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate block mt-0.5">
                    {student.parentName || "—"}
                  </span>
                </div>
              </div>

              {/* Guardian Contact (if phone available) */}
              {student.parentPhone && (
                <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 pt-0.5">
                  <span className="font-medium text-[11px]">Phone:</span>
                  <a href={`tel:${student.parentPhone}`} className="text-indigo-600 dark:text-indigo-400 font-mono hover:underline">
                    {student.parentPhone}
                  </a>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/60">
                <button 
                  onClick={() => setSelectedStudent(student)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  View Profile &rarr;
                </button>

                <div className="flex items-center gap-1.5">
                  <button 
                    disabled={isPending}
                    onClick={() => openEditForm(student)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200/60 dark:border-indigo-800/60 transition"
                  >
                    Edit
                  </button>
                  <button 
                    disabled={isPending}
                    onClick={() => handleToggleSuspend(student)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                      student.status === "SUSPENDED"
                        ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                        : "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                    }`}
                  >
                    {student.status === "SUSPENDED" ? "Reinstate" : "Suspend"}
                  </button>
                  <button 
                    disabled={isPending}
                    onClick={() => handleDelete(student.id)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* High-Performance Cursor Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm text-sm">
        <div className="text-slate-500 dark:text-zinc-400 font-medium">
          Showing <span className="font-bold text-slate-800 dark:text-zinc-200">{filteredStudents.length}</span> records on Page {pageIndex + 1}
          {isPending && <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold animate-pulse">Scanning indexed cursor...</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pageIndex === 0 || isPending}
            onClick={handlePrevPage}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
          >
            &larr; Previous Page
          </button>
          <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 font-bold text-slate-600 dark:text-zinc-300">
            Page {pageIndex + 1}
          </span>
          <button
            type="button"
            disabled={!hasMore || isPending}
            onClick={handleNextPage}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
          >
            Next Page &rarr;
          </button>
        </div>
      </div>

      {selectedStudent && (
        <StudentProfileDrawer 
          student={selectedStudent} 
          onClose={() => setSelectedStudent(null)} 
        />
      )}

      {showBulkGraduate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {selectedIds.length > 0 ? bulkActionLabel : "Graduate Class / Term-End Processing"}
                </h3>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                  {activeTier || "Primary School"}
                </span>
              </div>
            </div>

            {selectedIds.length > 0 ? (
              <p className="text-slate-600 dark:text-zinc-300 text-sm mb-4 leading-relaxed">
                You are about to graduate {selectedIds.length} selected student(s) to 'Alumni'.
              </p>
            ) : (
              <div className="space-y-4 mb-4">
                {/* Clear Warning Banner */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 leading-snug">
                    This action will mass-promote all eligible students in the current tier to the next class grade. This cannot be undone.
                  </p>
                </div>

                {/* Progression Ladder View */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Tier Promotion Progression
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    {getLadderForTier(activeTier).map((step, idx, arr) => (
                      <React.Fragment key={step}>
                        <span className={idx === arr.length - 1 ? "text-indigo-600 dark:text-indigo-400 font-bold" : ""}>
                          {step}
                        </span>
                        {idx < arr.length - 1 && <span className="text-slate-400">&rarr;</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Academic Exceptions (Failures/Repeats) */}
                <div className="space-y-2 border-t border-slate-100 dark:border-zinc-800 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                      Academic Exceptions (Repeating Students)
                    </label>
                    {repeatingStudentIds.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                        {repeatingStudentIds.length} flagged to repeat
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Flag any students repeating their current class to exempt them from being promoted:
                  </p>
                  <input
                    type="text"
                    placeholder="Search student by name or class..."
                    value={repeaterSearch}
                    onChange={(e) => setRepeaterSearch(e.target.value)}
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  />
                  <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-zinc-700 rounded-lg p-2 space-y-1.5 bg-slate-50/50 dark:bg-zinc-950/40">
                    {studentList
                      .filter((s) => s.status === "ENROLLED")
                      .filter((s) =>
                        repeaterSearch
                          ? `${s.firstName} ${s.lastName} ${s.currentClass || ""}`.toLowerCase().includes(repeaterSearch.toLowerCase())
                          : true
                      )
                      .map((student) => {
                        const isChecked = repeatingStudentIds.includes(student.id);
                        return (
                          <label
                            key={student.id}
                            className={`flex items-center justify-between p-1.5 rounded-md text-xs cursor-pointer transition ${
                              isChecked
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold"
                                : "hover:bg-slate-100 dark:hover:bg-zinc-800/60 text-slate-700 dark:text-zinc-300"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setRepeatingStudentIds((prev) =>
                                    prev.includes(student.id) ? prev.filter((id) => id !== student.id) : [...prev, student.id]
                                  );
                                }}
                                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                              />
                              <span className="truncate">{student.firstName} {student.lastName}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 shrink-0">
                              {student.currentClass || "—"}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 sm:gap-3 justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button 
                type="button"
                onClick={() => {
                  setShowBulkGraduate(false);
                  setRepeatingStudentIds([]);
                  setRepeaterSearch("");
                }}
                className="px-4 py-2 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition text-sm"
              >
                Cancel
              </button>
              <button 
                disabled={isPending}
                onClick={selectedIds.length > 0 ? handleBulkGraduate : handleExecuteTermEndPromotion}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 transition text-sm flex items-center gap-2"
              >
                {isPending 
                  ? "Processing..." 
                  : selectedIds.length > 0 
                  ? "Confirm Graduation" 
                  : "Execute Term-End Promotion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
