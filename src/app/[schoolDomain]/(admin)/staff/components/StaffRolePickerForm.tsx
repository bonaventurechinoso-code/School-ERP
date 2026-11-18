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
  CheckCircle2,
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
  tierCategory: StaffTierCategory;
  selectedRole: string;
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
  tierCategory,
  selectedRole,
  onSelectRole,
  error,
  isPolytechnic = false,
}: RolePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Generate structured, tier-specific role items
  const roleGroups = useMemo<RoleItem[]>(() => {
    switch (tierCategory) {
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
            badgeText: "Paediatric Health",
            description: "First aid administration, toddler health monitoring, and emergency triage.",
            trcnStatus: "none",
          },
          {
            id: "Cleaner / Support",
            title: "Cleaner / Facility Support",
            category: "support",
            badgeText: "Sanitation & Care",
            description: "Nursery toy sanitization, bedding laundry, hygiene and feeding area clean.",
            trcnStatus: "none",
          },
          {
            id: "Admin / Receptionist",
            title: "Admin / Receptionist",
            category: "support",
            badgeText: "Front Desk & Records",
            description: "Parent sign-in/out registers, visitor access, toddler health logs.",
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
            badgeText: "Early Childhood (ECCE)",
            description: "Class lead for phonics, numeracy readiness, sensory & developmental arts.",
            trcnStatus: "optional",
          },
          {
            id: "Assistant Teacher",
            title: "Assistant Teacher",
            category: "teaching",
            badgeText: "Class Support / Floating",
            description: "Assists lead teacher with small-group activities and classroom coordination.",
            trcnStatus: "optional",
          },
          {
            id: "Nursery Supervisor / Head of Nursery",
            title: "Head of Nursery / Supervisor",
            category: "leadership",
            badgeText: "Nursery Leadership",
            description: "Curriculum oversight, teacher evaluation, and parent-teacher communication.",
            trcnStatus: "optional",
          },
          {
            id: "Caregiver",
            title: "Nursery Minder / Caregiver",
            category: "support",
            badgeText: "Child Welfare",
            description: "Supports children with meals, toilet training, and general welfare.",
            trcnStatus: "none",
          },
          {
            id: "Admin",
            title: "Nursery Admin Officer",
            category: "support",
            badgeText: "Administrative Desk",
            description: "Student admission documentation, attendance consolidation, parent liaisons.",
            trcnStatus: "none",
          },
          {
            id: "Support Staff",
            title: "Facility & Support Staff",
            category: "support",
            badgeText: "Sanitation & Care",
            description: "Sanitation, playground safety, and physical classroom orderliness.",
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
            badgeText: "Single Class (Basic 1-6)",
            description: "Dedicated class manager; handles attendance register, broadsheet, and report cards.",
            trcnStatus: "mandatory",
          },
          {
            id: "Subject Teacher",
            title: "Subject Teacher",
            category: "teaching",
            badgeText: "Multi-Class & Subject",
            description: "Teaches specialized subjects (French, CCA, ICT, Music) across multiple primary arms.",
            trcnStatus: "mandatory",
          },
          {
            id: "Head Teacher",
            title: "Head Teacher",
            category: "leadership",
            badgeText: "Institutional Lead",
            description: "School executive authority; broadsheet approval, teacher supervision, Ministry relations.",
            trcnStatus: "mandatory",
          },
          {
            id: "Assistant Head Teacher",
            title: "Assistant Head Teacher",
            category: "leadership",
            badgeText: "Deputy Oversight",
            description: "Deputizes for Head Teacher; manages daily duty roster and lesson note vetting.",
            trcnStatus: "mandatory",
          },
          {
            id: "Bursar / Accountant",
            title: "Bursar / Accountant",
            category: "support",
            badgeText: "Finance & Accounts",
            description: "Fee collections, payroll preparation, financial ledger maintenance, receipts.",
            trcnStatus: "none",
          },
          {
            id: "Admin Officer",
            title: "Admin Officer",
            category: "support",
            badgeText: "Personnel & Records",
            description: "Pupil bio-data, statutory registers, circulars, and administrative records.",
            trcnStatus: "none",
          },
          {
            id: "Librarian",
            title: "School Librarian",
            category: "support",
            badgeText: "Learning Resources",
            description: "Library book cataloging, reader cards, literacy resources.",
            trcnStatus: "none",
          },
          {
            id: "Cleaner / Security / Driver",
            title: "Auxiliary / Driver / Security",
            category: "support",
            badgeText: "General Support",
            description: "Premises security, pupil transit transportation, campus sanitation.",
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
            badgeText: "Curriculum Subject",
            description: "Delivers syllabus, marks continuous assessment tests, records terminal examination scores.",
            trcnStatus: "mandatory",
          },
          {
            id: "Form Tutor (Class Teacher)",
            title: "Form Tutor / Class Teacher",
            category: "teaching",
            badgeText: "Class & Arm Manager",
            description: "Manages class register, behavior remarks, broadsheet verification, report cards.",
            trcnStatus: "mandatory",
          },
          {
            id: "Head of Department (HOD)",
            title: "Head of Department (HOD)",
            category: "leadership",
            badgeText: "Department Supervisor",
            description: "Supervises Sciences, Arts, Commercial, or Languages; vets lesson notes and exams.",
            trcnStatus: "mandatory",
          },
          {
            id: "Vice Principal (Academics)",
            title: "Vice Principal (Academics)",
            category: "leadership",
            badgeText: "Academic Executive",
            description: "Academic timetable, examination schedules, WAEC/NECO registrations.",
            trcnStatus: "mandatory",
          },
          {
            id: "Vice Principal (Admin)",
            title: "Vice Principal (Admin)",
            category: "leadership",
            badgeText: "Administrative Executive",
            description: "Staff discipline, school plant maintenance, non-academic personnel coordination.",
            trcnStatus: "mandatory",
          },
          {
            id: "Principal",
            title: "Principal",
            category: "leadership",
            badgeText: "Executive Head",
            description: "Chief executive officer of the secondary school; ministry liaison and broadsheet seal.",
            trcnStatus: "mandatory",
          },
          {
            id: "Bursar",
            title: "School Bursar",
            category: "support",
            badgeText: "Financial Accounting",
            description: "Fee billings, payment verification, cashbook management, financial audits.",
            trcnStatus: "none",
          },
          {
            id: "Lab Technologist",
            title: "Laboratory Technologist",
            category: "support",
            badgeText: "Science Labs",
            description: "Prepares science lab apparatus & reagents for WAEC/NECO practical exams.",
            trcnStatus: "none",
          },
          {
            id: "Librarian",
            title: "Secondary Librarian",
            category: "support",
            badgeText: "Resource Center",
            description: "Maintains library index, digital learning terminals, and text inventory.",
            trcnStatus: "none",
          },
          {
            id: "Admin",
            title: "Administrative Officer",
            category: "support",
            badgeText: "Admin Desk",
            description: "Student dossiers, external exam entries, transcript requests, official letters.",
            trcnStatus: "none",
          },
          {
            id: "Support Staff",
            title: "Support / Security / Driver",
            category: "support",
            badgeText: "Logistics & Security",
            description: "Campus security watch, student transit bus operations, groundskeeping.",
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

  const selectedItem = roleGroups.find((r) => r.id === selectedRole);
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
        return tierCategory;
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
        {/* Trigger Button Styled as a Clean Placeholder Form Field */}
        <button
          type="button"
          id="staff-role-picker"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full text-left bg-white border rounded-xl px-3.5 py-2.5 text-xs font-medium flex items-center justify-between transition outline-none cursor-pointer ${
            error
              ? "border-rose-400 bg-rose-50/20 focus:ring-2 focus:ring-rose-400"
              : isOpen
              ? "border-blue-500 ring-2 ring-blue-500/20"
              : "border-slate-300 hover:border-slate-400 focus:ring-2 focus:ring-blue-500"
          }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {selectedItem ? (
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
            ) : (
              <span className="text-slate-400 font-normal truncate">{placeholderText}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {selectedRole && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRole("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onSelectRole("");
                  }
                }}
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition cursor-pointer"
                title="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-blue-600" : ""
              }`}
            />
          </div>
        </button>

        {/* FLOATING LIST OF ROLES PER INSTITUTIONAL TIER */}
        {isOpen && (
          <div className="absolute z-50 mt-1.5 w-full bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* SEARCH FILTER */}
            <div className="p-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${tierDisplay} roles (e.g. Teacher, HOD, Bursar)...`}
                className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
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
                        onClick={() => {
                          onSelectRole(role.id);
                          setIsOpen(false);
                          setSearchQuery("");
                        }}
                        className={`p-2.5 rounded-xl transition cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected
                            ? "bg-blue-50 border border-blue-200 text-blue-900"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
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
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
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
                        onClick={() => {
                          onSelectRole(role.id);
                          setIsOpen(false);
                          setSearchQuery("");
                        }}
                        className={`p-2.5 rounded-xl transition cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected
                            ? "bg-purple-50 border border-purple-200 text-purple-900"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
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
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
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
                        onClick={() => {
                          onSelectRole(role.id);
                          setIsOpen(false);
                          setSearchQuery("");
                        }}
                        className={`p-2.5 rounded-xl transition cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected
                            ? "bg-slate-100 border border-slate-300 text-slate-900"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
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
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5">
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
