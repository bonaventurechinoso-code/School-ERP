"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  X,
  BookOpen,
  Sparkles,
  Check,
  AlertCircle,
  GraduationCap,
  Award,
  Layers,
  School,
  AlertTriangle,
  UserCheck,
  Briefcase,
  ShieldAlert,
} from "lucide-react";
import StaffOnboardingSharedSections, {
  SharedFormData,
  INITIAL_SHARED_FORM_DATA,
} from "./StaffOnboardingSharedSections";
import {
  SECONDARY_STAFF_ROLES,
  SECONDARY_HOD_DEPARTMENTS,
  NURSERY_PRIMARY_SECONDARY_QUALIFICATIONS,
  isNonTeachingRole,
} from "@/lib/staff-roles-config";
import { createEnterpriseStaffAction, fetchSchoolClassesAction, fetchSchoolSubjectsAction } from "../actions";

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
    role: "Subject Teacher",
    payGrade: "GL 08",
  });

  // Section C: Secondary Specific Qualification & TRCN
  const [qualification, setQualification] = useState<string>("B.Sc (Ed) / B.A (Ed)");
  const [fieldOfStudy, setFieldOfStudy] = useState("Science Education (Physics/Chemistry)");
  const [institutionAttended, setInstitutionAttended] = useState("");
  const [yearGraduated, setYearGraduated] = useState("");
  const [trcnNumber, setTrcnNumber] = useState("");
  const [trcnExpiry, setTrcnExpiry] = useState("");

  // Section D: Secondary Assignments
  const [availableClasses, setAvailableClasses] = useState<Array<{ id: string; name: string }>>(propClassrooms);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [formTutorClassId, setFormTutorClassId] = useState<string>("");
  const [teachingClassIds, setTeachingClassIds] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([
    "English Language",
    "Mathematics",
  ]);
  const [customSubjectInput, setCustomSubjectInput] = useState("");

  // Secondary HOD specifics (multi-department support)
  const [selectedHodDepartments, setSelectedHodDepartments] = useState<string[]>(["Sciences"]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch school classes dynamically when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadSchoolData() {
      setIsLoadingClasses(true);
      try {
        const res = await fetchSchoolClassesAction(schoolDomain);
        if (isMounted && res.success && res.data && res.data.length > 0) {
          setAvailableClasses(res.data.map((c: any) => ({ id: c.id, name: c.name })));
          if (!formTutorClassId) {
            setFormTutorClassId(res.data[0].id);
            setTeachingClassIds([res.data[0].id]);
          }
        }
      } catch (err) {
        console.error("Failed to load classes for secondary modal:", err);
      } finally {
        if (isMounted) setIsLoadingClasses(false);
      }
    }

    loadSchoolData();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, schoolDomain]);

  if (!isOpen) return null;

  const isNonTeaching = isNonTeachingRole(formData.role);
  const isFormTutor = formData.role.includes("Form Tutor") || formData.role === "Class Teacher";
  const isSubjectTeacher = formData.role === "Subject Teacher";
  const isHod = formData.role.includes("HOD") || formData.role.includes("Head of Department");
  const isLeadership =
    formData.role.includes("Principal") ||
    formData.role.includes("Vice Principal");

  // TRCN check
  const isTrcnExpired = trcnExpiry ? new Date(trcnExpiry) < new Date() : false;

  const toggleTeachingClass = (clsId: string) => {
    setTeachingClassIds((prev) =>
      prev.includes(clsId) ? prev.filter((id) => id !== clsId) : [...prev, clsId]
    );
  };

  const toggleSubject = (subj: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj]
    );
  };

  const toggleHodDepartment = (dept: string) => {
    setSelectedHodDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const handleAddCustomSubject = () => {
    if (!customSubjectInput.trim()) return;
    if (!selectedSubjects.includes(customSubjectInput.trim())) {
      setSelectedSubjects((prev) => [...prev, customSubjectInput.trim()]);
    }
    setCustomSubjectInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const localErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) localErrors.firstName = "First Name is required.";
    if (!formData.lastName.trim()) localErrors.lastName = "Last Name is required.";
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      localErrors.email = "Valid official email address is required.";
    }
    if (!formData.phone.trim()) localErrors.phone = "Phone number is required.";
    if (!formData.residentialAddress.trim()) localErrors.residentialAddress = "Residential Address is required.";
    if (!formData.dateOfBirth) localErrors.dateOfBirth = "Date of Birth is required.";
    if (!formData.nextOfKinName.trim()) localErrors.nextOfKinName = "Next of Kin Name is required.";
    if (!formData.nextOfKinPhone.trim()) localErrors.nextOfKinPhone = "Next of Kin Phone is required.";

    // Salary & NUBAN
    const salaryNum = Number(formData.baseSalary) || 0;
    if (formData.bankAccountNumber.trim() || salaryNum > 0) {
      const nubanClean = formData.bankAccountNumber.trim().replace(/\D/g, "");
      if (nubanClean.length !== 10) {
        localErrors.bankAccountNumber = "NUBAN Account Number must be exactly 10 numerical digits.";
      }
      if (!formData.bankName.trim()) {
        localErrors.bankName = "Bank Name is required when Account Number or Salary is provided.";
      }
    }

    // TRCN Rule for Secondary Teaching Roles
    if (!isNonTeaching) {
      if (!trcnNumber.trim()) {
        localErrors.trcnNumber = "TRCN License / Registration Number is mandatory for Secondary School teachers.";
      }
      if (isTrcnExpired) {
        localErrors.trcnExpiry = "TRCN License is expired. Please renew or provide an active license expiry.";
      }
    }

    // Assignment validation
    if (!isNonTeaching) {
      if (isFormTutor && !formTutorClassId) {
        localErrors.formTutorClass = "Please select the assigned Class / Arm for this Form Tutor.";
      }
      if (isSubjectTeacher) {
        if (teachingClassIds.length === 0) {
          localErrors.teachingClasses = "Select at least 1 secondary class/arm.";
        }
        if (selectedSubjects.length === 0) {
          localErrors.subjects = "Select at least 1 secondary subject.";
        }
      }
      if (isHod && selectedHodDepartments.length === 0) {
        localErrors.hodDepartments = "Select at least 1 secondary department for HOD supervision.";
      }
    }

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      let assignmentsPayload: any[] = [];
      if (!isNonTeaching) {
        if (isFormTutor) {
          const selectedClass = availableClasses.find((c) => c.id === formTutorClassId);
          assignmentsPayload.push({
            assignmentType: "FormTutor",
            classroomId: formTutorClassId,
            metadata: {
              className: selectedClass?.name || "Assigned Form Class",
              roleTitle: "Form Tutor",
              subjects: selectedSubjects,
            },
          });
        }
        if (isSubjectTeacher || (isHod && selectedSubjects.length > 0)) {
          teachingClassIds.forEach((clsId) => {
            const cls = availableClasses.find((c) => c.id === clsId);
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
        setSubmitError(res.error || "Failed to onboard staff member.");
        setIsSubmitting(false);
        return;
      }

      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      console.error("[SecondaryStaffOnboardingModal] Submit error:", err);
      setSubmitError(err.message || "An unexpected error occurred during submission.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <School className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">Secondary School Staff Onboarding</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 text-[10px] font-black uppercase tracking-wider border border-emerald-400/30">
                  Secondary School Tier
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium mt-0.5">
                {schoolName} • WAEC / NECO Standards • Term-Based Allocation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* SHARED SECTIONS A & B */}
          <StaffOnboardingSharedSections
            tierCategory="SECONDARY"
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            setErrors={setErrors}
            lineManagers={lineManagers}
          />

          {/* SECTION C: QUALIFICATIONS & TRCN COMPLIANCE */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Section C: Educational Qualifications & TRCN Compliance
                </h4>
              </div>
              {!isNonTeaching && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  TRCN Mandatory for Secondary Teaching
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Highest Qualification <span className="text-red-500">*</span>
                </label>
                <select
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  {NURSERY_PRIMARY_SECONDARY_QUALIFICATIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Field of Study / Major <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fieldOfStudy}
                  onChange={(e) => setFieldOfStudy(e.target.value)}
                  placeholder="e.g. Physics Education, English Literature, Mathematics, Economics"
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Institution Attended
                </label>
                <input
                  type="text"
                  value={institutionAttended}
                  onChange={(e) => setInstitutionAttended(e.target.value)}
                  placeholder="e.g. University of Ibadan, Obafemi Awolowo University"
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Year of Graduation</label>
                <input
                  type="number"
                  min="1970"
                  max={new Date().getFullYear()}
                  value={yearGraduated}
                  onChange={(e) => setYearGraduated(e.target.value)}
                  placeholder="e.g. 2016"
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* TRCN REGISTRATION SECTION */}
            <div className="pt-3 border-t border-slate-200 mt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                  <span>TRCN License / Registration Number</span>
                  {!isNonTeaching ? (
                    <span className="text-red-500 font-bold">*</span>
                  ) : (
                    <span className="text-slate-400 font-normal">(Optional for non-teaching)</span>
                  )}
                </label>
                {trcnNumber && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isTrcnExpired
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {isTrcnExpired ? "Expired License" : "Active License"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
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
                    className={`w-full text-xs font-mono uppercase border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 ${
                      errors.trcnNumber ? "border-red-400 bg-red-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.trcnNumber && (
                    <p className="text-[11px] text-red-600 font-medium mt-1">{errors.trcnNumber}</p>
                  )}
                </div>

                <div>
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
                      errors.trcnExpiry ? "border-red-400 bg-red-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.trcnExpiry && (
                    <p className="text-[11px] text-red-600 font-medium mt-1">{errors.trcnExpiry}</p>
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

          {/* SECTION D: SECONDARY TEACHING ASSIGNMENTS (HIDDEN FOR NON-TEACHING) */}
          {!isNonTeaching ? (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Section D: Secondary Academic Assignment ({formData.role})
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  {isFormTutor
                    ? "Form Tutor Allocation"
                    : isSubjectTeacher
                    ? "Class & Subject Assignment"
                    : isHod
                    ? "HOD Departmental Supervision"
                    : "Secondary Leadership"}
                </span>
              </div>

              {/* HOD SECTION (OPTIONAL ROLE, SUPPORTS MULTI-DEPARTMENT) */}
              {isHod && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-emerald-700" />
                      <span>HOD Supervised Department(s)</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-emerald-700 font-semibold">
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
                    <p className="text-[11px] text-red-600 font-medium">{errors.hodDepartments}</p>
                  )}
                  <p className="text-[11px] text-emerald-800 font-medium">
                    As HOD, this staff member supervises subject teachers in these departments, reviews
                    termly schemes of work, validates examination question submissions, and reports directly
                    to the Vice Principal (Academics).
                  </p>
                </div>
              )}

              {/* FORM TUTOR ALLOCATION */}
              {isFormTutor && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Assigned Form Class / Arm <span className="text-red-500">*</span>
                  </label>
                  <select
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
                      errors.formTutorClass ? "border-red-400 bg-red-50/30" : "border-slate-300"
                    }`}
                  >
                    <option value="">-- Select Class / Arm --</option>
                    {availableClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                  {errors.formTutorClass && (
                    <p className="text-[11px] text-red-600 font-medium">{errors.formTutorClass}</p>
                  )}
                </div>
              )}

              {/* SUBJECT TEACHER OR HOD TEACHING CLASSES */}
              {(isSubjectTeacher || isHod) && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Classes / Arms Taught <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {availableClasses.map((cls) => {
                        const isChecked = teachingClassIds.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => toggleTeachingClass(cls.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left flex items-center justify-between transition cursor-pointer ${
                              isChecked
                                ? "bg-emerald-50 border-emerald-400 text-emerald-800 shadow-2xs"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <span className="truncate">{cls.name}</span>
                            {isChecked && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    {errors.teachingClasses && (
                      <p className="text-[11px] text-red-600 font-medium mt-1">{errors.teachingClasses}</p>
                    )}
                  </div>

                  {/* Secondary Subjects Multi-select Chips */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Subjects Taught <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-500">
                        {selectedSubjects.length} selected
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                      {SECONDARY_STANDARD_SUBJECTS.map((subj) => {
                        const isSelected = selectedSubjects.includes(subj);
                        return (
                          <button
                            key={subj}
                            type="button"
                            onClick={() => toggleSubject(subj)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <span>{subj}</span>
                            {isSelected ? (
                              <X className="w-3 h-3" />
                            ) : (
                              <span className="text-slate-400">+</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {errors.subjects && (
                      <p className="text-[11px] text-red-600 font-medium mt-1">{errors.subjects}</p>
                    )}

                    {/* Custom Subject Addition */}
                    <div className="flex items-center gap-2 mt-2">
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
                        placeholder="Add another secondary subject (e.g. Visual Arts)..."
                        className="text-xs border border-slate-300 rounded-xl px-3 py-1.5 flex-1 bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSubject}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        + Add Subject
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* LEADERSHIP (PRINCIPAL / VICE PRINCIPALS) */}
              {isLeadership && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                  <School className="w-5 h-5 text-emerald-700 shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-emerald-900">
                      Secondary School Executive Leadership
                    </h5>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Scope of Oversight: Academic Administration, Termly Result Approvals, WAEC/NECO Registration,
                      and Staff Supervision across all Junior & Senior Secondary Arms.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-center gap-3">
              <UserCheck className="w-4 h-4 text-slate-500 shrink-0" />
              <p className="text-xs text-slate-600 font-medium">
                Teaching unit assignment is hidden for non-teaching administrative/support role:{" "}
                <span className="font-bold text-slate-800">{formData.role}</span>.
              </p>
            </div>
          )}

          {/* MODAL FOOTER */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between shrink-0">
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
                  <Check className="w-4 h-4" />
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
