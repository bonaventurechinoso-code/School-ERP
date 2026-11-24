"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Briefcase,
  CreditCard,
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Upload,
  Lock,
  Eye,
  EyeOff,
  FileText,
  HeartHandshake,
} from "lucide-react";
import {
  StaffTierCategory,
  TIER_TERMINOLOGY,
  NIGERIAN_BANKS,
  getPayGradesForTier,
  getRolePermissionSummary,
} from "@/lib/staff-roles-config";

export interface SharedFormData {
  // Section A: Personal & Identity
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  phone: string;
  email: string;
  residentialAddress: string;
  state: string;
  lga: string;
  nin: string;
  passportUrl: string;

  // Section B: Employment
  staffId: string;
  dateOfEmployment: string;
  employmentType: string;
  departmentName: string;
  reportingToId: string;
  status: string;

  // Section D: Next of Kin & Emergency
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  nextOfKinAddress: string;
  emergencyName: string;
  emergencyPhone: string;
  sameAsNextOfKin: boolean;
  guarantorName: string;
  guarantorPhone: string;

  // Section E: Payroll & Statutory
  baseSalary: string; // blank by default
  payGrade: string;
  bankName: string;
  bankAccountNumber: string; // blank by default
  accountName: string;
  pensionRsa: string;
  pensionProvider: string;
  nhisNo: string;
  tin: string;
  paymentMethod: string;

  // Section F: Account & Access
  role: string;
}

export const INITIAL_SHARED_FORM_DATA: SharedFormData = {
  firstName: "",
  lastName: "",
  middleName: "",
  dateOfBirth: "",
  gender: "",
  maritalStatus: "",
  phone: "",
  email: "",
  residentialAddress: "",
  state: "",
  lga: "",
  nin: "",
  passportUrl: "",

  staffId: "",
  dateOfEmployment: "",
  employmentType: "",
  departmentName: "",
  reportingToId: "",
  status: "ACTIVE",

  nextOfKinName: "",
  nextOfKinRelationship: "",
  nextOfKinPhone: "",
  nextOfKinAddress: "",
  emergencyName: "",
  emergencyPhone: "",
  sameAsNextOfKin: false,
  guarantorName: "",
  guarantorPhone: "",

  baseSalary: "", // BLANK P0
  payGrade: "",
  bankName: "",
  bankAccountNumber: "", // BLANK P0
  accountName: "",
  pensionRsa: "",
  pensionProvider: "",
  nhisNo: "",
  tin: "",
  paymentMethod: "",

  role: "",
};

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger",
  "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "FCT Abuja"
];

interface Props {
  tierCategory: StaffTierCategory;
  formData: SharedFormData;
  setFormData: React.Dispatch<React.SetStateAction<SharedFormData>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  lineManagers?: Array<{ id: string; firstName: string; lastName: string; staffId?: string }>;
  isPolytechnic?: boolean;
}

