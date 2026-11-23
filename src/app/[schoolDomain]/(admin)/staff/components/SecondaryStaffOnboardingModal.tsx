"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Check,
  AlertCircle,
  GraduationCap,
  Award,
  Layers,
  School,
  AlertTriangle,
  UserCheck,
  Briefcase,
  ShieldCheck,
  Lock,
  Calendar,
  MapPin,
  Phone,
  Mail,
  User,
  CreditCard,
  Building2,
  RefreshCw,
} from "lucide-react";
import StaffRolePickerForm from "./StaffRolePickerForm";
import {
  SECONDARY_STAFF_ROLES,
  SECONDARY_HOD_DEPARTMENTS,
  NURSERY_PRIMARY_SECONDARY_QUALIFICATIONS,
  isNonTeachingRole,
  NIGERIAN_BANKS,
  getPayGradesForTier,
} from "@/lib/staff-roles-config";
import {
  SharedFormData,
  INITIAL_SHARED_FORM_DATA,
} from "./StaffOnboardingSharedSections";
import { createEnterpriseStaffAction, fetchSchoolClassesAction } from "../actions";

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger",
  "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "FCT Abuja"
];

export interface SecondaryClassItem {
  id: string;
  name: string;
  stream?: string;
}

// STRICTLY 12 CLASSES ONLY: JSS 1A to SSS 3B (Arms A and B only, NO Arms C-F)
export const FIXED_SECONDARY_12_CLASSES: SecondaryClassItem[] = [
  { id: "sec-jss1-a", name: "JSS 1A" },
  { id: "sec-jss1-b", name: "JSS 1B" },
  { id: "sec-jss2-a", name: "JSS 2A" },
  { id: "sec-jss2-b", name: "JSS 2B" },
  { id: "sec-jss3-a", name: "JSS 3A" },
  { id: "sec-jss3-b", name: "JSS 3B" },
  { id: "sec-sss1-a", name: "SSS 1A", stream: "Sciences" },
  { id: "sec-sss1-b", name: "SSS 1B", stream: "Arts & Humanities" },
  { id: "sec-sss2-a", name: "SSS 2A", stream: "Sciences" },
  { id: "sec-sss2-b", name: "SSS 2B", stream: "Arts & Humanities" },
  { id: "sec-sss3-a", name: "SSS 3A", stream: "Sciences" },
  { id: "sec-sss3-b", name: "SSS 3B", stream: "Arts & Commercial" },
];

export const SECONDARY_STANDARD_SUBJECTS = [
  "English Language",
  "Mathematics",
  "Civic Education",
  "Biology",
  "Chemistry",
  "Physics",
  "Agricultural Science",
  "Economics",
  "Government",
  "Literature-in-English",
  "Geography",
  "Commerce",
  "Financial Accounting",
  "Further Mathematics",
  "Computer Studies / Data Processing",
  "Christian Religious Studies (CRS)",
  "Islamic Religious Studies (IRS)",
  "French",
  "Technical Drawing",
  "Food & Nutrition",
] as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (staff: any) => void;
  schoolId: string;
  schoolDomain: string;
  schoolName: string;
  classrooms?: Array<{ id: string; name: string }>;
  lineManagers?: Array<{ id: string; firstName: string; lastName: string; staffId?: string }>;
}

// Unified badge color system for all headers
function SectionHeader({
  letter,
  title,
  subtitle,
  badgeRight,
}: {
  letter: string;
  title: string;
  subtitle: string;
  badgeRight?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
          {letter}
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-slate-800 text-sm truncate">{title}</h4>
          <p className="text-xs text-slate-600 truncate">{subtitle}</p>
        </div>
      </div>
      {badgeRight && <div className="shrink-0">{badgeRight}</div>}
    </div>
  );
}

