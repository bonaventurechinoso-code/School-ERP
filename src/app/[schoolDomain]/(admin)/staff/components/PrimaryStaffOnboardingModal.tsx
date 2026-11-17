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
} from "lucide-react";
import StaffOnboardingSharedSections, {
  SharedFormData,
  INITIAL_SHARED_FORM_DATA,
} from "./StaffOnboardingSharedSections";
import StaffRolePickerForm from "./StaffRolePickerForm";
import {
  PRIMARY_STAFF_ROLES,
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

export const PRIMARY_STANDARD_SUBJECTS = [
  "English Studies",
  "Mathematics",
  "Basic Science & Technology",
  "Social Studies",
  "Civic Education",
  "Cultural & Creative Arts (CCA)",
  "Christian Religious Studies (CRS)",
  "Islamic Religious Studies (IRS)",
  "Physical & Health Education (PHE)",
  "Agricultural Science",
  "Home Economics",
  "French",
  "Computer Studies / ICT",
  "Nigerian Language (Yoruba/Igbo/Hausa)",
] as const;

export default function PrimaryStaffOnboardingModal({
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
  });

  // Section C: Primary Specific Qualification & TRCN
  const [qualification, setQualification] = useState<string>("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [institutionAttended, setInstitutionAttended] = useState("");
  const [yearGraduated, setYearGraduated] = useState("");
  const [trcnNumber, setTrcnNumber] = useState("");
  const [trcnExpiry, setTrcnExpiry] = useState("");

  // Section D: Primary Assignments
  const [availableClasses, setAvailableClasses] = useState<Array<{ id: string; name: string }>>(propClassrooms);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [assignedClassId, setAssignedClassId] = useState<string>("");
  const [subjectTeacherClassIds, setSubjectTeacherClassIds] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [customSubjectInput, setCustomSubjectInput] = useState("");

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
        }
      } catch (err) {
        console.error("Failed to load classes for primary modal:", err);
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
  const isClassTeacher = formData.role === "Class Teacher";
  const isSubjectTeacher = formData.role === "Subject Teacher";
  const isLeadership = formData.role === "Head Teacher" || formData.role === "Assistant Head Teacher";

  // TRCN validation helper: check if expired
  const isTrcnExpired = trcnExpiry ? new Date(trcnExpiry) < new Date() : false;

  const toggleSubjectClass = (clsId: string) => {
    setSubjectTeacherClassIds((prev) =>
      prev.includes(clsId) ? prev.filter((id) => id !== clsId) : [...prev, clsId]
    );
  };

  const toggleSubject = (subj: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj]
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
    if (!formData.role || !formData.role.trim()) {
      localErrors.role = "Please select a staff role from the role matrix above.";
    }
    if (!formData.firstName.trim()) localErrors.firstName = "First Name is required.";
    if (!formData.lastName.trim()) localErrors.lastName = "Last Name is required.";
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      localErrors.email = "Valid official email address is required.";
    }
    if (!formData.phone.trim()) localErrors.phone = "Phone number is required.";
    if (!formData.residentialAddress.trim()) localErrors.residentialAddress = "Residential Address is required.";
    if (!formData.dateOfBirth) localErrors.dateOfBirth = "Date of Birth is required.";
    if (!formData.state) localErrors.state = "State of Origin / Residence is required.";
    if (!formData.employmentType) localErrors.employmentType = "Employment Type is required.";
    if (!formData.departmentName) localErrors.departmentName = "Department / Unit is required.";
    if (!qualification.trim()) localErrors.qualification = "Please select highest qualification.";
    if (!fieldOfStudy.trim()) localErrors.fieldOfStudy = "Field of Study / Major is required.";
    if (!formData.nextOfKinName.trim()) localErrors.nextOfKinName = "Next of Kin Name is required.";
    if (!formData.nextOfKinRelationship) localErrors.nextOfKinRelationship = "Next of Kin Relationship is required.";
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

    // TRCN Rule for Primary Teaching Roles
    if (!isNonTeaching) {
      if (!trcnNumber.trim()) {
        localErrors.trcnNumber = "TRCN License / Registration Number is mandatory for Primary School teachers.";
      }
      if (isTrcnExpired) {
        localErrors.trcnExpiry = "TRCN License is expired. Please renew or provide an active license expiry.";
      }
    }

    // Assignment validation
    if (!isNonTeaching) {
      if (isClassTeacher && !assignedClassId) {
        localErrors.assignedClass = "Please select an assigned class for this Class Teacher.";
      }
      if (isSubjectTeacher) {
        if (subjectTeacherClassIds.length === 0) {
          localErrors.subjectClasses = "Select at least 1 class for this Subject Teacher.";
        }
        if (selectedSubjects.length === 0) {
          localErrors.subjects = "Select at least 1 primary subject.";
        }
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
        if (isClassTeacher) {
          const selectedClass = availableClasses.find((c) => c.id === assignedClassId);
          assignmentsPayload = [
            {
              assignmentType: "ClassTeacher",
              classroomId: assignedClassId,
              metadata: {
                className: selectedClass?.name || "Assigned Primary Class",
                roleTitle: "Class Teacher",
                subjects: selectedSubjects,
              },
            },
          ];
        } else if (isSubjectTeacher) {
          assignmentsPayload = subjectTeacherClassIds.map((clsId) => {
            const cls = availableClasses.find((c) => c.id === clsId);
            return {
              assignmentType: "SubjectTeacher",
              classroomId: clsId,
              metadata: {
                className: cls?.name,
                subjects: selectedSubjects,
              },
            };
          });
        } else if (isLeadership) {
          assignmentsPayload = [
            {
              assignmentType: "PrimaryLeadership",
              metadata: {
                title: formData.role,
                oversight: "All Primary Classes",
              },
            },
          ];
        }
      }

      const res = await createEnterpriseStaffAction(schoolDomain, {
        tierCategory: "PRIMARY",
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
        departmentName: formData.departmentName,
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
      console.error("[PrimaryStaffOnboardingModal] Submit error:", err);
      setSubmitError(err.message || "An unexpected error occurred during submission.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <School className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">Primary School Staff Onboarding</h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-100 text-[10px] font-black uppercase tracking-wider border border-blue-400/30">
                  Primary School Tier
                </span>
              </div>
              <p className="text-xs text-blue-100/90 font-medium mt-0.5">
                {schoolName} • TRCN Verified National Curriculum Onboarding
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

          {/* DYNAMIC ROLE PICKER FORM */}
          <StaffRolePickerForm
            tierCategory="PRIMARY"
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

          {/* SHARED SECTIONS A & B */}
          <StaffOnboardingSharedSections
            tierCategory="PRIMARY"
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
                <GraduationCap className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Section C: Educational Qualifications & TRCN Compliance
                </h4>
              </div>
              {!isNonTeaching && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                  TRCN Mandatory for Primary Teaching
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
                  className={`w-full text-xs font-medium border rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 ${
                    errors.qualification ? "border-red-400 bg-red-50/30" : "border-slate-300"
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
                  <p className="text-[11px] text-red-600 font-medium mt-1">{errors.qualification}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Field of Study / Major <span className="text-red-500">*</span>
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
                  placeholder="e.g. Primary Education, English Education, Mathematics"
                  className={`w-full text-xs font-medium border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 ${
                    errors.fieldOfStudy ? "border-red-400 bg-red-50/30" : "border-slate-300"
                  }`}
                />
                {errors.fieldOfStudy && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{errors.fieldOfStudy}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Institution Attended
                </label>
                <input
                  type="text"
                  value={institutionAttended}
                  onChange={(e) => setInstitutionAttended(e.target.value)}
                  placeholder="e.g. Federal College of Education, University of Lagos"
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
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
                  placeholder="e.g. 2018"
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* TRCN REGISTRATION SECTION */}
            <div className="pt-3 border-t border-slate-200 mt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-blue-600" />
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
                    placeholder="e.g. TRCN/LA/2021/48910"
                    className={`w-full text-xs font-mono uppercase border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 ${
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
                    className={`w-full text-xs font-medium border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 ${
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

          {/* SECTION D: PRIMARY TEACHING ASSIGNMENTS (HIDDEN FOR NON-TEACHING) */}
          {!isNonTeaching ? (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Section D: Primary Academic Assignment ({formData.role})
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  {isClassTeacher
                    ? "Single Class Allocation"
                    : isSubjectTeacher
                    ? "Multi-Class & Subject Assignment"
                    : "Primary School Leadership"}
                </span>
              </div>

              {/* CLASSROOM SELECTION / EMPTY STATE CHECK */}
              {isLoadingClasses ? (
                <div className="p-4 text-center text-xs text-slate-500 animate-pulse">
                  Loading school classrooms...
                </div>
              ) : availableClasses.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-amber-800">No classes found for this school</h5>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Classrooms must be created before assigning teachers to them.
                    </p>
                    <Link
                      href={`/${schoolDomain}/classes`}
                      target="_blank"
                      className="inline-block mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                    >
                      Open Classes Management to create classes →
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* CASE 1: CLASS TEACHER (SINGLE CLASS) */}
                  {isClassTeacher && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">
                        Class Assigned (Class Teacher) <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={assignedClassId}
                        onChange={(e) => {
                          setAssignedClassId(e.target.value);
                          if (errors.assignedClass) {
                            setErrors((prev) => {
                              const n = { ...prev };
                              delete n.assignedClass;
                              return n;
                            });
                          }
                        }}
                        className={`w-full text-xs font-semibold border rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 ${
                          errors.assignedClass ? "border-red-400 bg-red-50/30" : "border-slate-300"
                        }`}
                      >
                        <option value="">-- Select Class --</option>
                        {availableClasses.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                      {errors.assignedClass && (
                        <p className="text-[11px] text-red-600 font-medium">{errors.assignedClass}</p>
                      )}
                    </div>
                  )}

                  {/* CASE 2: SUBJECT TEACHER (MULTI-CLASS + MULTI-SUBJECT) */}
                  {isSubjectTeacher && (
                    <div className="space-y-4">
                      {/* Classes Multi-select */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Classes Assigned to Teach <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {availableClasses.map((cls) => {
                            const isChecked = subjectTeacherClassIds.includes(cls.id);
                            return (
                              <button
                                key={cls.id}
                                type="button"
                                onClick={() => toggleSubjectClass(cls.id)}
                                className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left flex items-center justify-between transition cursor-pointer ${
                                  isChecked
                                    ? "bg-blue-50 border-blue-400 text-blue-800 shadow-2xs"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                <span className="truncate">{cls.name}</span>
                                {isChecked && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                        {errors.subjectClasses && (
                          <p className="text-[11px] text-red-600 font-medium mt-1">
                            {errors.subjectClasses}
                          </p>
                        )}
                      </div>

                      {/* Subjects Multi-select Chips */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700">
                            Primary Subjects Assigned <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[10px] text-slate-500">
                            {selectedSubjects.length} selected
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                          {PRIMARY_STANDARD_SUBJECTS.map((subj) => {
                            const isSelected = selectedSubjects.includes(subj);
                            return (
                              <button
                                key={subj}
                                type="button"
                                onClick={() => toggleSubject(subj)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                                  isSelected
                                    ? "bg-blue-600 text-white border-blue-600"
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
                            placeholder="Add another subject (e.g. Diction & Phonetics)..."
                            className="text-xs border border-slate-300 rounded-xl px-3 py-1.5 flex-1 bg-white focus:ring-2 focus:ring-blue-500"
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

                  {/* CASE 3: LEADERSHIP (HEAD TEACHER / ASST HEAD TEACHER) */}
                  {isLeadership && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3">
                      <School className="w-5 h-5 text-blue-700 shrink-0" />
                      <div>
                        <h5 className="text-xs font-bold text-blue-900">
                          Primary School Academic Leadership
                        </h5>
                        <p className="text-[11px] text-blue-700 mt-0.5">
                          Supervises all classes ({availableClasses.length} active classes in school), schemes of
                          work, and statutory academic registers.
                        </p>
                      </div>
                    </div>
                  )}
                </>
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
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Onboarding Staff...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Onboard Primary Staff</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