export default function StaffOnboardingSharedSections({
  tierCategory,
  formData,
  setFormData,
  errors,
  setErrors,
  lineManagers = [],
  isPolytechnic = false,
}: Props) {
  const terminology = TIER_TERMINOLOGY[tierCategory];

  // Auto-calculate age
  const age = React.useMemo(() => {
    if (!formData.dateOfBirth) return null;
    const dob = new Date(formData.dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let calculatedAge = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) calculatedAge--;
    return calculatedAge;
  }, [formData.dateOfBirth]);

  // Handle emergency sync with next of kin
  useEffect(() => {
    if (formData.sameAsNextOfKin) {
      setFormData((prev) => ({
        ...prev,
        emergencyName: prev.nextOfKinName,
        emergencyPhone: prev.nextOfKinPhone,
      }));
    }
  }, [formData.sameAsNextOfKin, formData.nextOfKinName, formData.nextOfKinPhone, setFormData]);

  // Auto-fill account name from first + last name if blank
  useEffect(() => {
    if (!formData.accountName && (formData.firstName || formData.lastName)) {
      setFormData((prev) => ({
        ...prev,
        accountName: `${prev.firstName} ${prev.lastName}`.trim(),
      }));
    }
  }, [formData.firstName, formData.lastName, formData.accountName, setFormData]);

  const handleChange = (field: keyof SharedFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const payGrades = getPayGradesForTier(tierCategory, isPolytechnic);
  const permissionSummary = getRolePermissionSummary(formData.role, tierCategory);

  return (
    <div className="space-y-8">
      {/* =================================================================== */}
      {/* SECTION A: PERSONAL & IDENTITY                                     */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
            A
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Personal & Identity Information</h3>
            <p className="text-xs text-slate-500">Official government names, date of birth, and identity credentials</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* First Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              First Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              placeholder="e.g. Chioma"
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.firstName ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {errors.firstName && <p className="text-[11px] text-rose-500 mt-1">{errors.firstName}</p>}
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Last Name / Surname <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              placeholder="e.g. Okeke"
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.lastName ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {errors.lastName && <p className="text-[11px] text-rose-500 mt-1">{errors.lastName}</p>}
          </div>

          {/* Middle Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Middle Name <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={formData.middleName}
              onChange={(e) => handleChange("middleName", e.target.value)}
              placeholder="e.g. Blessing"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* DOB */}
          <div>
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
              onChange={(e) => handleChange("dateOfBirth", e.target.value)}
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.dateOfBirth ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {errors.dateOfBirth && <p className="text-[11px] text-rose-500 mt-1">{errors.dateOfBirth}</p>}
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Gender <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.gender}
              onChange={(e) => handleChange("gender", e.target.value)}
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.gender ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
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
              onChange={(e) => handleChange("maritalStatus", e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">-- Select Marital Status --</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Divorced">Divorced</option>
              <option value="Widowed">Widowed</option>
            </select>
          </div>

          {/* NIN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              NIN <span className="text-slate-400 font-normal">(11 Digits)</span>
            </label>
            <input
              type="text"
              maxLength={11}
              value={formData.nin}
              onChange={(e) => handleChange("nin", e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 12345678901"
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono ${
                errors.nin ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {errors.nin && <p className="text-[11px] text-rose-500 mt-1">{errors.nin}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Phone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="e.g. +234 803 123 4567 or 08031234567"
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.phone ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {errors.phone && <p className="text-[11px] text-rose-500 mt-1">{errors.phone}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Work / Official Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value.toLowerCase())}
              placeholder="e.g. staff.member@school.edu.ng"
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.email ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {errors.email && <p className="text-[11px] text-rose-500 mt-1">{errors.email}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Residential Address */}
          <div id="field-residentialAddress">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Residential Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.residentialAddress}
              onChange={(e) => handleChange("residentialAddress", e.target.value)}
              placeholder="e.g. 14 Mission Road, Egede, Enugu State"
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-500 ${
                errors.residentialAddress ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
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
              onChange={(e) => handleChange("state", e.target.value)}
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.state ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            >
              <option value="">-- Select State --</option>
              {NIGERIAN_STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            {errors.state && <p className="text-[11px] text-rose-500 mt-1">{errors.state}</p>}
          </div>

          {/* L.G.A of Origin */}
          <div id="field-lga">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              L.G.A of Origin <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.lga}
              onChange={(e) => handleChange("lga", e.target.value)}
              placeholder="e.g. Udi, Nsukka, Ikeja"
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-500 ${
                errors.lga ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {errors.lga && <p className="text-[11px] text-rose-500 mt-1">{errors.lga}</p>}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION B: EMPLOYMENT                                               */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
            B
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Employment & Institutional Role</h3>
            <p className="text-xs text-slate-500">Auto-generated Staff ID, resumption date, and supervisory hierarchy</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Staff ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">Staff ID</label>
              <span className="text-[10px] text-indigo-600 bg-indigo-50 font-bold px-1.5 py-0.2 rounded">
                Auto-Generated
              </span>
            </div>
            <input
              type="text"
              readOnly
              disabled
              value={formData.staffId || "Generated on Save (e.g. EGD/STF/001)"}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 text-slate-500 font-mono font-semibold cursor-not-allowed"
            />
          </div>

          {/* Date of Employment */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Date of Employment / Resumption <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.dateOfEmployment}
              onChange={(e) => handleChange("dateOfEmployment", e.target.value)}
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.dateOfEmployment ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {errors.dateOfEmployment && (
              <p className="text-[11px] text-rose-500 mt-1">{errors.dateOfEmployment}</p>
            )}
          </div>

          {/* Employment Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Employment Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.employmentType}
              onChange={(e) => handleChange("employmentType", e.target.value)}
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.employmentType ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            >
              <option value="">-- Select Employment Type --</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="NYSC">NYSC Intern</option>
              <option value="Intern">Student Intern</option>
              {tierCategory === "TERTIARY" && <option value="Visiting">Visiting / Adjunct</option>}
            </select>
            {errors.employmentType && (
              <p className="text-[11px] text-rose-500 mt-1">{errors.employmentType}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Department Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Department / Unit <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.departmentName}
              onChange={(e) => handleChange("departmentName", e.target.value)}
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.departmentName ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            >
              <option value="">-- Select Department / Unit --</option>
              {tierCategory === "CRECHE" && (
                <>
                  <option value="Early Childhood Care">Early Childhood Care</option>
                  <option value="Infant Nutrition & Health">Infant Nutrition & Health</option>
                  <option value="Administrative Support">Administrative Support</option>
                </>
              )}
              {tierCategory === "NURSERY" && (
                <>
                  <option value="Early Years Curriculum">Early Years Curriculum</option>
                  <option value="Literacy & Phonics">Literacy & Phonics</option>
                  <option value="Administration">Administration</option>
                </>
              )}
              {tierCategory === "PRIMARY" && (
                <>
                  <option value="Academic">Academic (Primary 1 - 6)</option>
                  <option value="Administration">Administration</option>
                  <option value="Bursary & Accounts">Bursary & Accounts</option>
                  <option value="Support Services">Support Services</option>
                </>
              )}
              {tierCategory === "SECONDARY" && (
                <>
                  <option value="Sciences">Sciences (Maths, Physics, Chem, Bio)</option>
                  <option value="Arts / Humanities">Arts / Humanities (Lit, CRS, Govt, Hist)</option>
                  <option value="Commercial">Commercial (Accts, Comm, Econ)</option>
                  <option value="Languages">Languages (English, Igbo, Yoruba, French)</option>
                  <option value="Administration">Administration & Bursary</option>
                </>
              )}
              {tierCategory === "TERTIARY" && (
                <>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Electrical & Electronics Engineering">Electrical & Electronics Engineering</option>
                  <option value="Business Administration">Business Administration</option>
                  <option value="Registry / Academic Affairs">Registry / Academic Affairs</option>
                  <option value="Bursary">Bursary</option>
                  <option value="Works & Physical Planning">Works & Physical Planning</option>
                </>
              )}
            </select>
            {errors.departmentName && (
              <p className="text-[11px] text-rose-500 mt-1">{errors.departmentName}</p>
            )}
          </div>

          {/* Reporting To */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reporting To / Line Manager <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <select
              value={formData.reportingToId}
              onChange={(e) => handleChange("reportingToId", e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
      {/* SECTION D: NEXT OF KIN & EMERGENCY                                  */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
            D
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Next of Kin & Emergency Contact</h3>
            <p className="text-xs text-slate-500">Emergency notifications and statutory next of kin documentation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* NOK Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Next of Kin Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.nextOfKinName}
              onChange={(e) => handleChange("nextOfKinName", e.target.value)}
              placeholder="e.g. Emeka Okeke"
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.nextOfKinName ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {errors.nextOfKinName && (
              <p className="text-[11px] text-rose-500 mt-1">{errors.nextOfKinName}</p>
            )}
          </div>

          {/* Relationship */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Relationship <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.nextOfKinRelationship}
              onChange={(e) => handleChange("nextOfKinRelationship", e.target.value)}
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.nextOfKinRelationship ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
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

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Next of Kin Phone <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.nextOfKinPhone}
              onChange={(e) => handleChange("nextOfKinPhone", e.target.value)}
              placeholder="e.g. +234 802 987 6543"
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.nextOfKinPhone ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {errors.nextOfKinPhone && (
              <p className="text-[11px] text-rose-500 mt-1">{errors.nextOfKinPhone}</p>
            )}
          </div>
        </div>

        {/* Emergency Checkbox */}
        <div className="pt-2">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={formData.sameAsNextOfKin}
              onChange={(e) => handleChange("sameAsNextOfKin", e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <span>Emergency contact is the same as Next of Kin</span>
          </label>
        </div>

        {!formData.sameAsNextOfKin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Name</label>
              <input
                type="text"
                value={formData.emergencyName}
                onChange={(e) => handleChange("emergencyName", e.target.value)}
                placeholder="e.g. Dr. Ngozi Eze"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Phone</label>
              <input
                type="tel"
                value={formData.emergencyPhone}
                onChange={(e) => handleChange("emergencyPhone", e.target.value)}
                placeholder="e.g. +234 803 555 1212"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>
        )}

        {/* Guarantor (Primary/Secondary/Tertiary) */}
        {tierCategory !== "CRECHE" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Guarantor Full Name <span className="text-slate-400 font-normal">(Institutional surety)</span>
              </label>
              <input
                type="text"
                value={formData.guarantorName}
                onChange={(e) => handleChange("guarantorName", e.target.value)}
                placeholder="e.g. Barrister Chukwuemeka O."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Guarantor Phone Number</label>
              <input
                type="tel"
                value={formData.guarantorPhone}
                onChange={(e) => handleChange("guarantorPhone", e.target.value)}
                placeholder="e.g. +234 803 765 4321"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* SECTION E: PAYROLL & STATUTORY                                      */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
            E
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Payroll & Statutory Banking</h3>
            <p className="text-xs text-slate-500">10-digit NUBAN validation, monthly remuneration, and pension compliance</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Base Salary (BLANK - P0 FIX) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Base Monthly Salary (NGN) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₦</span>
              <input
                type="number"
                min={0}
                value={formData.baseSalary}
                onChange={(e) => handleChange("baseSalary", e.target.value)}
                placeholder="Enter salary (e.g. 150000)"
                className={`w-full pl-8 pr-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono font-semibold ${
                  errors.baseSalary ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                }`}
              />
            </div>
            {errors.baseSalary && <p className="text-[11px] text-rose-500 mt-1">{errors.baseSalary}</p>}
          </div>

          {/* Pay Grade */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pay Grade / Scale <span className="text-slate-400 font-normal">({tierCategory})</span>
            </label>
            <select
              value={formData.payGrade}
              onChange={(e) => handleChange("payGrade", e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
            >
              <option value="">-- Select Pay Grade --</option>
              {payGrades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => handleChange("paymentMethod", e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">-- Select Payment Method --</option>
              <option value="Bank Transfer">Bank Transfer (NUBAN)</option>
              <option value="Cash / Cheque">Cash / Manual Cheque</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Bank Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Bank Name <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.bankName}
              onChange={(e) => handleChange("bankName", e.target.value)}
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${
                errors.bankName ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            >
              <option value="">-- Choose Commercial Bank --</option>
              {NIGERIAN_BANKS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {errors.bankName && <p className="text-[11px] text-rose-500 mt-1">{errors.bankName}</p>}
          </div>

          {/* Account Number (BLANK - P0 FIX) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Account No <span className="text-rose-500">*</span> <span className="text-[10px] text-slate-400 font-normal">(10-Digit NUBAN)</span>
            </label>
            <input
              type="text"
              maxLength={10}
              value={formData.bankAccountNumber}
              onChange={(e) => handleChange("bankAccountNumber", e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 0123456789"
              className={`w-full px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono font-semibold ${
                errors.bankAccountNumber ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
              }`}
            />
            {errors.bankAccountNumber && (
              <p className="text-[11px] text-rose-500 mt-1">{errors.bankAccountNumber}</p>
            )}
          </div>

          {/* Account Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Account Holder Name</label>
            <input
              type="text"
              value={formData.accountName}
              onChange={(e) => handleChange("accountName", e.target.value)}
              placeholder="e.g. Chioma Okeke"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
        </div>

        {/* Statutory Pension & Tax */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pension RSA PIN</label>
            <input
              type="text"
              value={formData.pensionRsa}
              onChange={(e) => handleChange("pensionRsa", e.target.value)}
              placeholder="e.g. PEN10023456789"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">PFA / Pension Provider</label>
            <input
              type="text"
              value={formData.pensionProvider}
              onChange={(e) => handleChange("pensionProvider", e.target.value)}
              placeholder="e.g. Stanbic IBTC Pension"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tax Identification Number (TIN)</label>
            <input
              type="text"
              value={formData.tin}
              onChange={(e) => handleChange("tin", e.target.value)}
              placeholder="e.g. 23456789-0001"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION F: ACCOUNT & ACCESS                                         */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
            F
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Account Credentials & System Permissions</h3>
            <p className="text-xs text-slate-500">Security enforcement, role boundary summary, and mandatory first-login password reset</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Portal Username <span className="text-slate-400 font-normal">(Auto = Email)</span>
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={formData.email || "Enter email in Section A"}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-600 font-mono cursor-not-allowed"
            />
          </div>

          {/* Account Status & Force Reset */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Account Security Protocol</label>
            <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-700 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Force Password Reset on First Login: <strong>ON (Mandatory)</strong></span>
            </div>
          </div>
        </div>

        {/* Role Permission Summary Box */}
        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-xs">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-indigo-900 block mb-0.5">
                Active Permissions Boundary — {formData.role || "Selected Role"}:
              </span>
              <p className="text-indigo-800 leading-relaxed font-medium">
                {permissionSummary}
              </p>
            </div>
          </div>
        </div>

        {/* Security Notification (NO DEFAULT PASSWORD DISPLAY) */}
        <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
          <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p>
            An initial temporary credential will be cryptographically generated server-side and dispatched directly to the staff member&apos;s official email / SMS. Default passwords are never exposed in administrative views.
          </p>
        </div>
      </div>
    </div>
  );
}
