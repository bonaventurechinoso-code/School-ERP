"use client";

import React, { useState } from "react";
import {
  X,
  BookOpen,
  Sparkles,
  Check,
  AlertCircle,
  Layers,
  GraduationCap,
  Heart,
  Palette,
} from "lucide-react";
import StaffOnboardingSharedSections, {
  SharedFormData,
  INITIAL_SHARED_FORM_DATA,
} from "./StaffOnboardingSharedSections";
import StaffRolePickerForm from "./StaffRolePickerForm";
import {
  NURSERY_STAFF_ROLES,
  NURSERY_PRIMARY_SECONDARY_QUALIFICATIONS,
  isNonTeachingRole,
} from "@/lib/staff-roles-config";
import { createEnterpriseStaffAction } from "../actions";

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

export const NURSERY_LEARNING_AREAS = [
  "Literacy & Phonics",
  "Numeracy & Number Readiness",
  "Rhymes, Songs & Drama",
  "Moral Habits & Civic Etiquette",
  "Fine & Gross Motor Skills",
  "Creative Arts, Crafts & Coloring",
  "Basic Science & Nature Study",
  "Health Habits & Personal Hygiene",
] as const;

export const DEFAULT_NURSERY_CLASSES = [
  "Nursery 1",
  "Nursery 2",
  "Kindergarten 1",
  "Kindergarten 2",
] as const;

export default function NurseryStaffOnboardingModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
  schoolDomain,
  schoolName,
  classrooms = [],
  lineManagers = [],
}: Props) {
  const [formData, setFormData] = useState<SharedFormData>({
    ...INITIAL_SHARED_FORM_DATA,
    role: "",
    payGrade: "",
  });

  // Section C: Nursery Specific Qualification
  const [qualification, setQualification] = useState<string>("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [institutionAttended, setInstitutionAttended] = useState("");
  const [yearGraduated, setYearGraduated] = useState("");
  const [trcnNumber, setTrcnNumber] = useState(""); // Optional for Nursery

  // Nursery Assignment Model
  const [assignedClass, setAssignedClass] = useState<string>("");
  const [isAssistantFloating, setIsAssistantFloating] = useState(false);
  const [multiAssignedClasses, setMultiAssignedClasses] = useState<string[]>([]);
  const [selectedLearningAreas, setSelectedLearningAreas] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isNonTeaching = isNonTeachingRole(formData.role);

  // Toggle multi-select classes if assistant/floating
  const toggleClassSelection = (clsName: string) => {
    setMultiAssignedClasses((prev) =>
      prev.includes(clsName) ? prev.filter((c) => c !== clsName) : [...prev, clsName]
    );
  };

  const toggleLearningArea = (area: string) => {
    setSelectedLearningAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
    if (errors.learningAreas) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.learningAreas;
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate
    const localErrors: Record<string, string> = {};
    if (!formData.role || !formData.role.trim()) {
      localErrors.role = "Please select a staff role from the role options above.";
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
    if (!formData.lga || !formData.lga.trim()) localErrors.lga = "LGA of Origin is required.";
    if (!formData.employmentType) localErrors.employmentType = "Employment Type is required.";
    if (!formData.departmentName) localErrors.departmentName = "Department / Unit is required.";
    if (!qualification.trim()) localErrors.qualification = "Please select highest qualification.";
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

    // Assignment validation
    if (!isNonTeaching) {
      if (isAssistantFloating && multiAssignedClasses.length === 0) {
        localErrors.assignedClass = "Select at least 1 nursery class for assistant / floating teacher.";
      } else if (!isAssistantFloating && !assignedClass.trim()) {
        localErrors.assignedClass = "Please select an assigned Nursery Class.";
      }

      if (selectedLearningAreas.length === 0) {
        localErrors.learningAreas = "Select at least 1 early years learning area.";
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
        if (isAssistantFloating) {
          assignmentsPayload = multiAssignedClasses.map((cls) => {
            const matched = classrooms.find((c) => c.name.toLowerCase() === cls.toLowerCase());
            return {
              assignmentType: "NurseryAssistant",
              classroomId: matched?.id || undefined,
              metadata: {
                className: cls,
                learningAreas: selectedLearningAreas,
                isFloating: true,
              },
            };
          });
        } else {
          const matched = classrooms.find((c) => c.name.toLowerCase() === assignedClass.toLowerCase());
          assignmentsPayload = [
            {
              assignmentType: "NurseryClassTeacher",
              classroomId: matched?.id || undefined,
              metadata: {
                className: assignedClass,
                learningAreas: selectedLearningAreas,
                isClassTeacher: true,
              },
            },
          ];
        }
      }

      const res = await createEnterpriseStaffAction(schoolDomain, {
        tierCategory: "NURSERY",
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

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      } else {
        setSubmitError(res.error || "Failed to onboard nursery teacher. Please check details.");
      }
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableNurseryClasses = Array.from(
    new Set([
      ...classrooms
        .filter((c) => /nursery|kindergarten|kg/i.test(c.name))
        .map((c) => c.name),
      ...DEFAULT_NURSERY_CLASSES,
    ])
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-50 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER (TIER-AWARE: NURSERY) */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  Onboard New Nursery Teacher — Nursery School
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 uppercase tracking-wider">
                  Nursery Tier
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {schoolName} • Early Years Educator KYC, Classroom Assignment, & Learning Area Allocation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-8 flex-1">
          {submitError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{submitError}</span>
            </div>
          )}

          {/* DYNAMIC ROLE PICKER FORM */}
          <StaffRolePickerForm
            tierCategory="NURSERY"
            selectedRole={formData.role}
            onSelectRole={(role) => {
              setFormData((prev) => ({ ...prev, role }));
              setIsAssistantFloating(role.toLowerCase().includes("assistant") || role.toLowerCase().includes("caregiver"));
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

          {/* =============================================================== */}
          {/* NURSERY ASSIGNMENT MODEL: CLASS & LEARNING AREAS                 */}
          {/* =============================================================== */}
          {!isNonTeaching ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Classroom & Learning Area Allocation</h3>
                  <p className="text-xs text-slate-500">
                    Assign Nursery class (single for Class Teacher, multi for Assistant), and designate learning areas
                  </p>
                </div>
              </div>

              {/* Class Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    {isAssistantFloating ? "Assigned Nursery Classes (Multi-Select)" : "Assigned Nursery Class (Single-Select)"} <span className="text-rose-500">*</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-600 select-none">
                    <input
                      type="checkbox"
                      checked={isAssistantFloating}
                      onChange={(e) => setIsAssistantFloating(e.target.checked)}
                      className="w-3.5 h-3.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                    />
                    <span>Assistant / Floating across multiple classes</span>
                  </label>
                </div>

                {isAssistantFloating ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {availableNurseryClasses.map((cls) => {
                      const isChecked = multiAssignedClasses.includes(cls);
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => toggleClassSelection(cls)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            isChecked
                              ? "bg-teal-600 text-white border border-teal-700 shadow-2xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                          <span>{cls}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    value={assignedClass}
                    onChange={(e) => {
                      setAssignedClass(e.target.value);
                      if (errors.assignedClass) {
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n.assignedClass;
                          return n;
                        });
                      }
                    }}
                    className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-white font-medium ${
                      errors.assignedClass ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    }`}
                  >
                    <option value="">-- Select Nursery Class --</option>
                    {availableNurseryClasses.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                )}
                {errors.assignedClass && (
                  <p className="text-[11px] text-rose-500 mt-1">{errors.assignedClass}</p>
                )}
              </div>

              {/* Learning Areas (Searchable Multi-select Chips) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Designated Early Childhood Learning Areas <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {selectedLearningAreas.length} Areas Selected
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {NURSERY_LEARNING_AREAS.map((area) => {
                    const isChecked = selectedLearningAreas.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleLearningArea(area)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                          isChecked
                            ? "bg-teal-600 text-white shadow-2xs border border-teal-700"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                        <span>{area}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.learningAreas && (
                  <p className="text-[11px] text-rose-500 mt-1.5">{errors.learningAreas}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-800">
              <span className="font-bold block mb-1">Non-Teaching Support Role</span>
              <span>
                Classroom and learning area assignment fields are hidden because <strong>{formData.role}</strong> is a non-teaching post.
              </span>
            </div>
          )}

          {/* =============================================================== */}
          {/* SECTION C: QUALIFICATION & COMPLIANCE (NURSERY TIER)            */}
          {/* =============================================================== */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs">
                C
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Academic Qualifications & TRCN Registration</h3>
                <p className="text-xs text-slate-500">NCE minimum standard, university degrees, and TRCN certification</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Highest Qualification */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Highest Academic Qualification <span className="text-rose-500">*</span>
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
                  className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-white ${
                    errors.qualification ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                  }`}
                >
                  <option value="">-- Select Highest Academic Qualification --</option>
                  {NURSERY_PRIMARY_SECONDARY_QUALIFICATIONS.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
                {errors.qualification && (
                  <p className="text-[11px] text-rose-500 mt-1">{errors.qualification}</p>
                )}
              </div>

              {/* Field of Study */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Field of Study / Major</label>
                <input
                  type="text"
                  value={fieldOfStudy}
                  onChange={(e) => setFieldOfStudy(e.target.value)}
                  placeholder="e.g. Primary & Nursery Education"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>

              {/* TRCN Number (Optional for Nursery) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  TRCN License No <span className="text-slate-400 font-normal">(Optional for Nursery)</span>
                </label>
                <input
                  type="text"
                  value={trcnNumber}
                  onChange={(e) => setTrcnNumber(e.target.value)}
                  placeholder="e.g. EN/T/12345 (Optional)"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Institution Attended</label>
                <input
                  type="text"
                  value={institutionAttended}
                  onChange={(e) => setInstitutionAttended(e.target.value)}
                  placeholder="e.g. Institute of Management and Technology (IMT), Enugu"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Year of Graduation</label>
                <input
                  type="text"
                  maxLength={4}
                  value={yearGraduated}
                  onChange={(e) => setYearGraduated(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 2019"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* SHARED ENTERPRISE SECTIONS: A, B, D, E, F */}
          <StaffOnboardingSharedSections
            tierCategory="NURSERY"
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            setErrors={setErrors}
            lineManagers={lineManagers}
          />
        </form>

        {/* STICKY BOTTOM ACTION FOOTER */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3 sticky bottom-0 z-20 shadow-lg">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Onboarding Teacher...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save & Onboard Nursery Teacher</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
