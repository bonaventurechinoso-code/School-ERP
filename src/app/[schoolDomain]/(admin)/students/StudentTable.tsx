"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Student, AcademicTier } from "@prisma/client";
import { createStudent, updateStudent, deleteStudent, updateStudentStatus, bulkGraduateClass, bulkGraduateStudents, fetchStudentsPaginated } from "./actions";
import { useTenant } from "@/lib/tenant-context";
import StudentProfileDrawer from "./StudentProfileDrawer";

type StudentWithTier = Student & { tier?: AcademicTier | null, isLead?: boolean };

interface StudentTableProps {
  students: StudentWithTier[];
  initialNextCursor?: string | null;
  initialHasMore?: boolean;
  leads?: StudentWithTier[];
  schoolId: string;
  tiers: AcademicTier[];
  activeTier?: string;
  classrooms?: Array<{ id: string; name: string }>;
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

export default function StudentTable({ 
  students, 
  initialNextCursor,
  initialHasMore,
  leads = [],
  schoolId,
  tiers,
  activeTier,
  classrooms = [],
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
  const [formData, setFormData] = useState({ 
    firstName: "", 
    lastName: "", 
    email: "", 
    status: "ENROLLED", 
    tierId: "", 
    currentClass: "",
    parentName: "",
    parentPhone: "",
    dynamicFields: {} as Record<string, string> 
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const classOptions = getClassOptionsForTier(activeTier, tiers, classrooms);

  useEffect(() => {
    setFilterClass("ALL");
  }, [activeTier]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const openCreateForm = () => {
    setEditingStudentId(null);
    const matchingTier = tiers.find(t => 
      activeTier && (t.name.toLowerCase() === activeTier.toLowerCase() || t.name.toLowerCase().includes(activeTier.toLowerCase()))
    ) || (tiers.length > 0 ? tiers[0] : null);

    setFormData({ 
      firstName: "", 
      lastName: "", 
      email: "", 
      status: "ENROLLED", 
      tierId: matchingTier ? matchingTier.id : (tiers.length > 0 ? tiers[0].id : ""), 
      currentClass: classrooms.length > 0 ? classrooms[0].name : "",
      parentName: "",
      parentPhone: "",
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
      parentName: student.parentName || "",
      parentPhone: student.parentPhone || "",
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
        currentClass: formData.currentClass || undefined,
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
        setEditingStudentId(null);
      }
    });
  };

  const handleDelete = async (studentId: string) => {
    if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
      startTransition(async () => {
        const res = await deleteStudent(schoolId, studentId, activeTier);
        if (res?.error) {
          alert(res.error);
        }
      });
    }
  };

  const handleUpdateStatus = (studentId: string, newStatus: string) => {
    startTransition(() => {
      updateStudentStatus(schoolId, studentId, newStatus, activeTier);
    });
  };

  const handleClassFilterChange = (newClass: string) => {
    setFilterClass(newClass);
    setCursorHistory([]);
    setPageIndex(0);
    startTransition(async () => {
      const res = await fetchStudentsPaginated(schoolId, {
        tierName: activeTier,
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

  const combinedRecords = [...studentList, ...(leads || [])];

  const filteredStudents = combinedRecords.filter(s => {
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
      if (confirm(`Are you sure you want to graduate ${selectedIds.length} selected students?`)) {
        startTransition(async () => {
          const res = await bulkGraduateStudents(schoolId, selectedIds, activeTier);
          if (res?.error) alert(res.error);
          else {
            setShowBulkGraduate(false);
            setSelectedIds([]);
          }
        });
      }
    } else {
      if (!bulkClass) return;
      if (confirm(`Are you sure you want to graduate all students in ${bulkClass}?`)) {
        startTransition(async () => {
          const res = await bulkGraduateClass(schoolId, bulkClass, activeTier);
          if (res?.error) alert(res.error);
          else setShowBulkGraduate(false);
        });
      }
    }
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
  const isNursery = selectedTier && (selectedTier.name.toLowerCase().includes("daycare") || selectedTier.name.toLowerCase().includes("nursery") || selectedTier.name.toLowerCase().includes("early care"));

  let bulkActionLabel = "Graduate Selected";
  let bulkActionGlobalLabel = filterClass !== "ALL" ? `Graduate ${filterClass}` : "Graduate Class";

  const currentBulkLabel = selectedIds.length > 0 ? `${bulkActionLabel} (${selectedIds.length})` : bulkActionGlobalLabel;

  return (
    <div className="space-y-6">

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
              setShowBulkGraduate(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-medium rounded-lg shadow-sm hover:bg-slate-300 dark:hover:bg-zinc-700 transition"
          >
            {currentBulkLabel}
          </button>
          {(tenant.userRole === "ADMIN" || tenant.userRole === "REGISTRAR") && (
            <button 
              onClick={showForm ? () => setShowForm(false) : openCreateForm}
              className="w-full sm:w-auto px-4 py-2 text-white font-medium rounded-lg shadow-sm transition"
              style={{ backgroundColor: tenant.branding.primaryColor }}
            >
              {showForm ? "Cancel" : "Add Student"}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-zinc-100">
              {editingStudentId ? "Edit Student" : "New Student"}
            </h3>
          </div>
          {errorMsg && (
            <div className="md:col-span-2 p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium">
              {errorMsg}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Academic Tier *</label>
            <select 
              required
              className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800" 
              value={formData.tierId} 
              onChange={e => {
                setFormData({...formData, tierId: e.target.value, dynamicFields: {}});
              }}
            >
              <option value="" disabled>Select a Tier</option>
              {tiers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Current Class / Grade</label>
            {classrooms && classrooms.length > 0 ? (
              <select 
                className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800"
                value={formData.currentClass} 
                onChange={e => setFormData({...formData, currentClass: e.target.value})}
              >
                <option value="">Select Class...</option>
                {classrooms.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            ) : (
              <input 
                type="text" 
                placeholder="e.g. Primary 1 Gold"
                className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800" 
                value={formData.currentClass} 
                onChange={e => setFormData({...formData, currentClass: e.target.value})} 
              />
            )}
          </div>

          {!editingStudentId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Status</label>
              <select className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="PROSPECT">Prospect</option>
                <option value="APPLICANT">Applicant</option>
                <option value="SCREENED">Screened</option>
                <option value="ENROLLED">Enrolled</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="EXPELLED">Expelled</option>
                <option value="ALUMNI">Alumni</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">First Name *</label>
            <input required type="text" className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Last Name *</label>
            <input required type="text" className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Email</label>
            <input type="email" className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          
          {/* Parent & Emergency Contact (Nursery Only) */}
          {isNursery && (
            <div className="md:col-span-2 border-t border-slate-150 dark:border-zinc-800 pt-4 mt-2">
              <h4 className="text-sm font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3">👪 Parent & Emergency Contact Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Guardian Full Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Ike Mmadu"
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100" 
                    value={formData.parentName} 
                    onChange={e => setFormData({...formData, parentName: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Relationship to Child</label>
                  <select 
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                    value={formData.dynamicFields.relationship || ""}
                    onChange={e => handleDynamicFieldChange("relationship", e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Legal Guardian">Legal Guardian</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Emergency Phone Number</label>
                  <input 
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9+]*"
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100" 
                    value={formData.parentPhone} 
                    onChange={e => {
                      let val = e.target.value.replace(/[^0-9+]/g, '');
                      if (val.length > 14) val = val.slice(0, 14);
                      setFormData({...formData, parentPhone: val});
                    }} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Authorized Pick-Up Person</label>
                  <input 
                    type="text" 
                    placeholder="Name of person approved to collect the child"
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100" 
                    value={formData.dynamicFields.authorizedPickup || ""} 
                    onChange={e => handleDynamicFieldChange("authorizedPickup", e.target.value)} 
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Dynamic Tier Fields */}
          {currentDynamicFields.length > 0 && (
            <div className="md:col-span-2 border-t border-slate-150 dark:border-zinc-800 pt-4 mt-2">
              <h4 className="text-sm font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Tier-Specific Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentDynamicFields.map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">{field.label}</label>
                    {field.type === "select" ? (
                      <select 
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
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
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                        value={formData.dynamicFields[field.key] || ""}
                        onChange={(e) => handleDynamicFieldChange(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="md:col-span-2 flex justify-end mt-2">
            <button disabled={isPending} type="submit" className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl shadow-sm transition disabled:opacity-50">
              {editingStudentId ? "Update Student" : "Save Student"}
            </button>
          </div>
        </form>
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
                    disabled={isPending || student.isLead}
                    value={student.status}
                    onChange={(e) => handleUpdateStatus(student.id, e.target.value)}
                    className={`border rounded-lg p-1.5 text-xs font-bold outline-none transition-colors cursor-pointer
                      ${student.status === "ENROLLED" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" : ""}
                      ${["PROSPECT", "APPLICANT", "SCREENED"].includes(student.status) ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20" : ""}
                      ${["SUSPENDED", "EXPELLED"].includes(student.status) ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20" : ""}
                      ${student.status === "ALUMNI" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" : ""}
                    `}
                  >
                    <option value="PROSPECT">Prospect</option>
                    <option value="APPLICANT">Applicant</option>
                    <option value="SCREENED">Screened</option>
                    <option value="ENROLLED">Enrolled</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="EXPELLED">Expelled</option>
                    <option value="ALUMNI">Alumni</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                  {student.isLead ? (
                    <span className="text-xs text-slate-400 dark:text-zinc-500 italic">Manage in Admissions</span>
                  ) : (
                    <>
                      <button 
                        disabled={isPending}
                        onClick={() => openEditForm(student)}
                        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition"
                      >
                        Edit
                      </button>
                      <button 
                        disabled={isPending}
                        onClick={() => handleDelete(student.id)}
                        className="text-sm font-medium text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition"
                      >
                        Delete
                      </button>
                    </>
                  )}
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
                    disabled={isPending || student.isLead}
                    value={student.status}
                    onChange={(e) => handleUpdateStatus(student.id, e.target.value)}
                    className={`border rounded-lg px-2 py-1 text-xs font-bold outline-none transition-colors cursor-pointer
                      ${student.status === "ENROLLED" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" : ""}
                      ${["PROSPECT", "APPLICANT", "SCREENED"].includes(student.status) ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20" : ""}
                      ${["SUSPENDED", "EXPELLED"].includes(student.status) ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20" : ""}
                      ${student.status === "ALUMNI" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" : ""}
                    `}
                  >
                    <option value="PROSPECT">Prospect</option>
                    <option value="APPLICANT">Applicant</option>
                    <option value="SCREENED">Screened</option>
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

                <div className="flex items-center gap-2">
                  {student.isLead ? (
                    <span className="text-xs text-slate-400 dark:text-zinc-500 italic">Admissions Lead</span>
                  ) : (
                    <>
                      <button 
                        disabled={isPending}
                        onClick={() => openEditForm(student)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
                      >
                        Edit
                      </button>
                      <button 
                        disabled={isPending}
                        onClick={() => handleDelete(student.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition"
                      >
                        Delete
                      </button>
                    </>
                  )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {selectedIds.length > 0 ? bulkActionLabel : bulkActionGlobalLabel}
            </h3>
            <p className="text-slate-500 dark:text-zinc-400 text-sm mb-4">
              {selectedIds.length > 0 
                ? `You are about to process ${selectedIds.length} selected students.` 
                : `Process an entire class cohort of students.`}
            </p>
            
            {selectedIds.length === 0 && (
              <>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Target Class</label>
                <select 
                  className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 mb-4 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  value={bulkClass}
                  onChange={e => setBulkClass(e.target.value)}
                >
                  <option value="" disabled>Select a Class</option>
                  {classOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </>
            )}
            
            <div className="flex gap-2 sm:gap-3 justify-end pt-2">
              <button 
                onClick={() => setShowBulkGraduate(false)}
                className="px-4 py-2 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition text-sm"
              >
                Cancel
              </button>
              <button 
                disabled={isPending || (selectedIds.length === 0 && !bulkClass)}
                onClick={handleBulkGraduate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition text-sm"
              >
                {isPending ? "Processing..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
