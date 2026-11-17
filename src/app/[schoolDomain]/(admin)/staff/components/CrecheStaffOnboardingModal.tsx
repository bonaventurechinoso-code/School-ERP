"use client";

import React, { useState } from "react";
import {
  X,
  Baby,
  Sparkles,
  Check,
  AlertCircle,
  FileCheck,
  Heart,
  Activity,
  Layers,
  ChevronDown,
} from "lucide-react";
import StaffOnboardingSharedSections, {
  SharedFormData,
  INITIAL_SHARED_FORM_DATA,
} from "./StaffOnboardingSharedSections";
import StaffRolePickerForm from "./StaffRolePickerForm";
import {
  CRECHE_STAFF_ROLES,
  CRECHE_QUALIFICATIONS,
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

export const CRECHE_ACTIVITIES = [
  "Rhymes & Songs",
  "Sensory & Texture Play",
  "Story Time & Picture Books",
  "Outdoor Motor Play",
  "Nap & Resting Care",
  "Feeding & Nutrition Routine",
  "Language & Babbling Stimulation",
  "Fine Motor & Grasping Activities",
] as const;

export const DEFAULT_CRECHE_PLAYGROUPS = [
  "Playgroup A (Infants 3-12 mos)",
  "Playgroup B (Toddlers 1-2 yrs)",
  "Playgroup C (Pre-Nursery 2-3 yrs)",
  "Creche Main Room",
] as const;

export default function CrecheStaffOnboardingModal({
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

  // Section C: Creche Specific Qualification & Certification
  const [qualification, setQualification] = useState<string>("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [institutionAttended, setInstitutionAttended] = useState("");
  const [yearGraduated, setYearGraduated] = useState("");
  const [childcareCertName, setChildcareCertName] = useState("");
  const [trcnNumber, setTrcnNumber] = useState(""); // Optional for Creche

  // Creche Assignment Model
  const [assignedPlaygroup, setAssignedPlaygroup] = useState<string>("");
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isNonTeaching = isNonTeachingRole(formData.role);

  const toggleActivity = (activity: string) => {
    setSelectedActivities((prev) =>
      prev.includes(activity) ? prev.filter((a) => a !== activity) : [...prev, activity]
    );
    if (errors.activities) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.activities;
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate Creche Specific fields
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

    // Assignment validation: If caregiver/teaching, playgroup & activities required
    if (!isNonTeaching) {
      if (!assignedPlaygroup.trim()) {
        localErrors.assignedPlaygroup = "Please select an assigned Playgroup / Toddler Class.";
      }
      if (selectedActivities.length === 0) {
        localErrors.activities = "Select at least 1 early childhood developmental activity.";
      }
    }

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      // Scroll to first error
      const firstKey = Object.keys(localErrors)[0];
      const el = document.querySelector(`[name="${firstKey}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Find matching classroom id if exists
      const matchedClassroom = classrooms.find((c) => c.name.toLowerCase() === assignedPlaygroup.toLowerCase());

      const assignmentsPayload = isNonTeaching
        ? []
        : [
            {
              assignmentType: "PlaygroupCaregiver",
              classroomId: matchedClassroom?.id || undefined,
              metadata: {
                playgroupName: assignedPlaygroup,
                developmentalActivities: selectedActivities,
                recommendedRatio: "1:5",
                targetAgeGroup: "0 - 3 Years",
              },
            },
          ];

      const res = await createEnterpriseStaffAction(schoolDomain, {
        tierCategory: "CRECHE",
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
        certificates: JSON.stringify({ childcareCert: childcareCertName }),

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
        setSubmitError(res.error || "Failed to onboard caregiver. Please check details.");
      }
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Combine DB classrooms with standard Creche playgroup presets
  const availablePlaygroups = Array.from(
    new Set([
      ...classrooms
        .filter((c) => /creche|playgroup|toddler|infant/i.test(c.name))
        .map((c) => c.name),
      ...DEFAULT_CRECHE_PLAYGROUPS,
    ])
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-50 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER (TIER-AWARE: CRECHE) */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Baby className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  Onboard New Caregiver — Creche / Daycare Centre
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                  Creche Tier
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {schoolName} • Early Childhood Caregiver KYC, Playgroup Allocation, & Routine Register
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

        {/* MODAL BODY (SCROLLABLE) */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-8 flex-1">
          {submitError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{submitError}</span>
            </div>
          )}

          {/* DYNAMIC ROLE PICKER FORM */}
          <StaffRolePickerForm
            tierCategory="CRECHE"
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

          {/* =============================================================== */}
          {/* CRECHE ASSIGNMENT MODEL: PLAYGROUP & DEVELOPMENTAL ACTIVITIES  */}
          {/* =============================================================== */}
          {!isNonTeaching ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Playgroup & Developmental Activity Allocation</h3>
                  <p className="text-xs text-slate-500">
                    Assign primary toddler room, daily nursery routines, and check staff-to-child ratio
                  </p>
                </div>
              </div>

              {/* Playgroup Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Assigned Playgroup / Toddler Class <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Recommended Ratio: 1 Caregiver to 5 Toddlers (1:5)
                  </span>
                </div>
                <select
                  value={assignedPlaygroup}
                  onChange={(e) => {
                    setAssignedPlaygroup(e.target.value);
                    if (errors.assignedPlaygroup) {
                      setErrors((prev) => {
                        const n = { ...prev };
                        delete n.assignedPlaygroup;
                        return n;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium ${
                    errors.assignedPlaygroup ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                  }`}
                >
                  <option value="">-- Select Playgroup / Toddler Class --</option>
                  {availablePlaygroups.map((pg) => (
                    <option key={pg} value={pg}>{pg}</option>
                  ))}
                </select>
                {errors.assignedPlaygroup && (
                  <p className="text-[11px] text-rose-500 mt-1">{errors.assignedPlaygroup}</p>
                )}
              </div>

              {/* Developmental Activities (Searchable Multi-select Chips) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Early Childhood Care Routines & Activities <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {selectedActivities.length} Selected
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {CRECHE_ACTIVITIES.map((act) => {
                    const isChecked = selectedActivities.includes(act);
                    return (
                      <button
                        key={act}
                        type="button"
                        onClick={() => toggleActivity(act)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                          isChecked
                            ? "bg-amber-500 text-white shadow-2xs border border-amber-600"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                        <span>{act}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.activities && (
                  <p className="text-[11px] text-rose-500 mt-1.5">{errors.activities}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-800">
              <span className="font-bold block mb-1">Non-Teaching Support Role</span>
              <span>
                Childcare playgroup and activity allocation fields are hidden because <strong>{formData.role}</strong> is a non-caregiving administrative / support post.
              </span>
            </div>
          )}

          {/* =============================================================== */}
          {/* SECTION C: QUALIFICATION & COMPLIANCE (CRECHE TIER)             */}
          {/* =============================================================== */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                C
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Early Childhood Qualifications & First Aid Certifications</h3>
                <p className="text-xs text-slate-500">Childcare certificates, CPR/First Aid verification, and optional TRCN credentials</p>
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
                  className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                    errors.qualification ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                  }`}
                >
                  <option value="">-- Select Highest Academic Qualification --</option>
                  {CRECHE_QUALIFICATIONS.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
                {errors.qualification && (
                  <p className="text-[11px] text-rose-500 mt-1">{errors.qualification}</p>
                )}
              </div>

              {/* Childcare Certification */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Childcare / First Aid Certification <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={childcareCertName}
                  onChange={(e) => setChildcareCertName(e.target.value)}
                  placeholder="e.g. Red Cross Pediatric First Aid"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              {/* TRCN (Optional for Creche) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  TRCN License No <span className="text-slate-400 font-normal">(Optional for Creche)</span>
                </label>
                <input
                  type="text"
                  value={trcnNumber}
                  onChange={(e) => setTrcnNumber(e.target.value)}
                  placeholder="e.g. EN/T/12345 (Optional)"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
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
                  placeholder="e.g. Federal College of Education, Eha-Amufu"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Year of Graduation</label>
                <input
                  type="text"
                  maxLength={4}
                  value={yearGraduated}
                  onChange={(e) => setYearGraduated(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 2021"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* SHARED ENTERPRISE SECTIONS: A, B, D, E, F */}
          <StaffOnboardingSharedSections
            tierCategory="CRECHE"
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
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Onboarding Caregiver...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save & Onboard Caregiver</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
