"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  StaffTierCategory,
  TERTIARY_UNIVERSITY_ACADEMIC_ROLES,
  TERTIARY_POLYTECHNIC_ACADEMIC_ROLES,
  isNonTeachingRole,
} from "@/lib/staff-roles-config";
import {
  GraduationCap,
  ShieldCheck,
  Briefcase,
  AlertCircle,
  Award,
  Layers,
  UserCheck,
  ChevronDown,
  Search,
  X,
  Check,
} from "lucide-react";

interface RolePickerProps {
  tierCategory?: StaffTierCategory;
  selectedRole?: string;
  onSelectRole: (role: string) => void;
  error?: string;
  isPolytechnic?: boolean;
}

interface RoleItem {
  id: string;
  title: string;
  category: "teaching" | "leadership" | "support";
  badgeText: string;
  description: string;
  trcnStatus: "mandatory" | "optional" | "none";
}

export default function StaffRolePickerForm({
  tierCategory = "PRIMARY",
  selectedRole = "",
  onSelectRole,
  error,
  isPolytechnic = false,
}: RolePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens without SSR hydration mismatch
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Generate structured, tier-specific role items
  const roleGroups = useMemo<RoleItem[]>(() => {
    const safeCategory = tierCategory || "PRIMARY";

    switch (safeCategory) {
      case "CRECHE": {
        return [
          {
            id: "Caregiver",
            title: "Caregiver / Minder",
            category: "teaching",
            badgeText: "Direct Childcare (1:5)",
            description: "Direct toddler & infant care, developmental play, nap & nutrition routines.",
            trcnStatus: "optional",
          },
          {
            id: "Assistant Caregiver",
            title: "Assistant Caregiver",
            category: "teaching",
            badgeText: "Care Support",
            description: "Assists lead caregiver with feeding, hygiene, sensory and outdoor play.",
            trcnStatus: "optional",
          },
          {
            id: "Creche Supervisor",
            title: "Creche Supervisor",
            category: "leadership",
            badgeText: "Centre Leadership",
            description: "Oversees playgroup ratios, caregiver rotas, and child safeguarding standards.",
            trcnStatus: "optional",
          },
          {
            id: "Nurse / First Aider",
            title: "Nurse / First Aider",
            category: "support",
            badgeText: "Pediatric Health & Safety",
            description: "Monitors daily temperature, infant vitals, first aid logs, and allergies.",
            trcnStatus: "none",
          },
          {
            id: "Cleaner / Support",
            title: "Early Years Sanitation Officer",
            category: "support",
            badgeText: "Sanitation & Hygiene",
            description: "Maintains sanitized play areas, sterilized feeding items, and nap areas.",
            trcnStatus: "none",
          },
          {
            id: "Admin / Receptionist",
            title: "Front Desk & Parent Liaison",
            category: "support",
            badgeText: "Centre Administration",
            description: "Manages morning drop-offs, pickup authentication, fees and visitor desk.",
            trcnStatus: "none",
          },
        ];
      }

      case "NURSERY": {
        return [
          {
            id: "Nursery Teacher",
            title: "Nursery Teacher (Lead)",
            category: "teaching",
            badgeText: "Early Childhood (EYFS)",
            description: "Leads phonics, early numeracy, handwriting readiness, and Montessori activities.",
            trcnStatus: "optional",
          },
          {
            id: "Assistant Teacher",
            title: "Assistant / Floating Teacher",
            category: "teaching",
            badgeText: "Classroom Support",
            description: "Supports lead teacher across nursery streams, learning centres, and routines.",
            trcnStatus: "optional",
          },
          {
            id: "Head of Nursery",
            title: "Head of Nursery / Sectional Head",
            category: "leadership",
            badgeText: "Sectional Executive",
            description: "Oversees early years curriculum, termly developmental profiles, and teacher remarks.",
            trcnStatus: "optional",
          },
          {
            id: "Nurse / First Aider",
            title: "School Nurse / First Aider",
            category: "support",
            badgeText: "Health & Well-being",
            description: "Manages sick bay, child medical records, pupil medications, and safety cards.",
            trcnStatus: "none",
          },
          {
            id: "Caregiver / Nanny",
            title: "Classroom Nanny / Childcare Assistant",
            category: "support",
            badgeText: "Pupil Care",
            description: "Assists with bathroom routines, mealtime support, and classroom tidiness.",
            trcnStatus: "none",
          },
          {
            id: "Admin / Receptionist",
            title: "Administrative Assistant",
            category: "support",
            badgeText: "Front Office",
            description: "Handles pupil enrollment inquiries, visitor registration, and attendance files.",
            trcnStatus: "none",
          },
        ];
      }

      case "PRIMARY": {
        return [
          {
            id: "Class Teacher",
            title: "Class Teacher",
            category: "teaching",
            badgeText: "Single Class (Primary 1-6)",
            description: "Primary custodian of one classroom; teaches core subjects, takes daily register & termly scores.",
            trcnStatus: "mandatory",
          },
          {
            id: "Subject Teacher",
            title: "Specialist Subject Teacher",
            category: "teaching",
            badgeText: "French, ICT, Music, Diction",
            description: "Teaches designated specialist subjects across multiple primary arms and levels.",
            trcnStatus: "mandatory",
          },
          {
            id: "Class Assistant",
            title: "Classroom Teaching Assistant",
            category: "teaching",
            badgeText: "Academic Support",
            description: "Supports class teacher with marking, remedial reading, and pupil supervision.",
            trcnStatus: "optional",
          },
          {
            id: "Head Teacher",
            title: "Head Teacher / Headmaster / Headmistress",
            category: "leadership",
            badgeText: "Primary School Head",
            description: "Executive academic leader; oversees lesson plans, broadsheets, and statutory registers.",
            trcnStatus: "mandatory",
          },
          {
            id: "Assistant Head Teacher",
            title: "Assistant Head Teacher (Academics / Admin)",
            category: "leadership",
            badgeText: "Deputy Primary Head",
            description: "Assists headmaster with teacher rosters, timetable allocations, and assembly registers.",
            trcnStatus: "mandatory",
          },
          {
            id: "Bursar / Accountant",
            title: "Bursar / School Accountant",
            category: "support",
            badgeText: "Financial Management",
            description: "Manages fee collections, receipting, invoices, bank reconciliations, and payroll.",
            trcnStatus: "none",
          },
          {
            id: "Admin Officer",
            title: "Administrative Officer",
            category: "support",
            badgeText: "Registry & Records",
            description: "Maintains pupil dossiers, state ministry returns, and official correspondence.",
            trcnStatus: "none",
          },
          {
            id: "School Nurse",
            title: "Registered School Nurse",
            category: "support",
            badgeText: "Pupil Clinic",
            description: "Operates primary sick bay, first-aid emergencies, and health immunization files.",
            trcnStatus: "none",
          },
          {
            id: "Support Staff",
            title: "Support Services & Security",
            category: "support",
            badgeText: "Campus Operations",
            description: "Facilities maintenance, gate security, campus grounds, and transport logistics.",
            trcnStatus: "none",
          },
        ];
      }

      case "SECONDARY": {
        return [
          {
            id: "Subject Teacher",
            title: "Subject Teacher",
            category: "teaching",
            badgeText: "Academic Faculty",
            description: "Delivers curriculum syllabus and enters Continuous Assessment and examination scores.",
            trcnStatus: "mandatory",
          },
          {
            id: "Form Tutor / Class Teacher",
            title: "Form Tutor / Class Teacher",
            category: "teaching",
            badgeText: "Class Custodian",
            description: "Manages class attendance register, pastoral care, and terminal report card remarks.",
            trcnStatus: "mandatory",
          },
          {
            id: "Head of Department (HOD)",
            title: "Head of Department (HOD)",
            category: "leadership",
            badgeText: "Department Lead",
            description: "Supervises subject teachers, approves schemes of work, and coordinates exams.",
            trcnStatus: "mandatory",
          },
          {
            id: "Vice Principal (Academic)",
            title: "Vice Principal (Academic)",
            category: "leadership",
            badgeText: "Senior Leadership",
            description: "Coordinates master timetables, academic broadsheets, and external examination centres.",
            trcnStatus: "mandatory",
          },
          {
            id: "Vice Principal (Administration)",
            title: "Vice Principal (Administration)",
            category: "leadership",
            badgeText: "Senior Leadership",
            description: "Manages student discipline, co-curricular activities, and staff attendance.",
            trcnStatus: "mandatory",
          },
          {
            id: "Principal",
            title: "Principal",
            category: "leadership",
            badgeText: "Chief Executive",
            description: "Executive institutional authority; signs terminal report cards, transcripts and certificates.",
            trcnStatus: "mandatory",
          },
          {
            id: "Bursar",
            title: "Bursar",
            category: "support",
            badgeText: "Financial Controller",
            description: "Administers tuition billing, fee collections, payment receipts, and monthly staff payroll.",
            trcnStatus: "none",
          },
          {
            id: "Guidance Counselor",
            title: "Guidance Counselor",
            category: "support",
            badgeText: "Student Welfare",
            description: "Coordinates student counseling, psycho-social care, and UTME subject combinations.",
            trcnStatus: "optional",
          },
          {
            id: "Librarian",
            title: "Librarian",
            category: "support",
            badgeText: "Library Specialist",
            description: "Manages library catalogues, textbook allocations, and quiet study halls.",
            trcnStatus: "none",
          },
          {
            id: "Lab Technologist",
            title: "Lab Technologist",
            category: "support",
            badgeText: "STEM Labs",
            description: "Prepares science practicals and maintains computer labs for CBT tests.",
            trcnStatus: "none",
          },
          {
            id: "Admin Officer",
            title: "Admin Officer",
            category: "support",
            badgeText: "Registry & Records",
            description: "Coordinates student admissions records, ministry returns, and official correspondence.",
            trcnStatus: "none",
          },
          {
            id: "Support Staff",
            title: "Support Staff",
            category: "support",
            badgeText: "General Support",
            description: "Campus facilities maintenance, physical security, and general support services.",
            trcnStatus: "none",
          },
        ];
      }

      case "TERTIARY": {
        const academicRoles = isPolytechnic
          ? TERTIARY_POLYTECHNIC_ACADEMIC_ROLES
          : TERTIARY_UNIVERSITY_ACADEMIC_ROLES;

        return [
          ...academicRoles.map((role) => ({
            id: role,
            title: role,
            category: "teaching" as const,
            badgeText: isPolytechnic ? "Polytechnic Faculty" : "University Faculty",
            description: "Delivers semester lectures, practical labs, student project supervision, and gradebook entry.",
            trcnStatus: "optional" as const,
          })),
          {
            id: "Head of Department (HOD)",
            title: "Head of Department (HOD)",
            category: "leadership" as const,
            badgeText: "Academic Department Lead",
            description: "Formal academic administrator; presides over departmental board, course allocations & marks.",
            trcnStatus: "optional" as const,
          },
          {
            id: "Dean",
            title: "Dean of Faculty / School",
            category: "leadership" as const,
            badgeText: "Faculty Executive",
            description: "Heads faculty board of studies; approves semester results and degree recommendations.",
            trcnStatus: "optional" as const,
          },
          {
            id: "Provost / Rector / Vice-Chancellor",
            title: isPolytechnic ? "Rector / Deputy Rector" : "Vice-Chancellor / DVC",
            category: "leadership" as const,
            badgeText: "Principal Officer",
            description: "Chief executive & academic officer of the higher institution.",
            trcnStatus: "optional" as const,
          },
          {
            id: "Registrar / Bursar (Non-Academic)",
            title: "Registrar / Bursar",
            category: "support" as const,
            badgeText: "Principal Administration",
            description: "Institutional custodian of academic records, admissions, personnel, and finances.",
            trcnStatus: "none" as const,
          },
          {
            id: "Lab Technologist",
            title: "Chief / Principal Technologist",
            category: "support" as const,
            badgeText: "Engineering / Science Labs",
            description: "Manages university/polytechnic workshops, diagnostic equipment, and studio benches.",
            trcnStatus: "none" as const,
          },
          {
            id: "Admin Officer",
            title: "Faculty / Departmental Officer",
            category: "support" as const,
            badgeText: "Academic Registry",
            description: "Coordinates student matriculation, exam slips, course registration clearance.",
            trcnStatus: "none" as const,
          },
          {
            id: "Support Staff",
            title: "Works & Support Services",
            category: "support" as const,
            badgeText: "Campus Services",
            description: "Works, physical planning, security patrol, campus sanitation.",
            trcnStatus: "none" as const,
          },
        ];
      }

      default:
        return [];
    }
  }, [tierCategory, isPolytechnic]);

  // Robust selected item resolution with fuzzy/custom role fallback
  const selectedItem = useMemo<RoleItem | null>(() => {
    if (!selectedRole || !selectedRole.trim()) return null;
    const direct = roleGroups.find((r) => r.id === selectedRole);
    if (direct) return direct;

    const norm = selectedRole.toLowerCase().trim();
    const fuzzy = roleGroups.find(
      (r) =>
        r.id.toLowerCase() === norm ||
        r.title.toLowerCase() === norm ||
        norm.includes(r.id.toLowerCase()) ||
        r.id.toLowerCase().includes(norm)
    );
    if (fuzzy) return fuzzy;

    const nonTeach = isNonTeachingRole(selectedRole);
    return {
      id: selectedRole,
      title: selectedRole,
      category: nonTeach ? ("support" as const) : ("teaching" as const),
      badgeText: nonTeach ? "Support Staff" : "Academic Staff",
      description: "Designated institutional staff role.",
      trcnStatus: "optional" as const,
    };
  }, [roleGroups, selectedRole]);

  const isNonTeaching = isNonTeachingRole(selectedRole);

  // Group roles by category for clean sectioning
  const categorizedRoles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? roleGroups.filter(
          (r) =>
            r.title.toLowerCase().includes(query) ||
            r.description.toLowerCase().includes(query) ||
            r.badgeText.toLowerCase().includes(query)
        )
      : roleGroups;

    return {
      teaching: filtered.filter((r) => r.category === "teaching"),
      leadership: filtered.filter((r) => r.category === "leadership"),
      support: filtered.filter((r) => r.category === "support"),
    };
  }, [roleGroups, searchQuery]);

  const tierDisplay = useMemo(() => {
    switch (tierCategory) {
      case "CRECHE":
        return "Creche / Daycare";
      case "NURSERY":
        return "Nursery School";
      case "PRIMARY":
        return "Primary School";
      case "SECONDARY":
        return "Secondary School";
      case "TERTIARY":
        return isPolytechnic ? "Polytechnic" : "University / Tertiary";
      default:
        return tierCategory || "School";
    }
  }, [tierCategory, isPolytechnic]);

  const placeholderText = `-- Select Role / Designation for this ${tierDisplay} Staff --`;

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
      {/* HEADER ROW */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <label
              htmlFor="staff-role-picker"
              className="text-xs font-bold text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              Staff Role / Designation <span className="text-rose-500">*</span>
            </label>
          </div>
        </div>

        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {tierDisplay}
        </span>
      </div>

      {/* CLEAN PLACEHOLDER FORM FIELD WITH DROPDOWN */}
      <div className="relative" ref={dropdownRef}>
        {/* Trigger styled as a Clean Accessible Placeholder Form Field */}
        <div
          id="staff-role-picker"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="staff-role-picker-listbox"
          tabIndex={0}
          onClick={() => setIsOpen((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              setIsOpen((prev) => !prev);
            } else if (e.key === "Escape") {
              setIsOpen(false);
            }
          }}
          className={`w-full text-left bg-white border rounded-xl px-3.5 py-2.5 text-xs font-medium flex items-center justify-between transition outline-none cursor-pointer ${
            error
              ? "border-rose-400 bg-rose-50/20 focus:ring-2 focus:ring-rose-400"
              : isOpen
              ? "border-blue-500 ring-2 ring-blue-500/20"
              : "border-slate-300 hover:border-slate-400 focus:ring-2 focus:ring-blue-500"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {selectedItem ? (
              <>
                {tierCategory === "SECONDARY" ? (
                  <>
                    <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-900 text-xs truncate">
                      {selectedRole}
                    </span>
                  </>
                ) : (
                  <>
                    {selectedItem.category === "teaching" ? (
                      <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : selectedItem.category === "leadership" ? (
                      <Award className="w-4 h-4 text-purple-600 shrink-0" />
                    ) : (
                      <Briefcase className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                    <span className="font-bold text-slate-900 truncate">{selectedItem.title}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        selectedItem.category === "teaching"
                          ? "bg-blue-100 text-blue-700"
                          : selectedItem.category === "leadership"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {selectedItem.badgeText}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-slate-500 font-normal truncate">{placeholderText}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {selectedRole && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRole("");
                }}
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition cursor-pointer"
                title="Clear selection"
                aria-label="Clear role selection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-blue-600" : ""
              }`}
            />
          </div>
        </div>

        {/* LIST OF ROLES PER INSTITUTIONAL TIER */}
        {isOpen && (
          <div 
            id="staff-role-picker-listbox"
            role="listbox" 
            aria-label={`Available roles for ${tierDisplay}`}
            className={
              tierCategory === "SECONDARY"
                ? "mt-2 w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-150"
                : "absolute z-50 mt-1.5 w-full bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            }
          >
            {/* SEARCH FILTER */}
            <div className="p-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${tierDisplay} roles (e.g. Teacher, HOD, Bursar)...`}
                className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* SCROLLABLE LIST OF ROLES */}
            <div className="max-h-72 overflow-y-auto p-2 space-y-3 divide-y divide-slate-100">
              {/* 1. TEACHING / ACADEMIC FACULTY */}
              {categorizedRoles.teaching.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 pt-1 pb-1 text-[10px] font-black tracking-wider uppercase text-blue-600 flex items-center justify-between">
                    <span>
                      {tierCategory === "TERTIARY"
                        ? "Academic Faculty / Lecturers"
                        : tierCategory === "CRECHE"
                        ? "Early Years Caregivers"
                        : "Teaching Faculty"}
                    </span>
                    <span className="text-slate-400 font-normal">
                      ({categorizedRoles.teaching.length})
                    </span>
                  </div>
                  {categorizedRoles.teaching.map((role) => {
                    const isSelected = selectedRole === role.id;
                    return (
                      <div
                        key={role.id}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={0}
                        onClick={() => {
                          onSelectRole(role.id);
                          setIsOpen(false);
                          setSearchQuery("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectRole(role.id);
                            setIsOpen(false);
                            setSearchQuery("");
                          }
                        }}
                        className={`p-2.5 rounded-xl transition cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected
                            ? "bg-blue-50 border border-blue-200 text-blue-900"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          {tierCategory === "SECONDARY" ? (
                            <div>
                              <div className="text-xs font-bold text-slate-900">{role.title}</div>
                              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{role.description}</p>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <GraduationCap
                                  className={`w-3.5 h-3.5 ${
                                    isSelected ? "text-blue-600" : "text-slate-400"
                                  }`}
                                />
                                <span className="text-xs font-bold">{role.title}</span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-100/70 text-blue-700">
                                  {role.badgeText}
                                </span>
                                {role.trcnStatus === "mandatory" && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                                    <ShieldCheck className="w-2.5 h-2.5 text-amber-600" /> TRCN
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-1">
                                {role.description}
                              </p>
                            </>
                          )}
                        </div>
                        {isSelected && (
                          <div className={`w-4 h-4 rounded-full ${tierCategory === "SECONDARY" ? "bg-emerald-600" : "bg-blue-600"} text-white flex items-center justify-center shrink-0 mt-0.5`}>
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. LEADERSHIP & SUPERVISION */}
              {categorizedRoles.leadership.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="px-2 pt-1 pb-1 text-[10px] font-black tracking-wider uppercase text-purple-600 flex items-center justify-between">
                    <span>Leadership & Administration</span>
                    <span className="text-slate-400 font-normal">
                      ({categorizedRoles.leadership.length})
                    </span>
                  </div>
                  {categorizedRoles.leadership.map((role) => {
                    const isSelected = selectedRole === role.id;
                    return (
                      <div
                        key={role.id}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={0}
                        onClick={() => {
                          onSelectRole(role.id);
                          setIsOpen(false);
                          setSearchQuery("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectRole(role.id);
                            setIsOpen(false);
                            setSearchQuery("");
                          }
                        }}
                        className={`p-2.5 rounded-xl transition cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected
                            ? "bg-purple-50 border border-purple-200 text-purple-900"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          {tierCategory === "SECONDARY" ? (
                            <div>
                              <div className="text-xs font-bold text-slate-900">{role.title}</div>
                              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{role.description}</p>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <Award
                                  className={`w-3.5 h-3.5 ${
                                    isSelected ? "text-purple-600" : "text-slate-400"
                                  }`}
                                />
                                <span className="text-xs font-bold">{role.title}</span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-100/70 text-purple-700">
                                  {role.badgeText}
                                </span>
                                {role.trcnStatus === "mandatory" && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                                    <ShieldCheck className="w-2.5 h-2.5 text-amber-600" /> TRCN
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-1">
                                {role.description}
                              </p>
                            </>
                          )}
                        </div>
                        {isSelected && (
                          <div className={`w-4 h-4 rounded-full ${tierCategory === "SECONDARY" ? "bg-emerald-600" : "bg-purple-600"} text-white flex items-center justify-center shrink-0 mt-0.5`}>
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. NON-TEACHING & SUPPORT */}
              {categorizedRoles.support.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="px-2 pt-1 pb-1 text-[10px] font-black tracking-wider uppercase text-slate-600 flex items-center justify-between">
                    <span>Non-Teaching & Support Staff</span>
                    <span className="text-slate-400 font-normal">
                      ({categorizedRoles.support.length})
                    </span>
                  </div>
                  {categorizedRoles.support.map((role) => {
                    const isSelected = selectedRole === role.id;
                    return (
                      <div
                        key={role.id}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={0}
                        onClick={() => {
                          onSelectRole(role.id);
                          setIsOpen(false);
                          setSearchQuery("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectRole(role.id);
                            setIsOpen(false);
                            setSearchQuery("");
                          }
                        }}
                        className={`p-2.5 rounded-xl transition cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected
                            ? "bg-slate-100 border border-slate-300 text-slate-900"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          {tierCategory === "SECONDARY" ? (
                            <div>
                              <div className="text-xs font-bold text-slate-900">{role.title}</div>
                              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{role.description}</p>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <Briefcase
                                  className={`w-3.5 h-3.5 ${
                                    isSelected ? "text-slate-700" : "text-slate-400"
                                  }`}
                                />
                                <span className="text-xs font-bold">{role.title}</span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700">
                                  {role.badgeText}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-1">
                                {role.description}
                              </p>
                            </>
                          )}
                        </div>
                        {isSelected && (
                          <div className={`w-4 h-4 rounded-full ${tierCategory === "SECONDARY" ? "bg-emerald-600" : "bg-slate-700"} text-white flex items-center justify-center shrink-0 mt-0.5`}>
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {categorizedRoles.teaching.length === 0 &&
                categorizedRoles.leadership.length === 0 &&
                categorizedRoles.support.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No roles found matching &quot;{searchQuery}&quot; for {tierDisplay}.
                  </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* COMPACT SINGLE-LINE STATUS PILL */}
      {selectedItem ? (
        <div
          className={`px-3.5 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
            isNonTeaching
              ? "bg-amber-50/80 border-amber-200 text-amber-900"
              : "bg-blue-50/80 border-blue-200 text-blue-900"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isNonTeaching ? (
              <Briefcase className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            )}
            <span className="text-[11px] truncate">
              {isNonTeaching ? (
                <>
                  <strong>Non-Teaching Role ({selectedRole}):</strong> Class & course assignments in
                  Section D will be hidden automatically.
                </>
              ) : (
                <>
                  <strong>Teaching Role ({selectedRole}):</strong> Classroom & subject assignments
                  in Section D are enabled.
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {selectedItem.trcnStatus === "mandatory" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-600" /> TRCN Mandatory
              </span>
            )}
            {selectedItem.trcnStatus === "optional" && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                TRCN Optional
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">
          Select candidate&apos;s designated role from the placeholder dropdown above. System permissions and Section D adapt automatically.
        </p>
      )}
    </div>
  );
}
