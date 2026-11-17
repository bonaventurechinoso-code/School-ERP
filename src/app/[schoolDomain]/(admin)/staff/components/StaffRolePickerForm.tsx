"use client";

import React, { useMemo } from "react";
import {
  StaffTierCategory,
  CRECHE_STAFF_ROLES,
  NURSERY_STAFF_ROLES,
  PRIMARY_STAFF_ROLES,
  SECONDARY_STAFF_ROLES,
  TERTIARY_UNIVERSITY_ACADEMIC_ROLES,
  TERTIARY_POLYTECHNIC_ACADEMIC_ROLES,
  TERTIARY_ADMIN_ROLES,
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
  BookOpen,
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
  // Generate structured, tier-specific role items
  const roleGroups = useMemo(() => {
    switch (tierCategory) {
      case "CRECHE": {
        const items: RoleItem[] = [
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
        return items;
      }

      case "NURSERY": {
        const items: RoleItem[] = [
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
        return items;
      }

      case "PRIMARY": {
        const items: RoleItem[] = [
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
        return items;
      }

      case "SECONDARY": {
        const items: RoleItem[] = [
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
        return items;
      }

      case "TERTIARY": {
        const academicRoles = isPolytechnic
          ? TERTIARY_POLYTECHNIC_ACADEMIC_ROLES
          : TERTIARY_UNIVERSITY_ACADEMIC_ROLES;

        const items: RoleItem[] = [
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
            category: "leadership",
            badgeText: "Academic Department Lead",
            description: "Formal academic administrator; presides over departmental board, course allocations & marks.",
            trcnStatus: "optional",
          },
          {
            id: "Dean",
            title: "Dean of Faculty / School",
            category: "leadership",
            badgeText: "Faculty Executive",
            description: "Heads faculty board of studies; approves semester results and degree recommendations.",
            trcnStatus: "optional",
          },
          {
            id: "Provost / Rector / Vice-Chancellor",
            title: isPolytechnic ? "Rector / Deputy Rector" : "Vice-Chancellor / DVC",
            category: "leadership",
            badgeText: "Principal Officer",
            description: "Chief executive & academic officer of the higher institution.",
            trcnStatus: "optional",
          },
          {
            id: "Registrar / Bursar (Non-Academic)",
            title: "Registrar / Bursar",
            category: "support",
            badgeText: "Principal Administration",
            description: "Institutional custodian of academic records, admissions, personnel, and finances.",
            trcnStatus: "none",
          },
          {
            id: "Lab Technologist",
            title: "Chief / Principal Technologist",
            category: "support",
            badgeText: "Engineering / Science Labs",
            description: "Manages university/polytechnic workshops, diagnostic equipment, and studio benches.",
            trcnStatus: "none",
          },
          {
            id: "Admin Officer",
            title: "Faculty / Departmental Officer",
            category: "support",
            badgeText: "Academic Registry",
            description: "Coordinates student matriculation, exam slips, course registration clearance.",
            trcnStatus: "none",
          },
          {
            id: "Support Staff",
            title: "Works & Support Services",
            category: "support",
            badgeText: "Campus Services",
            description: "Works, physical planning, security patrol, campus sanitation.",
            trcnStatus: "none",
          },
        ];
        return items;
      }

      default:
        return [];
    }
  }, [tierCategory, isPolytechnic]);

  const selectedItem = roleGroups.find((r) => r.id === selectedRole);
  const isNonTeaching = isNonTeachingRole(selectedRole);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                Select Staff Role / Position
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {tierCategory} Tier
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose the candidate&apos;s designated appointment. Roster privileges and assignments adapt automatically.
            </p>
          </div>
        </div>

        {selectedRole ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shrink-0 self-start sm:self-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Active Role: {selectedRole}</span>
          </div>
        ) : (
          <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl shrink-0 self-start sm:self-auto">
            Selection Required *
          </span>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ROLE PICKER CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {roleGroups.map((role) => {
          const isSelected = selectedRole === role.id;
          const isTeaching = role.category === "teaching";
          const isLeader = role.category === "leadership";

          return (
            <div
              key={role.id}
              onClick={() => onSelectRole(role.id)}
              className={`relative p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                isSelected
                  ? "bg-blue-50/70 border-blue-600 shadow-sm ring-2 ring-blue-500/20"
                  : "bg-slate-50/60 hover:bg-white hover:border-slate-300 border-slate-200"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {isTeaching ? (
                      <GraduationCap className={`w-4 h-4 ${isSelected ? "text-blue-600" : "text-slate-500"}`} />
                    ) : isLeader ? (
                      <Award className={`w-4 h-4 ${isSelected ? "text-purple-600" : "text-slate-500"}`} />
                    ) : (
                      <Briefcase className={`w-4 h-4 ${isSelected ? "text-slate-700" : "text-slate-400"}`} />
                    )}
                    <h4 className={`text-xs font-bold leading-tight ${isSelected ? "text-blue-900 font-extrabold" : "text-slate-800"}`}>
                      {role.title}
                    </h4>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
                  {role.description}
                </p>
              </div>

              {/* TAGS */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  isTeaching
                    ? "bg-blue-100/70 text-blue-700"
                    : isLeader
                    ? "bg-purple-100/70 text-purple-700"
                    : "bg-slate-200/70 text-slate-700"
                }`}>
                  {role.badgeText}
                </span>

                {role.trcnStatus === "mandatory" && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5 text-amber-600" />
                    TRCN Required
                  </span>
                )}
                {role.trcnStatus === "optional" && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    TRCN (if available)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DYNAMIC FEEDBACK BANNER BASED ON SELECTION */}
      {selectedItem ? (
        <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 transition-all ${
          isNonTeaching
            ? "bg-amber-50/70 border-amber-200 text-amber-900"
            : "bg-blue-50/70 border-blue-200 text-blue-900"
        }`}>
          {isNonTeaching ? (
            <Briefcase className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <Layers className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <span className="font-bold block">
              {isNonTeaching ? "Non-Teaching / Support Post Selected:" : "Teaching / Academic Post Selected:"}
            </span>
            <p className="text-[11px] leading-relaxed">
              {isNonTeaching ? (
                <>
                  Teaching unit and classroom allocations (Section D) will be <strong>hidden</strong>. Staff member will be assigned administrative permissions and personnel records only.
                </>
              ) : (
                <>
                  Teaching allocations in Section D are <strong>active</strong>. You will be prompted to allocate classrooms, subjects, or courses according to {tierCategory} regulations.
                </>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
          Click any card above to select the candidate&apos;s role. The form will adapt dynamically.
        </div>
      )}
    </div>
  );
}