// Full-width role permissions card with exactly 3 bullets and no duplicate title
function RolePermissionsCard({ role }: { role: string }) {
  const norm = (role || "").toLowerCase();
  let roleTitle = "Subject Teacher";
  let bullets: string[] = [];

  if (norm.includes("form tutor") || norm.includes("class teacher")) {
    roleTitle = "Form Tutor / Class Master";
    bullets = [
      "Manage daily roll-call attendance register and student pastoral care for assigned class arm.",
      "Compile terminal report cards and write Form Master academic performance remarks.",
      "Access student attendance summaries, conduct logs, and terminal broadsheets.",
    ];
  } else if (norm.includes("hod") || norm.includes("head of department")) {
    roleTitle = "Head of Department (HOD)";
    bullets = [
      "Supervise department subject teachers and vet termly schemes of work compliance.",
      "Review and approve Continuous Assessment (CA) and terminal examination questions.",
      "Audit departmental marks submissions and liaise with Vice Principal (Academics).",
    ];
  } else if (norm.includes("vice principal") || norm.includes("principal")) {
    roleTitle = role || "Secondary School Executive Leadership";
    bullets = [
      "Executive oversight of curriculum delivery, master timetables, and academic standards.",
      "Approve terminal broadsheets, WAEC / NECO external exam registrations, and official awards.",
      "Supervise teaching staff attendance, institutional discipline, and statutory Ministry reports.",
    ];
  } else if (norm.includes("bursar") || norm.includes("account")) {
    roleTitle = "Bursar / School Finance Officer";
    bullets = [
      "Manage tuition collection, invoice issuance, fee payment receipts, and bank reconciliations.",
      "Administer monthly staff payroll vouchers and statutory deductions.",
      "Strictly restricted from modifying student academic grades or assessment scores.",
    ];
  } else if (norm.includes("guidance") || norm.includes("counselor")) {
    roleTitle = "Guidance & Career Counselor";
    bullets = [
      "Coordinate student psycho-social counseling and confidential student dossier management.",
      "Guide senior secondary students on SSCE and UTME subject combinations for tertiary careers.",
      "Monitor student behavioral logs and collaborate with Form Tutors on pastoral interventions.",
    ];
  } else if (norm.includes("librarian") || norm.includes("lab")) {
    roleTitle = role || "Academic Support Specialist";
    bullets = [
      "Maintain departmental inventory, laboratory equipment, and CBT digital resource centres.",
      "Coordinate practical laboratory sessions with subject teachers for WAEC / NECO preparations.",
      "Enforce laboratory safety protocols and manage textbook allocation records.",
    ];
  } else if (norm.includes("admin") || norm.includes("support")) {
    roleTitle = role || "Administrative & Support Staff";
    bullets = [
      "Manage institutional correspondence, student admissions files, and state education returns.",
      "Maintain front-desk parent inquiries, visitor registrations, and campus facilities.",
      "Restricted from altering student academic records or school financial ledgers.",
    ];
  } else {
    roleTitle = "Subject Teacher";
    bullets = [
      "Record CA1 (20), CA2 (20), and Terminal Examination (60) scores for assigned classes.",
      "Track student subject attendance and generate termly subject performance broadsheets.",
      "Strictly restricted from modifying financial records or scores outside assigned subjects.",
    ];
  }

  return (
    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
        <span className="font-bold text-emerald-950 text-xs">
          Active Permissions Boundary — {roleTitle}
        </span>
      </div>
      <ul className="space-y-1.5 pl-6 list-disc text-emerald-900 font-medium">
        {bullets.map((b, idx) => (
          <li key={idx} className="leading-relaxed">
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SecondaryStaffOnboardingModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
  schoolDomain,
  schoolName,
  classrooms: propClassrooms = [],
  lineManagers = [],
}: Props) {
  const [formData, setFormData] = useState<SharedFormData>({
    ...INITIAL_SHARED_FORM_DATA,
    role: "",
    payGrade: "",
    status: "ACTIVE",
  });

  // Section C: Qualifications & TRCN
  const [qualification, setQualification] = useState<string>("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [institutionAttended, setInstitutionAttended] = useState("");
  const [yearGraduated, setYearGraduated] = useState("");
  const [trcnNumber, setTrcnNumber] = useState("");
  const [trcnExpiry, setTrcnExpiry] = useState("");

  // Section D: Secondary Assignments
  const [classesList, setClassesList] = useState<SecondaryClassItem[]>(FIXED_SECONDARY_12_CLASSES);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [classLoadError, setClassLoadError] = useState<string | null>(null);
  const [formTutorClassId, setFormTutorClassId] = useState<string>("");
  const [teachingClassIds, setTeachingClassIds] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [customSubjectInput, setCustomSubjectInput] = useState("");
  const [selectedHodDepartments, setSelectedHodDepartments] = useState<string[]>([]);

  // Validation & Submission
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitSummaryError, setSubmitSummaryError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-calculate age from DOB
  const age = useMemo(() => {
    if (!formData.dateOfBirth) return null;
    const dob = new Date(formData.dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let calculatedAge = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) calculatedAge--;
    return calculatedAge;
  }, [formData.dateOfBirth]);

  // Sync Emergency Contact when checkbox checked
  useEffect(() => {
    if (formData.sameAsNextOfKin) {
      setFormData((prev) => ({
        ...prev,
        emergencyName: prev.nextOfKinName,
        emergencyPhone: prev.nextOfKinPhone,
      }));
    }
  }, [formData.sameAsNextOfKin, formData.nextOfKinName, formData.nextOfKinPhone]);

  // Auto-fill account name from First + Last Name if empty
  useEffect(() => {
    if (!formData.accountName && (formData.firstName || formData.lastName)) {
      setFormData((prev) => ({
        ...prev,
        accountName: `${prev.firstName} ${prev.lastName}`.trim(),
      }));
    }
  }, [formData.firstName, formData.lastName, formData.accountName]);

  // Fetch real school classes and enforce strictly 2 arms (Arms A and B ONLY)
  const loadSchoolClasses = async () => {
    setIsLoadingClasses(true);
    setClassLoadError(null);
    try {
      const res = await fetchSchoolClassesAction(schoolDomain);
      if (res.success && res.data && res.data.length > 0) {
        // Map DB classes to the 12 standard classes (strictly Arms A & B only)
        const mapped12: SecondaryClassItem[] = FIXED_SECONDARY_12_CLASSES.map((std) => {
          // Look for direct match like "JSS 1A" or "JSS 1 (A)"
          const directMatch = res.data.find((c: any) => {
            const n = (c.name || "").replace(/\s+/g, "").toUpperCase();
            const target = std.name.replace(/\s+/g, "").toUpperCase();
            return n === target || n.startsWith(target);
          });
          if (directMatch) {
            return { id: directMatch.id, name: std.name, stream: std.stream };
          }
          // If no specific arm in DB, check if base level exists (e.g. "JSS 1")
          const levelPrefix = std.name.slice(0, -1).trim(); // "JSS 1"
          const baseMatch = res.data.find((c: any) => {
            const n = (c.name || "").trim().toUpperCase();
            return n === levelPrefix.toUpperCase();
          });
          if (baseMatch) {
            const isArmA = std.name.endsWith("A");
            return {
              id: isArmA ? baseMatch.id : `${baseMatch.id}-b`,
              name: std.name,
              stream: std.stream,
            };
          }
          return std;
        });

        setClassesList(mapped12);
      } else {
        setClassesList(FIXED_SECONDARY_12_CLASSES);
      }
    } catch (err: any) {
      console.error("Failed to load school classes:", err);
      setClassLoadError("Could not load classes. Check connection and retry.");
      setClassesList(FIXED_SECONDARY_12_CLASSES);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSchoolClasses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, schoolDomain]);

  if (!isOpen) return null;

  const isNonTeaching = isNonTeachingRole(formData.role);
  const isFormTutor = formData.role.toLowerCase().includes("form tutor") || formData.role === "Class Teacher";
  const isSubjectTeacher = formData.role.toLowerCase().includes("subject teacher") || formData.role === "Teacher";
  const isHod = formData.role.toLowerCase().includes("hod") || formData.role.toLowerCase().includes("head of department");
  const isLeadership =
    formData.role.toLowerCase().includes("principal") ||
    formData.role.toLowerCase().includes("vice principal");

  const isTrcnExpired = trcnExpiry ? new Date(trcnExpiry) < new Date() : false;

  const handleFieldChange = (field: keyof SharedFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const toggleTeachingClass = (clsId: string) => {
    setTeachingClassIds((prev) =>
      prev.includes(clsId) ? prev.filter((id) => id !== clsId) : [...prev, clsId]
    );
    if (errors.teachingClasses) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.teachingClasses;
        return next;
      });
    }
  };

  const toggleSubject = (subj: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj]
    );
    if (errors.subjects) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.subjects;
        return next;
      });
    }
  };

  const toggleHodDepartment = (dept: string) => {
    setSelectedHodDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
    if (errors.hodDepartments) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.hodDepartments;
        return next;
      });
    }
  };

  const handleAddCustomSubject = () => {
    const val = customSubjectInput.trim();
    if (!val) return;
    if (!selectedSubjects.includes(val)) {
      setSelectedSubjects((prev) => [...prev, val]);
      if (errors.subjects) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.subjects;
          return next;
        });
      }
    }
    setCustomSubjectInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSummaryError(null);

    const localErrors: Record<string, string> = {};

    // Role
    if (!formData.role || !formData.role.trim()) {
      localErrors.role = "Please select a staff role from the designation matrix.";
    }

    // Section A
    if (!formData.firstName.trim()) localErrors.firstName = "First Name is required.";
    if (!formData.lastName.trim()) localErrors.lastName = "Last Name is required.";
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      localErrors.email = "Valid official email address is required.";
    }
    if (!formData.phone.trim()) localErrors.phone = "Phone number is required.";
    if (!formData.dateOfBirth) localErrors.dateOfBirth = "Date of Birth is required.";
    if (!formData.gender) localErrors.gender = "Gender is required.";
    if (!formData.residentialAddress.trim()) localErrors.residentialAddress = "Residential Address is required.";
    if (!formData.state) localErrors.state = "State of Origin / Residence is required.";

    // Section B
    if (!formData.dateOfEmployment) localErrors.dateOfEmployment = "Date of Employment is required.";
    if (!formData.employmentType) localErrors.employmentType = "Employment Type is required.";
    if (!formData.departmentName) localErrors.departmentName = "Department / Unit is required.";

    // Section C
    if (!qualification.trim()) localErrors.qualification = "Highest Qualification is required.";
    if (!fieldOfStudy.trim()) localErrors.fieldOfStudy = "Field of Study / Major is required.";

    // TRCN Rule for Secondary Teaching Roles
    if (!isNonTeaching) {
      if (!trcnNumber.trim()) {
        localErrors.trcnNumber = "TRCN Registration Number is mandatory for Secondary School teachers.";
      }
      if (isTrcnExpired) {
        localErrors.trcnExpiry = "TRCN License has expired. Please provide a valid active license date.";
      }
    }

    // Section D Validation
    if (!isNonTeaching) {
      if (isFormTutor && !formTutorClassId) {
        localErrors.formTutorClass = "Select the assigned Class / Arm for this Form Tutor.";
      }
      // CRITICAL BLOCK: BLOCK submit if Role = Subject Teacher AND Classes = 0
      if (isSubjectTeacher && teachingClassIds.length === 0) {
        localErrors.teachingClasses = "Select at least 1 secondary class/arm taught.";
      }
      if (isSubjectTeacher && selectedSubjects.length === 0) {
        localErrors.subjects = "Select at least 1 secondary subject.";
      }
      if (isHod && selectedHodDepartments.length === 0) {
        localErrors.hodDepartments = "Select at least 1 secondary department for HOD supervision.";
      }
    }

    // Section E: Next of Kin
    if (!formData.nextOfKinName.trim()) localErrors.nextOfKinName = "Next of Kin Full Name is required.";
    if (!formData.nextOfKinRelationship) localErrors.nextOfKinRelationship = "Next of Kin Relationship is required.";
    if (!formData.nextOfKinPhone.trim()) localErrors.nextOfKinPhone = "Next of Kin Phone is required.";

    // Section F: Payroll & NUBAN
    const salaryNum = Number(formData.baseSalary) || 0;
    if (formData.bankAccountNumber.trim() || salaryNum > 0) {
      const nubanDigits = formData.bankAccountNumber.trim().replace(/\D/g, "");
      if (nubanDigits.length !== 10) {
        localErrors.bankAccountNumber = "Account Number must be exactly 10 numerical digits.";
      }
      if (!formData.bankName.trim()) {
        localErrors.bankName = "Bank Name is required when Account Number is provided.";
      }
    }

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      setSubmitSummaryError(
        `${Object.keys(localErrors).length} field(s) need attention. Please review the highlighted items below.`
      );

      // Auto-scroll smoothly to the first error
      setTimeout(() => {
        const firstErrorKey = Object.keys(localErrors)[0];
        let targetElem = document.getElementById(`field-${firstErrorKey}`);
        if (!targetElem && (firstErrorKey === "teachingClasses" || firstErrorKey === "subjects" || firstErrorKey === "formTutorClass")) {
          targetElem = document.getElementById("section-d-container");
        }
        if (targetElem) {
          targetElem.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);

      return;
    }

    setIsSubmitting(true);

    try {
      const assignmentsPayload: any[] = [];
      if (!isNonTeaching) {
        const effectiveTeachingClassIds =
          teachingClassIds.length > 0
            ? teachingClassIds
            : formTutorClassId
            ? [formTutorClassId]
            : [];

        if (formTutorClassId) {
          const selectedClass = classesList.find((c) => c.id === formTutorClassId);
          assignmentsPayload.push({
            assignmentType: "FormTutor",
            classroomId: formTutorClassId,
            metadata: {
              className: selectedClass?.name || "Assigned Form Class",
              roleTitle: isFormTutor ? "Form Tutor" : "Assigned Class",
              subjects: selectedSubjects,
            },
          });
        }
        if (effectiveTeachingClassIds.length > 0) {
          effectiveTeachingClassIds.forEach((clsId) => {
            if (
              clsId === formTutorClassId &&
              assignmentsPayload.some((a) => a.classroomId === clsId && a.assignmentType === "FormTutor")
            ) {
              return;
            }
            const cls = classesList.find((c) => c.id === clsId);
            assignmentsPayload.push({
              assignmentType: "SubjectTeacher",
              classroomId: clsId,
              metadata: {
                className: cls?.name,
                subjects: selectedSubjects,
              },
            });
          });
        }
        if (isHod) {
          assignmentsPayload.push({
            assignmentType: "SecondaryHOD",
            metadata: {
              departments: selectedHodDepartments,
              responsibilities: "Scheme of Work Approval, Marking Verification, Subject Coordination",
            },
          });
        }
        if (isLeadership) {
          assignmentsPayload.push({
            assignmentType: "SecondaryLeadership",
            metadata: {
              title: formData.role,
              oversight: "Whole Secondary School / Academic Administration",
            },
          });
        }
      }

      const res = await createEnterpriseStaffAction(schoolDomain, {
        tierCategory: "SECONDARY",
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        maritalStatus: formData.maritalStatus,
        phone: formData.phone,
        email: formData.email,
        residentialAddress: formData.residentialAddress,
        state: formData.state,
        lga: formData.lga,
        nin: formData.nin,
        passportUrl: formData.passportUrl,

        staffId: formData.staffId,
        dateOfEmployment: formData.dateOfEmployment,
        employmentType: formData.employmentType,
        departmentName: isHod ? selectedHodDepartments.join(", ") : formData.departmentName,
        reportingToId: formData.reportingToId || null,
        status: formData.status,

        highestQualification: qualification,
        fieldOfStudy,
        institutionAttended,
        yearGraduated,
        trcnNumber: trcnNumber.trim() || undefined,
        trcnExpiry: trcnExpiry || undefined,
        trcnStatus: isTrcnExpired ? "EXPIRED" : trcnNumber ? "ACTIVE" : undefined,

        nextOfKinName: formData.nextOfKinName,
        nextOfKinRelationship: formData.nextOfKinRelationship,
        nextOfKinPhone: formData.nextOfKinPhone,
        nextOfKinAddress: formData.nextOfKinAddress,
        emergencyName: formData.emergencyName,
        emergencyPhone: formData.emergencyPhone,
        guarantorName: formData.guarantorName,
        guarantorPhone: formData.guarantorPhone,

        baseSalary: salaryNum,
        payGrade: formData.payGrade,
        bankName: formData.bankName,
        bankAccountNumber: formData.bankAccountNumber,
        accountName: formData.accountName,
        pensionRsa: formData.pensionRsa,
        pensionProvider: formData.pensionProvider,
        nhisNo: formData.nhisNo,
        tin: formData.tin,
        paymentMethod: formData.paymentMethod,

        role: formData.role,
        assignments: assignmentsPayload,
      });

      if (!res.success) {
        setSubmitSummaryError(res.error || "Failed to onboard staff member.");
        setIsSubmitting(false);
        return;
      }

      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      console.error("[SecondaryStaffOnboardingModal] Submit error:", err);
      setSubmitSummaryError(err.message || "An unexpected error occurred during submission.");
      setIsSubmitting(false);
    }
  };

  const secondaryPayGrades = getPayGradesForTier("SECONDARY");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto max-h-[92vh]">
        {/* MODAL HEADER (STICKY SHRINK-0) */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
              <School className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black tracking-tight truncate">Secondary School Staff Onboarding</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 text-[10px] font-black uppercase tracking-wider border border-emerald-400/30 shrink-0">
                  Secondary Tier
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium mt-0.5 truncate">
                {schoolName} • WAEC / NECO Standards • JSS 1 - SSS 3 Arms A &amp; B
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TOP SUMMARY ERROR BANNER */}
        {submitSummaryError && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 shrink-0 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{submitSummaryError}</span>
          </div>
        )}

        {/* FORM CONTAINER WITH SCROLLABLE BODY AND STICKY FOOTER */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* SCROLLABLE BODY (EXACT ORDER: A -> B -> C -> D -> E -> F -> G) */}
          <div
            ref={scrollContainerRef}
            className="overflow-y-auto p-4 sm:p-6 pb-8 space-y-6 flex-1 overflow-x-hidden"
          >
            {/* DYNAMIC ROLE PICKER FORM (PUSHES CONTENT DOWN, NO OVERLAP) */}
            <div id="field-role">
              <StaffRolePickerForm
                tierCategory="SECONDARY"
                selectedRole={formData.role}
                onSelectRole={(role) => {
                  setFormData((prev) => ({ ...prev, role }));
                  if (errors.role) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.role;
                      return next;
                    });
                  }
                }}
                error={errors.role}
              />
              {errors.role && (
                <p className="text-[11px] text-rose-500 font-medium mt-1.5 px-1">{errors.role}</p>
              )}
            </div>

            {/* =================================================================== */}
            {/* SECTION A: PERSONAL & IDENTITY                                     */}
            {/* =================================================================== */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
              <SectionHeader
                letter="A"
                title="Personal & Identity"
                subtitle="Official government names, birth record, state of origin, and identity credentials"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* First Name */}
                <div id="field-firstName">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleFieldChange("firstName", e.target.value)}
                    placeholder="e.g. Chioma"
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500 ${
                      errors.firstName ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.firstName && <p className="text-[11px] text-rose-500 mt-1">{errors.firstName}</p>}
                </div>

                {/* Last Name */}
                <div id="field-lastName">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Last Name / Surname <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleFieldChange("lastName", e.target.value)}
                    placeholder="e.g. Okeke"
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500 ${
                      errors.lastName ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.lastName && <p className="text-[11px] text-rose-500 mt-1">{errors.lastName}</p>}
                </div>

                {/* Middle Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Middle Name <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => handleFieldChange("middleName", e.target.value)}
                    placeholder="e.g. Blessing"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                {/* DOB */}
                <div id="field-dateOfBirth">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Date of Birth <span className="text-rose-500">*</span>
                    </label>
                    {age !== null && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        age >= 18 && age <= 70 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                      }`}>
                        Age: {age} yrs
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleFieldChange("dateOfBirth", e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                      errors.dateOfBirth ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.dateOfBirth && <p className="text-[11px] text-rose-500 mt-1">{errors.dateOfBirth}</p>}
                </div>

                {/* Gender */}
                <div id="field-gender">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gender <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleFieldChange("gender", e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                      errors.gender ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  >
                    <option value="">-- Select Gender --</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                  {errors.gender && <p className="text-[11px] text-rose-500 mt-1">{errors.gender}</p>}
                </div>

                {/* Marital Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marital Status</label>
                  <select
                    value={formData.maritalStatus}
                    onChange={(e) => handleFieldChange("maritalStatus", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">-- Select Status --</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>

                {/* NIN (Fully visible, no cutoff) */}
                <div id="field-nin">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIN <span className="text-slate-500 font-normal">(11 Digits)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={formData.nin}
                    onChange={(e) => handleFieldChange("nin", e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 12345678901"
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono placeholder:text-slate-500 ${
                      errors.nin ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.nin && <p className="text-[11px] text-rose-500 mt-1">{errors.nin}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Phone */}
                <div id="field-phone">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    placeholder="e.g. 08031234567 or +234 803 123 4567"
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500 ${
                      errors.phone ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.phone && <p className="text-[11px] text-rose-500 mt-1">{errors.phone}</p>}
                </div>

                {/* Email */}
                <div id="field-email">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Work / Official Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange("email", e.target.value.toLowerCase())}
                    placeholder="e.g. staff.member@greenwood.edu.ng"
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500 ${
                      errors.email ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.email && <p className="text-[11px] text-rose-500 mt-1">{errors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Residential Address */}
                <div id="field-residentialAddress" className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Residential Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.residentialAddress}
                    onChange={(e) => handleFieldChange("residentialAddress", e.target.value)}
                    placeholder="e.g. 14 Mission Road, Enugu"
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500 ${
                      errors.residentialAddress ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.residentialAddress && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.residentialAddress}</p>
                  )}
                </div>

                {/* State */}
                <div id="field-state">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    State of Origin / Residence <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => handleFieldChange("state", e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                      errors.state ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  >
                    <option value="">-- Select State --</option>
                    {NIGERIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  {errors.state && <p className="text-[11px] text-rose-500 mt-1">{errors.state}</p>}
                </div>
              </div>
            </div>

            {/* =================================================================== */}
            {/* SECTION B: EMPLOYMENT & INSTITUTIONAL ROLE                         */}
            {/* =================================================================== */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
              <SectionHeader
                letter="B"
                title="Employment & Institutional Role"
                subtitle="Auto-generated Staff ID, resumption date, employment type, and department"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Staff ID: Disabled, grey, placeholder "EGD/STF/001 - auto" */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Staff ID</label>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                      Auto-generated on Save
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={formData.staffId || ""}
                    placeholder="EGD/STF/001 - auto"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 text-slate-600 font-mono font-semibold cursor-not-allowed placeholder:text-slate-500"
                  />
                  <p className="text-[11px] text-slate-600 mt-1">Unique staff identifier created automatically upon save.</p>
                </div>

                {/* Date of Employment */}
                <div id="field-dateOfEmployment">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date of Employment <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfEmployment}
                    onChange={(e) => handleFieldChange("dateOfEmployment", e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                      errors.dateOfEmployment ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.dateOfEmployment && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.dateOfEmployment}</p>
                  )}
                </div>

                {/* Employment Type */}
                <div id="field-employmentType">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employment Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) => handleFieldChange("employmentType", e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                      errors.employmentType ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  >
                    <option value="">-- Select Type --</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="NYSC">NYSC Intern</option>
                    <option value="Intern">Student Intern</option>
                  </select>
                  {errors.employmentType && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.employmentType}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Department Name */}
                <div id="field-departmentName">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Department / Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.departmentName}
                    onChange={(e) => handleFieldChange("departmentName", e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                      errors.departmentName ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  >
                    <option value="">-- Select Department / Unit --</option>
                    <option value="Sciences">Sciences (Maths, Physics, Chem, Bio)</option>
                    <option value="Arts / Humanities">Arts / Humanities (Lit, CRS, Govt, Hist)</option>
                    <option value="Commercial">Commercial (Accts, Comm, Econ)</option>
                    <option value="Languages">Languages (English, Igbo, Yoruba, French)</option>
                    <option value="Administration">Administration &amp; Bursary</option>
                  </select>
                  {errors.departmentName && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.departmentName}</p>
                  )}
                </div>

                {/* Reporting To */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reporting To / Line Manager <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={formData.reportingToId}
                    onChange={(e) => handleFieldChange("reportingToId", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">-- No Direct Line Manager --</option>
                    {lineManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} {m.staffId ? `(${m.staffId})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* =================================================================== */}
            {/* SECTION C: EDUCATIONAL QUALIFICATIONS & TRCN COMPLIANCE            */}
            {/* =================================================================== */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
              <SectionHeader
                letter="C"
                title="Educational Qualifications & TRCN Compliance"
                subtitle="Teacher qualifications, field of study, and statutory TRCN registration"
                badgeRight={
                  !isNonTeaching && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      TRCN Mandatory for Secondary
                    </span>
                  )
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Highest Qualification */}
                <div id="field-qualification">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Highest Qualification <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={qualification}
                    onChange={(e) => {
                      setQualification(e.target.value);
                      if (errors.qualification) {
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n.qualification;
                          return n;
                        });
                      }
                    }}
                    className={`w-full text-xs font-medium border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 ${
                      errors.qualification ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  >
                    <option value="">-- Select Highest Qualification --</option>
                    {NURSERY_PRIMARY_SECONDARY_QUALIFICATIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                  {errors.qualification && (
                    <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.qualification}</p>
                  )}
                </div>

                {/* Field of Study */}
                <div id="field-fieldOfStudy">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Field of Study / Major <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fieldOfStudy}
                    onChange={(e) => {
                      setFieldOfStudy(e.target.value);
                      if (errors.fieldOfStudy) {
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n.fieldOfStudy;
                          return n;
                        });
                      }
                    }}
                    placeholder="e.g. Physics Education, English Literature, Mathematics"
                    className={`w-full text-xs font-medium border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500 ${
                      errors.fieldOfStudy ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.fieldOfStudy && (
                    <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.fieldOfStudy}</p>
                  )}
                </div>

                {/* Institution Attended */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Institution Attended</label>
                  <input
                    type="text"
                    value={institutionAttended}
                    onChange={(e) => setInstitutionAttended(e.target.value)}
                    placeholder="e.g. University of Nigeria, Nsukka"
                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500"
                  />
                </div>

                {/* Year Graduated */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Year of Graduation</label>
                  <input
                    type="number"
                    min="1970"
                    max={new Date().getFullYear()}
                    value={yearGraduated}
                    onChange={(e) => setYearGraduated(e.target.value)}
                    placeholder="e.g. 2018"
                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* TRCN REGISTRATION SECTION */}
              <div className="pt-3 border-t border-slate-200 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-700" />
                    <span>TRCN License / Registration Number</span>
                    {!isNonTeaching ? (
                      <span className="text-rose-500 font-bold">*</span>
                    ) : (
                      <span className="text-slate-500 font-normal">(Optional for non-teaching)</span>
                    )}
                  </label>
                  {trcnNumber && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isTrcnExpired
                          ? "bg-rose-100 text-rose-700 border border-rose-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      }`}
                    >
                      {isTrcnExpired ? "Expired License" : "Active License"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div id="field-trcnNumber">
                    <input
                      type="text"
                      value={trcnNumber}
                      onChange={(e) => {
                        setTrcnNumber(e.target.value);
                        if (errors.trcnNumber) {
                          setErrors((prev) => {
                            const n = { ...prev };
                            delete n.trcnNumber;
                            return n;
                          });
                        }
                      }}
                      placeholder="e.g. TRCN/LA/2019/33102"
                      className={`w-full text-xs font-mono uppercase border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500 ${
                        errors.trcnNumber ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                      }`}
                    />
                    {errors.trcnNumber && (
                      <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.trcnNumber}</p>
                    )}
                  </div>

                  <div id="field-trcnExpiry">
                    <input
                      type="date"
                      value={trcnExpiry}
                      onChange={(e) => {
                        setTrcnExpiry(e.target.value);
                        if (errors.trcnExpiry) {
                          setErrors((prev) => {
                            const n = { ...prev };
                            delete n.trcnExpiry;
                            return n;
                          });
                        }
                      }}
                      className={`w-full text-xs font-medium border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 ${
                        errors.trcnExpiry ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                      }`}
                    />
                    {errors.trcnExpiry && (
                      <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.trcnExpiry}</p>
                    )}
                    {isTrcnExpired && !errors.trcnExpiry && (
                      <p className="text-[11px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        License expired on {trcnExpiry}. Renewal required.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* =================================================================== */}
            {/* SECTION D: CLASSROOM & SUBJECT ASSIGNMENTS                         */}
            {/* =================================================================== */}
            <div id="section-d-container" className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
              <SectionHeader
                letter="D"
                title={`Classroom & Subject Assignments ${formData.role ? `(${formData.role})` : ""}`}
                subtitle="Assign Form Class, toggle teaching classes (max Arms A & B), and select subjects"
                badgeRight={
                  <span className="text-[10px] font-bold text-slate-600">
                    {isFormTutor
                      ? "Form Tutor Allocation"
                      : isSubjectTeacher
                      ? "Class & Subject Assignment"
                      : isHod
                      ? "HOD Supervision"
                      : isNonTeaching
                      ? "Support Staff"
                      : "Secondary Leadership"}
                  </span>
                }
              />

              {!isNonTeaching ? (
                <div className="space-y-4">
                  {/* HOD Department Selection (multi-department support) */}
                  {isHod && (
                    <div id="field-hodDepartments" className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-emerald-700" />
                          <span>HOD Supervised Department(s)</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] text-emerald-800 font-semibold">
                          Can supervise 1 or more departments
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {SECONDARY_HOD_DEPARTMENTS.map((dept) => {
                          const isSelected = selectedHodDepartments.includes(dept);
                          return (
                            <button
                              key={dept}
                              type="button"
                              onClick={() => toggleHodDepartment(dept)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold border text-left flex items-center justify-between transition cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <span>{dept}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                      {errors.hodDepartments && (
                        <p className="text-[11px] text-rose-500 font-medium">{errors.hodDepartments}</p>
                      )}
                    </div>
                  )}

                  {/* 1. ASSIGNED FORM CLASS (ONE DROPDOWN ONLY) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="field-formTutorClass" className="block text-xs font-bold text-slate-700">
                        Assigned Form Class / Arm (Form Tutor)
                        {isFormTutor && <span className="text-rose-500"> *</span>}
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {isFormTutor ? "Mandatory for Form Tutor" : "Optional Form Class"}
                      </span>
                    </div>
                    <select
                      id="field-formTutorClass"
                      value={formTutorClassId}
                      onChange={(e) => {
                        setFormTutorClassId(e.target.value);
                        if (errors.formTutorClass) {
                          setErrors((prev) => {
                            const n = { ...prev };
                            delete n.formTutorClass;
                            return n;
                          });
                        }
                      }}
                      className={`w-full text-xs font-semibold border rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-emerald-500 ${
                        errors.formTutorClass ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                      }`}
                    >
                      <option value="">-- None / No Form Class Assigned --</option>
                      {classesList.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} {cls.stream ? `(${cls.stream})` : ""}
                        </option>
                      ))}
                    </select>
                    {errors.formTutorClass && (
                      <p className="text-[11px] text-rose-500 font-medium">{errors.formTutorClass}</p>
                    )}
                    <p className="text-[11px] text-slate-600">
                      Assigns this teacher as Form Tutor responsible for student attendance and terminal reports.
                    </p>
                  </div>

                  {/* 2. CLASSES / ARMS TAUGHT (ONE PICKER ONLY - QUICK TOGGLES, NO EXTRA DROPDOWNS) */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          Classes / Arms Taught {isSubjectTeacher && <span className="text-rose-500">*</span>}
                        </label>
                        <p className="text-[11px] text-slate-600">
                          Click any class pill to toggle assignment (Strictly Arms A &amp; B only).
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        teachingClassIds.length > 0 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-slate-100 text-slate-600"
                      }`}>
                        {teachingClassIds.length} {teachingClassIds.length === 1 ? "class" : "classes"} selected
                      </span>
                    </div>

                    {classLoadError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700">
                        <span>{classLoadError}</span>
                        <button
                          type="button"
                          onClick={loadSchoolClasses}
                          className="px-2.5 py-1 bg-white border border-rose-300 rounded-lg font-bold hover:bg-rose-100 transition flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}

                    {/* 12 CLASS PILLS GRID (STRICTLY ARMS A & B ONLY) */}
                    <div
                      id="field-teachingClasses"
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3 bg-slate-50/70 rounded-2xl border border-slate-200"
                    >
                      {classesList.map((cls) => {
                        const isChecked = teachingClassIds.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => toggleTeachingClass(cls.id)}
                            className={`group px-3 py-2 rounded-xl text-left border flex flex-col justify-center transition cursor-pointer ${
                              isChecked
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold"
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={`text-xs font-bold tracking-tight ${isChecked ? "text-white" : "text-slate-800"}`}>
                                {cls.name}
                              </span>
                              {isChecked ? (
                                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                  <Check className="w-3 h-3 text-white stroke-[3]" />
                                </span>
                              ) : (
                                <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                              )}
                            </div>
                            {cls.stream && (
                              <span
                                className={`text-[10px] font-medium leading-none mt-1 truncate ${
                                  isChecked ? "text-emerald-100" : "text-slate-500 group-hover:text-slate-600"
                                }`}
                              >
                                {cls.stream}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {errors.teachingClasses && (
                      <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.teachingClasses}</p>
                    )}
                  </div>

                  {/* 3. SUBJECTS TAUGHT (MULTI-SELECT PILLS WITH LIVE COUNTER) */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          Subjects Taught {isSubjectTeacher && <span className="text-rose-500">*</span>}
                        </label>
                        <p className="text-[11px] text-slate-600">Select subjects taught across the assigned secondary classes.</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        selectedSubjects.length > 0 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-slate-100 text-slate-600"
                      }`}>
                        {selectedSubjects.length} {selectedSubjects.length === 1 ? "subject" : "subjects"} selected
                      </span>
                    </div>

                    <div
                      id="field-subjects"
                      className="flex flex-wrap gap-1.5 p-3 bg-slate-50/70 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto"
                    >
                      {SECONDARY_STANDARD_SUBJECTS.map((subj) => {
                        const isSelected = selectedSubjects.includes(subj);
                        return (
                          <button
                            key={subj}
                            type="button"
                            onClick={() => toggleSubject(subj)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <span>{subj}</span>
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                            ) : (
                              <span className="text-slate-400 font-normal">+</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {errors.subjects && (
                      <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.subjects}</p>
                    )}

                    {/* Custom Subject Addition */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={customSubjectInput}
                        onChange={(e) => setCustomSubjectInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomSubject();
                          }
                        }}
                        placeholder="Add another secondary subject (e.g. Visual Arts, Music)..."
                        className="text-xs border border-slate-300 rounded-xl px-3 py-2 flex-1 bg-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSubject}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        + Add Subject
                      </button>
                    </div>
                  </div>

                  {/* Executive Leadership Note */}
                  {isLeadership && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                      <School className="w-5 h-5 text-emerald-700 shrink-0" />
                      <div>
                        <h5 className="text-xs font-bold text-emerald-900">
                          Secondary School Executive Leadership
                        </h5>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          Scope: Academic administration, termly broadsheets approval, WAEC/NECO registrations,
                          and staff supervision across JSS 1 - SSS 3.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-center gap-3">
                  <UserCheck className="w-4 h-4 text-slate-500 shrink-0" />
                  <p className="text-xs text-slate-600 font-medium">
                    Teaching assignments are not required for administrative/support role:{" "}
                    <span className="font-bold text-slate-800">{formData.role}</span>.
                  </p>
                </div>
              )}
            </div>

            {/* =================================================================== */}
            {/* SECTION E: NEXT OF KIN + EMERGENCY CONTACT + GUARANTOR             */}
            {/* =================================================================== */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
              <SectionHeader
                letter="E"
                title="Next of Kin, Emergency Contact & Guarantor"
                subtitle="Primary next of kin, emergency contacts, and institutional guarantor (all together)"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* NOK Name */}
                <div id="field-nextOfKinName">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Next of Kin Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nextOfKinName}
                    onChange={(e) => handleFieldChange("nextOfKinName", e.target.value)}
                    placeholder="e.g. Emeka Okeke"
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500 ${
                      errors.nextOfKinName ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.nextOfKinName && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.nextOfKinName}</p>
                  )}
                </div>

                {/* Relationship */}
                <div id="field-nextOfKinRelationship">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Relationship <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.nextOfKinRelationship}
                    onChange={(e) => handleFieldChange("nextOfKinRelationship", e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                      errors.nextOfKinRelationship ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  >
                    <option value="">-- Select Relationship --</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Child">Child</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Other Relative">Other Relative</option>
                  </select>
                  {errors.nextOfKinRelationship && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.nextOfKinRelationship}</p>
                  )}
                </div>

                {/* NOK Phone */}
                <div id="field-nextOfKinPhone">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Next of Kin Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.nextOfKinPhone}
                    onChange={(e) => handleFieldChange("nextOfKinPhone", e.target.value)}
                    placeholder="e.g. 08029876543"
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500 ${
                      errors.nextOfKinPhone ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.nextOfKinPhone && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.nextOfKinPhone}</p>
                  )}
                </div>
              </div>

              {/* Emergency Checkbox: If checked -> auto-fill + HIDE duplicate fields */}
              <div className="pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.sameAsNextOfKin}
                    onChange={(e) => handleFieldChange("sameAsNextOfKin", e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span>Emergency contact is the same as Next of Kin</span>
                </label>
              </div>

              {/* Emergency Fields (HIDDEN IF CHECKED, SHOWN IF UNCHECKED) */}
              {!formData.sameAsNextOfKin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Full Name</label>
                    <input
                      type="text"
                      value={formData.emergencyName}
                      onChange={(e) => handleFieldChange("emergencyName", e.target.value)}
                      placeholder="e.g. Dr. Ngozi Eze"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Phone</label>
                    <input
                      type="tel"
                      value={formData.emergencyPhone}
                      onChange={(e) => handleFieldChange("emergencyPhone", e.target.value)}
                      placeholder="e.g. 08035551212"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              )}

              {/* Institutional Guarantor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guarantor Full Name <span className="text-slate-500 font-normal">(Institutional surety)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.guarantorName}
                    onChange={(e) => handleFieldChange("guarantorName", e.target.value)}
                    placeholder="e.g. Barrister Chukwuemeka O."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Guarantor Phone Number</label>
                  <input
                    type="tel"
                    value={formData.guarantorPhone}
                    onChange={(e) => handleFieldChange("guarantorPhone", e.target.value)}
                    placeholder="e.g. 08037654321"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* =================================================================== */}
            {/* SECTION F: PAYROLL & STATUTORY / BANKING                           */}
            {/* =================================================================== */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
              <SectionHeader
                letter="F"
                title="Payroll & Statutory / Banking"
                subtitle="Salary structure, 10-digit NUBAN bank account, and statutory pension/TIN"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Base Salary (FIXED ₦ ICON OVERLAP) */}
                <div id="field-baseSalary">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Base Monthly Salary (NGN) <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600 pointer-events-none">
                      ₦
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={formData.baseSalary}
                      onChange={(e) => handleFieldChange("baseSalary", e.target.value)}
                      placeholder="e.g. 150000"
                      className={`w-full pl-8 pr-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono font-semibold placeholder:text-slate-500 ${
                        errors.baseSalary ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                      }`}
                    />
                  </div>
                  {errors.baseSalary && <p className="text-[11px] text-rose-500 mt-1">{errors.baseSalary}</p>}
                </div>

                {/* Pay Grade */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pay Grade / Scale <span className="text-slate-500 font-normal">(Secondary)</span>
                  </label>
                  <select
                    value={formData.payGrade}
                    onChange={(e) => handleFieldChange("payGrade", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
                  >
                    <option value="">-- Select Pay Grade --</option>
                    {secondaryPayGrades.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => handleFieldChange("paymentMethod", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">-- Select Method --</option>
                    <option value="Bank Transfer">Bank Transfer (NUBAN)</option>
                    <option value="Cash / Cheque">Cash / Manual Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Bank Name */}
                <div id="field-bankName">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bank Name {formData.bankAccountNumber && <span className="text-rose-500">*</span>}
                  </label>
                  <select
                    value={formData.bankName}
                    onChange={(e) => handleFieldChange("bankName", e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                      errors.bankName ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  >
                    <option value="">-- Choose Commercial Bank --</option>
                    {NIGERIAN_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  {errors.bankName && <p className="text-[11px] text-rose-500 mt-1">{errors.bankName}</p>}
                </div>

                {/* Account Number */}
                <div id="field-bankAccountNumber">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account No <span className="text-[10px] text-slate-500 font-normal">(10-Digit NUBAN)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formData.bankAccountNumber}
                    onChange={(e) => handleFieldChange("bankAccountNumber", e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 0123456789"
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono font-semibold placeholder:text-slate-500 ${
                      errors.bankAccountNumber ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.bankAccountNumber && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.bankAccountNumber}</p>
                  )}
                </div>

                {/* Account Holder Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={formData.accountName}
                    onChange={(e) => handleFieldChange("accountName", e.target.value)}
                    placeholder="e.g. Chioma Okeke"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Statutory Pension & TIN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pension RSA PIN</label>
                  <input
                    type="text"
                    value={formData.pensionRsa}
                    onChange={(e) => handleFieldChange("pensionRsa", e.target.value)}
                    placeholder="e.g. PEN10023456789"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PFA / Pension Provider</label>
                  <input
                    type="text"
                    value={formData.pensionProvider}
                    onChange={(e) => handleFieldChange("pensionProvider", e.target.value)}
                    placeholder="e.g. Stanbic IBTC Pension"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tax ID Number (TIN)</label>
                  <input
                    type="text"
                    value={formData.tin}
                    onChange={(e) => handleFieldChange("tin", e.target.value)}
                    placeholder="e.g. 23456789-0001"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* =================================================================== */}
            {/* SECTION G: ACCOUNT CREDENTIALS & SYSTEM PERMISSIONS               */}
            {/* =================================================================== */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
              <SectionHeader
                letter="G"
                title="Account Credentials & System Permissions"
                subtitle="Portal username, mandatory first-login password reset, and role permissions boundary"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Portal Username: Auto-fills from Section A email or shows fallback */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Portal Username <span className="text-[10px] text-emerald-700 font-semibold">(Auto = Email)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={formData.email ? formData.email : ""}
                    placeholder={formData.email ? formData.email : "Will use email from Section A"}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 text-slate-600 font-mono font-semibold cursor-not-allowed placeholder:text-slate-500"
                  />
                  <p className="text-[11px] text-slate-600 mt-1">
                    {formData.email
                      ? "Auto-filled from Section A official email address."
                      : "Will use email from Section A once entered."}
                  </p>
                </div>

                {/* Security Protocol */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Security Enforcement</label>
                  <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-700 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Force Password Reset on First Login: <strong>ON (Mandatory)</strong></span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">Temporary password dispatched automatically on save.</p>
                </div>
              </div>

              {/* ROLE PERMISSIONS CARD: SHOWS ONCE, FULL-WIDTH, 3 BULLETS, NO DUPLICATE */}
              <RolePermissionsCard role={formData.role} />

              {/* DISPATCH NOTIFICATION */}
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p>
                  Initial temporary login credentials are cryptographically generated server-side and dispatched
                  directly to the staff member&apos;s verified work email. Passwords are never exposed in administrative views.
                </p>
              </div>
            </div>
          </div>

          {/* STICKY FOOTER (ALWAYS VISIBLE WHILE SCROLLING) */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 z-20 shadow-lg">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Onboarding Staff...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Onboard Secondary Staff</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}