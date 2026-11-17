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
  Building,
  Briefcase,
  Compass,
} from "lucide-react";
import StaffOnboardingSharedSections, {
  SharedFormData,
  INITIAL_SHARED_FORM_DATA,
} from "./StaffOnboardingSharedSections";
import StaffRolePickerForm from "./StaffRolePickerForm";
import {
  TERTIARY_ALL_STAFF_ROLES,
  TERTIARY_QUALIFICATIONS,
  TERTIARY_PROFESSIONAL_BODIES,
  isNonTeachingRole,
} from "@/lib/staff-roles-config";
import { createEnterpriseStaffAction, fetchSchoolSubjectsAction } from "../actions";

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

export interface TertiaryCourseItem {
  id: string;
  courseCode: string;
  courseTitle: string;
  creditUnits: number;
  level: string;
  semester: string;
}

export const SAMPLE_TERTIARY_COURSES: TertiaryCourseItem[] = [
  { id: "c1", courseCode: "CSC 101", courseTitle: "Introduction to Computer Science", creditUnits: 3, level: "100 Level", semester: "1st Semester" },
  { id: "c2", courseCode: "MTH 101", courseTitle: "Elementary Mathematics I (Calculus)", creditUnits: 3, level: "100 Level", semester: "1st Semester" },
  { id: "c3", courseCode: "PHY 101", courseTitle: "General Physics I (Mechanics)", creditUnits: 3, level: "100 Level", semester: "1st Semester" },
  { id: "c4", courseCode: "GST 111", courseTitle: "Use of English & Communication Skills", creditUnits: 2, level: "100 Level", semester: "1st Semester" },
  { id: "c5", courseCode: "CSC 201", courseTitle: "Data Structures & Algorithms", creditUnits: 3, level: "200 Level", semester: "1st Semester" },
  { id: "c6", courseCode: "COM 111", courseTitle: "Introduction to Computing (ND 1)", creditUnits: 3, level: "ND 1", semester: "1st Semester" },
  { id: "c7", courseCode: "COM 112", courseTitle: "Logic & Digital Design", creditUnits: 2, level: "ND 1", semester: "1st Semester" },
  { id: "c8", courseCode: "COM 211", courseTitle: "Operating Systems (ND 2)", creditUnits: 3, level: "ND 2", semester: "1st Semester" },
];

export default function TertiaryStaffOnboardingModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
  schoolDomain,
  schoolName,
  classrooms = [],
  lineManagers = [],
}: Props) {
  const isPolytechnic =
    schoolName.toLowerCase().includes("poly") ||
    schoolName.toLowerCase().includes("college of technology") ||
    schoolDomain.toLowerCase().includes("poly") ||
    schoolDomain.toLowerCase().includes("apex");

  const [formData, setFormData] = useState<SharedFormData>({
    ...INITIAL_SHARED_FORM_DATA,
    role: "",
    payGrade: "",
  });

  // Section C: Tertiary Specific Qualifications, Academic Rank & Professional Body
  const [qualification, setQualification] = useState<string>("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [institutionAttended, setInstitutionAttended] = useState("");
  const [yearGraduated, setYearGraduated] = useState("");

  // Professional Body (COREN, ICAN, etc.)
  const [professionalBody, setProfessionalBody] = useState<string>("");
  const [professionalMembershipNo, setProfessionalMembershipNo] = useState("");
  const [professionalExpiry, setProfessionalExpiry] = useState("");

  // TRCN is documented if available, optional
  const [trcnNumber, setTrcnNumber] = useState("");
  const [trcnExpiry, setTrcnExpiry] = useState("");

  // Section D: Tertiary Academic Assignment
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [programme, setProgramme] = useState("");
  const [academicSemester, setAcademicSemester] = useState<"1st Semester" | "2nd Semester">("1st Semester");
  const [courseAdviserLevel, setCourseAdviserLevel] = useState("");
  const [isCourseAdviser, setIsCourseAdviser] = useState(false);

  // Courses allocation
  const [availableCourses, setAvailableCourses] = useState<TertiaryCourseItem[]>(SAMPLE_TERTIARY_COURSES);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseUnits, setNewCourseUnits] = useState("");
  const [newCourseLevel, setNewCourseLevel] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Dynamically load courses from school database if available
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadCourses() {
      try {
        const res = await fetchSchoolSubjectsAction(schoolDomain);
        if (isMounted && res.success && res.data && res.data.length > 0) {
          const mapped: TertiaryCourseItem[] = res.data.map((c: any) => ({
            id: c.id,
            courseCode: c.code || c.name.slice(0, 7).toUpperCase(),
            courseTitle: c.name,
            creditUnits: c.creditUnits || 3,
            level: "100 Level",
            semester: "1st Semester",
          }));
          setAvailableCourses(mapped);
        }
      } catch (err) {
        console.error("Failed to load tertiary courses:", err);
      }
    }

    loadCourses();
    return () => {
      isMounted = false;
    };
  }, [isOpen, schoolDomain]);

  if (!isOpen) return null;

  const isNonTeaching = isNonTeachingRole(formData.role);
  const isHod = formData.role.includes("Head of Department") || formData.role === "HOD";
  const isDean = formData.role.includes("Dean");

  // Sum of credit units calculation
  const totalCreditUnits = selectedCourseIds.reduce((sum, cid) => {
    const course = availableCourses.find((c) => c.id === cid);
    return sum + (course ? course.creditUnits : 0);
  }, 0);

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
    if (errors.courses) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n.courses;
        return n;
      });
    }
  };

  const handleAddCourse = () => {
    if (!newCourseCode.trim() || !newCourseTitle.trim()) return;
    const units = Math.max(1, Math.min(6, Number(newCourseUnits) || 3));
    const newCourse: TertiaryCourseItem = {
      id: `custom-${Date.now()}`,
      courseCode: newCourseCode.trim().toUpperCase(),
      courseTitle: newCourseTitle.trim(),
      creditUnits: units,
      level: newCourseLevel,
      semester: academicSemester,
    };
    setAvailableCourses((prev) => [newCourse, ...prev]);
    setSelectedCourseIds((prev) => [...prev, newCourse.id]);
    setNewCourseCode("");
    setNewCourseTitle("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const localErrors: Record<string, string> = {};
    if (!formData.role || !formData.role.trim()) {
      localErrors.role = "Please select an academic or administrative role from the role options above.";
    }
    if (!formData.firstName.trim()) localErrors.firstName = "First Name is required.";
    if (!formData.lastName.trim()) localErrors.lastName = "Last Name is required.";
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      localErrors.email = "Valid official university/polytechnic email address is required.";
    }
    if (!formData.phone.trim()) localErrors.phone = "Phone number is required.";
    if (!formData.residentialAddress.trim()) localErrors.residentialAddress = "Residential Address is required.";
    if (!formData.dateOfBirth) localErrors.dateOfBirth = "Date of Birth is required.";
    if (!formData.state) localErrors.state = "State of Origin / Residence is required.";
    if (!formData.employmentType) localErrors.employmentType = "Employment Type is required.";
    if (!formData.departmentName) localErrors.departmentName = "Department / Unit is required.";
    if (!qualification.trim()) localErrors.qualification = "Please select highest academic qualification.";
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

    // Tertiary Specialization requirement for lecturers
    if (!isNonTeaching) {
      if (!specialization.trim()) {
        localErrors.specialization = "Area of Specialization is required for academic staff.";
      }
      if (!faculty.trim()) {
        localErrors.faculty = "Faculty / School is required.";
      }
      if (!department.trim()) {
        localErrors.department = "Department is required.";
      }
      if (!programme.trim()) {
        localErrors.programme = "Programme is required.";
      }
    }

    // Tertiary Course Assignment validation
    if (!isNonTeaching) {
      if (selectedCourseIds.length === 0) {
        localErrors.courses = "Select at least 1 academic course allocated to this lecturer.";
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
        const assignedCourses = availableCourses.filter((c) => selectedCourseIds.includes(c.id));
        assignmentsPayload = [
          {
            assignmentType: "TertiaryLecturer",
            metadata: {
              faculty,
              department,
              programme,
              academicSemester,
              academicRank: formData.role,
              specialization,
              totalCreditUnits,
              courses: assignedCourses.map((c) => ({
                code: c.courseCode,
                title: c.courseTitle,
                creditUnits: c.creditUnits,
                level: c.level,
                semester: c.semester,
              })),
              isCourseAdviser,
              courseAdviserLevel: isCourseAdviser ? courseAdviserLevel : undefined,
            },
          },
        ];

        if (isHod) {
          assignmentsPayload.push({
            assignmentType: "TertiaryHOD",
            metadata: {
              department,
              faculty,
              responsibilities: "Head of Department, Semester Results Approval, Course Allocation Oversight",
            },
          });
        }

        if (isDean) {
          assignmentsPayload.push({
            assignmentType: "TertiaryDean",
            metadata: {
              faculty,
              responsibilities: "Dean of Faculty / School Executive Leadership",
            },
          });
        }
      }

      const res = await createEnterpriseStaffAction(schoolDomain, {
        tierCategory: "TERTIARY",
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
        departmentName: department,
        reportingToId: formData.reportingToId || null,
        status: formData.status,

        highestQualification: qualification,
        fieldOfStudy,
        specialization,
        academicRank: formData.role,
        institutionAttended,
        yearGraduated,

        professionalBody: professionalBody.trim() || undefined,
        professionalMembershipNo: professionalMembershipNo.trim() || undefined,
        professionalExpiry: professionalExpiry || undefined,

        trcnNumber: trcnNumber.trim() || undefined,
        trcnExpiry: trcnExpiry || undefined,
        trcnStatus: trcnNumber.trim() ? "DOCUMENTED" : undefined,

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
        setSubmitError(res.error || "Failed to onboard tertiary staff member.");
        setIsSubmitting(false);
        return;
      }

      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      console.error("[TertiaryStaffOnboardingModal] Submit error:", err);
      setSubmitError(err.message || "An unexpected error occurred during submission.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-800 via-indigo-900 to-purple-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <GraduationCap className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">Tertiary Staff & Academic Onboarding</h3>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 text-[10px] font-black uppercase tracking-wider border border-purple-400/30">
                  Tertiary / Higher Ed Tier
                </span>
              </div>
              <p className="text-xs text-purple-200/90 font-medium mt-0.5">
                {schoolName} • Faculty, Department, Semester & Course Allocation
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
            tierCategory="TERTIARY"
            isPolytechnic={isPolytechnic}
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
            tierCategory="TERTIARY"
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            setErrors={setErrors}
            lineManagers={lineManagers}
            isPolytechnic={isPolytechnic}
          />

          {/* SECTION C: QUALIFICATIONS, SPECIALIZATION & PROFESSIONAL COMPLIANCE */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-700" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Section C: Academic Credentials & Professional Certification
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                Tertiary Accreditation Standards
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Highest Academic Qualification <span className="text-red-500">*</span>
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
                  className={`w-full text-xs font-medium border rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-purple-500 ${
                    errors.qualification ? "border-red-400 bg-red-50/30" : "border-slate-300"
                  }`}
                >
                  <option value="">-- Select Highest Academic Qualification --</option>
                  {TERTIARY_QUALIFICATIONS.map((q) => (
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
                  Area of Specialization / Research Focus {!isNonTeaching && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => {
                    setSpecialization(e.target.value);
                    if (errors.specialization) {
                      setErrors((prev) => {
                        const n = { ...prev };
                        delete n.specialization;
                        return n;
                      });
                    }
                  }}
                  placeholder="e.g. Machine Learning, Structural Engineering, Financial Accounting"
                  className={`w-full text-xs font-medium border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 ${
                    errors.specialization ? "border-red-400 bg-red-50/30" : "border-slate-300"
                  }`}
                />
                {errors.specialization && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{errors.specialization}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Field of Study / Discipline</label>
                <input
                  type="text"
                  value={fieldOfStudy}
                  onChange={(e) => setFieldOfStudy(e.target.value)}
                  placeholder="e.g. Computer Science, Mechanical Engineering, Economics"
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Institution Attended</label>
                <input
                  type="text"
                  value={institutionAttended}
                  onChange={(e) => setInstitutionAttended(e.target.value)}
                  placeholder="e.g. University of Lagos, Covenant University"
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* PROFESSIONAL REGULATORY BODY (COREN, ICAN, NMCN, NBA, ETC.) */}
            <div className="pt-3 border-t border-slate-200 mt-3 space-y-3">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-purple-700" />
                <span>Professional Body & Regulatory Compliance</span>
                <span className="text-slate-400 font-normal">(COREN, ICAN, NMCN, NBA, CPN, etc.)</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Regulatory Body
                  </label>
                  <select
                    value={professionalBody}
                    onChange={(e) => setProfessionalBody(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- None / Not Applicable --</option>
                    {TERTIARY_PROFESSIONAL_BODIES.map((pb) => (
                      <option key={pb} value={pb}>
                        {pb}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Membership / License No
                  </label>
                  <input
                    type="text"
                    value={professionalMembershipNo}
                    onChange={(e) => setProfessionalMembershipNo(e.target.value)}
                    placeholder="e.g. R.12480 / CPN-2022-891"
                    className="w-full text-xs font-mono uppercase border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    License Expiry / Renewal Date
                  </label>
                  <input
                    type="date"
                    value={professionalExpiry}
                    onChange={(e) => setProfessionalExpiry(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* TRCN REGISTRATION (OPTIONAL FOR TERTIARY, DOCUMENTED IF AVAILABLE) */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-purple-900">TRCN (if available)</span>
                    <span className="text-[10px] text-purple-700 bg-purple-200/60 px-1.5 py-0.5 rounded font-semibold">
                      Optional for Tertiary
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-800/80 mt-0.5">
                    Tertiary lecturers are documented with TRCN if licensed, but not blocked from onboarding.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={trcnNumber}
                    onChange={(e) => setTrcnNumber(e.target.value)}
                    placeholder="TRCN License No"
                    className="text-xs font-mono uppercase border border-purple-200 rounded-xl px-3 py-1.5 bg-white w-48"
                  />
                  <input
                    type="date"
                    value={trcnExpiry}
                    onChange={(e) => setTrcnExpiry(e.target.value)}
                    className="text-xs border border-purple-200 rounded-xl px-2 py-1.5 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION D: TERTIARY ACADEMIC ALLOCATION (HIDDEN FOR NON-TEACHING) */}
          {!isNonTeaching ? (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-700" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Section D: Academic Department, Semester & Course Load ({formData.role})
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-purple-700 text-white shadow-2xs">
                    Total Load: {totalCreditUnits} CU
                  </span>
                </div>
              </div>

              {/* FACULTY, DEPARTMENT, PROGRAMME, SEMESTER */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Faculty / School <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={faculty}
                    onChange={(e) => {
                      setFaculty(e.target.value);
                      if (errors.faculty) {
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n.faculty;
                          return n;
                        });
                      }
                    }}
                    placeholder="e.g. School of Technology"
                    className={`w-full text-xs font-medium border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 ${
                      errors.faculty ? "border-red-400 bg-red-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.faculty && (
                    <p className="text-[11px] text-red-600 font-medium mt-1">{errors.faculty}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      if (errors.department) {
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n.department;
                          return n;
                        });
                      }
                    }}
                    placeholder="e.g. Computer Science"
                    className={`w-full text-xs font-medium border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 ${
                      errors.department ? "border-red-400 bg-red-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.department && (
                    <p className="text-[11px] text-red-600 font-medium mt-1">{errors.department}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Programme / Level <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={programme}
                    onChange={(e) => {
                      setProgramme(e.target.value);
                      if (errors.programme) {
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n.programme;
                          return n;
                        });
                      }
                    }}
                    placeholder="e.g. ND Computer Science"
                    className={`w-full text-xs font-medium border rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 ${
                      errors.programme ? "border-red-400 bg-red-50/30" : "border-slate-300"
                    }`}
                  />
                  {errors.programme && (
                    <p className="text-[11px] text-red-600 font-medium mt-1">{errors.programme}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Semester <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={academicSemester}
                    onChange={(e) => setAcademicSemester(e.target.value as any)}
                    className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 text-purple-900"
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                  </select>
                </div>
              </div>

              {/* HOD BANNER */}
              {isHod && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2.5">
                  <Building className="w-4 h-4 text-purple-700 shrink-0" />
                  <p className="text-xs text-purple-900 font-semibold">
                    Departmental Leadership: Assigned as Head of Department (HOD) for {department}.
                    Oversees course distribution, semester examination vetting, and lecturer marks submission.
                  </p>
                </div>
              )}

              {/* COURSE ADVISER OPTION */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chkCourseAdviser"
                    checked={isCourseAdviser}
                    onChange={(e) => setIsCourseAdviser(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="chkCourseAdviser" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Appoint as Level Course Adviser
                  </label>
                </div>
                {isCourseAdviser && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-medium">Advising Level:</span>
                    <select
                      value={courseAdviserLevel}
                      onChange={(e) => setCourseAdviserLevel(e.target.value)}
                      className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1 bg-white focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="ND 1">ND 1</option>
                      <option value="ND 2">ND 2</option>
                      <option value="HND 1">HND 1</option>
                      <option value="HND 2">HND 2</option>
                      <option value="100 Level">100 Level</option>
                      <option value="200 Level">200 Level</option>
                      <option value="300 Level">300 Level</option>
                      <option value="400 Level">400 Level</option>
                      <option value="Diploma 1">Diploma 1</option>
                    </select>
                  </div>
                )}
              </div>

              {/* COURSES ALLOCATION LIST */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    Courses Allocated for {academicSemester} <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {selectedCourseIds.length} course(s) selected • Recommended semester load: 9 - 18 CU
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                  {availableCourses.map((c) => {
                    const isSelected = selectedCourseIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCourse(c.id)}
                        className={`p-2.5 rounded-xl text-left border transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-purple-50/80 border-purple-400 text-purple-950 shadow-2xs"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs text-purple-700">
                              {c.courseCode}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {c.creditUnits} CU
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              ({c.level})
                            </span>
                          </div>
                          <p className="text-[11px] font-medium text-slate-700 truncate mt-0.5">
                            {c.courseTitle}
                          </p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-purple-700 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {errors.courses && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{errors.courses}</p>
                )}

                {/* ADD NEW COURSE ROW */}
                <div className="mt-2 p-2.5 bg-slate-100/70 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    placeholder="Code (CSC 301)"
                    className="text-xs font-mono uppercase border border-slate-300 rounded-lg px-2.5 py-1.5 w-28 bg-white"
                  />
                  <input
                    type="text"
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    placeholder="Course Title (Database Management Systems)"
                    className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 flex-1 min-w-[180px] bg-white"
                  />
                  <select
                    value={newCourseUnits}
                    onChange={(e) => setNewCourseUnits(e.target.value)}
                    className="text-xs font-bold border border-slate-300 rounded-lg px-2 py-1.5 w-20 bg-white"
                  >
                    <option value="1">1 CU</option>
                    <option value="2">2 CU</option>
                    <option value="3">3 CU</option>
                    <option value="4">4 CU</option>
                    <option value="6">6 CU</option>
                  </select>
                  <select
                    value={newCourseLevel}
                    onChange={(e) => setNewCourseLevel(e.target.value)}
                    className="text-xs font-bold border border-slate-300 rounded-lg px-2 py-1.5 w-24 bg-white"
                  >
                    <option value="ND 1">ND 1</option>
                    <option value="ND 2">ND 2</option>
                    <option value="HND 1">HND 1</option>
                    <option value="HND 2">HND 2</option>
                    <option value="100 Level">100 Level</option>
                    <option value="200 Level">200 Level</option>
                    <option value="300 Level">300 Level</option>
                    <option value="400 Level">400 Level</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddCourse}
                    className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    + Add Course
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-center gap-3">
              <UserCheck className="w-4 h-4 text-slate-500 shrink-0" />
              <p className="text-xs text-slate-600 font-medium">
                Academic course assignment is hidden for non-teaching administrative/support role:{" "}
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
              className="px-6 py-2.5 rounded-xl bg-purple-800 hover:bg-purple-900 text-white text-xs font-bold transition shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Onboarding Lecturer...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Onboard Tertiary Staff</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
