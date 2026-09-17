"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  X,
  Phone,
  Mail,
  MessageCircle,
  Building2,
  GraduationCap,
  Award,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Edit3,
  Save,
  UserCheck,
  ShieldCheck,
  FileText,
  DollarSign,
  ChevronRight,
  Send,
} from "lucide-react";
import {
  fetchStaffFullProfile,
  updateStaffProfile,
  markStaffQuickAttendanceAction,
  generateStaffPayrollVoucherAction,
} from "./actions";

export interface StaffProfileDrawerProps {
  staff: any | null;
  isOpen: boolean;
  onClose: () => void;
  departments: { id: string; name: string }[];
  schoolId: string;
  schoolDomain: string;
  schoolName: string;
  onStaffUpdated?: () => void;
  onPrintIdCard?: (staff: any) => void;
  onPrintAppointmentLetter?: (staff: any) => void;
}

const NIGERIAN_BANKS = [
  "Zenith Bank",
  "Guaranty Trust Bank (GTBank)",
  "First Bank of Nigeria",
  "Access Bank",
  "United Bank for Africa (UBA)",
  "Fidelity Bank",
  "Stanbic IBTC Bank",
  "Union Bank",
  "Sterling Bank",
  "Ecobank Nigeria",
  "Wema Bank",
  "Kuda Bank",
  "Monnify / OPay",
];

const QUALIFICATIONS = [
  "N.C.E (Nigeria Certificate in Education)",
  "B.Ed (Bachelor of Education)",
  "B.Sc (Ed) / B.A (Ed)",
  "B.Sc / B.A / B.Tech + PGDE",
  "B.Sc / B.A (Non-Education)",
  "H.N.D (Higher National Diploma)",
  "M.Ed (Master of Education)",
  "M.Sc / M.A",
  "Ph.D (Doctor of Philosophy)",
];

const TRCN_CATEGORIES = [
  { value: "Category A", label: "Category A - Ph.D in Education" },
  { value: "Category B", label: "Category B - Masters in Education" },
  { value: "Category C", label: "Category C - B.Ed / Degree + PGDE" },
  { value: "Category D", label: "Category D - N.C.E (Basic Education)" },
];

export default function StaffProfileDrawer({
  staff,
  isOpen,
  onClose,
  departments,
  schoolId,
  schoolDomain,
  schoolName,
  onStaffUpdated,
  onPrintIdCard,
  onPrintAppointmentLetter,
}: StaffProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState<"bio" | "qualifications" | "department" | "payroll">("bio");
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [profileData, setProfileData] = useState<any>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State for editing
  const [formData, setFormData] = useState<any>({});
  const [voucherAmount, setVoucherAmount] = useState<string>("");
  const [showVoucherForm, setShowVoucherForm] = useState(false);

  useEffect(() => {
    if (staff && isOpen) {
      setProfileData(staff);
      initFormData(staff);
      // Load full dossier from server
      fetchStaffFullProfile(schoolDomain, staff.id).then((res) => {
        if (res.success && res.data) {
          setProfileData(res.data);
          initFormData(res.data);
        }
      });
    } else {
      setIsEditing(false);
      setAlertMsg(null);
      setShowVoucherForm(false);
    }
  }, [staff, isOpen, schoolDomain]);

  const initFormData = (data: any) => {
    const meta = data.metadata || {};
    setFormData({
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      email: data.email || "",
      role: data.role || "",
      status: data.status || "ACTIVE",
      departmentId: data.departmentId || "",
      baseSalary: data.baseSalary || "",
      bankName: data.bankName || "Zenith Bank",
      bankAccountNumber: data.bankAccountNumber || "",
      accountName: data.accountName || `${data.firstName} ${data.lastName}`,
      // Meta
      phone: meta.phone || "",
      whatsapp: meta.whatsapp || "",
      nin: meta.nin || "",
      gender: meta.gender || "Male",
      stateOfOrigin: meta.state_of_origin || "",
      lgaOfOrigin: meta.lga_of_origin || "",
      residentialAddress: meta.residential_address || "",
      qualification: meta.qualification || "B.Ed (Bachelor of Education)",
      institution: meta.institution || "",
      graduationYear: meta.graduation_year || "2020",
      trcnNumber: meta.trcn_number || "",
      trcnCategory: meta.trcn_category || "Category C",
      trcnStatus: meta.trcn_status || "REGISTERED",
      specialization: meta.specialization || "General Studies",
      appointmentType: meta.appointment_type || "FULL_TIME",
      appointmentDate: meta.appointment_date || new Date().toISOString().split("T")[0],
      emergencyName: meta.emergency_name || "",
      emergencyPhone: meta.emergency_phone || "",
    });
    if (data.baseSalary) {
      setVoucherAmount(data.baseSalary.toString());
    }
  };

  if (!isOpen || !staff) return null;

  const meta = profileData?.metadata || {};
  const stats = profileData?.stats || {
    totalMarked: 0,
    presentCount: 0,
    lateCount: 0,
    attendanceRate: 100,
  };

  const staffEmployeeId = `GW/STF/2026/${staff.id.slice(0, 5).toUpperCase()}`;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);

    startTransition(async () => {
      const res = await updateStaffProfile(schoolDomain, staff.id, {
        ...formData,
        baseSalary: formData.baseSalary ? parseFloat(formData.baseSalary) : null,
      });

      if (res.success) {
        setAlertMsg({ type: "success", text: "Staff profile updated successfully." });
        setIsEditing(false);
        const refreshed = await fetchStaffFullProfile(schoolDomain, staff.id);
        if (refreshed.success && refreshed.data) {
          setProfileData(refreshed.data);
          initFormData(refreshed.data);
        }
        if (onStaffUpdated) onStaffUpdated();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to update profile." });
      }
    });
  };

  const handleMarkAttendance = (status: "PRESENT" | "LATE" | "EXCUSED" | "ABSENT") => {
    startTransition(async () => {
      const res = await markStaffQuickAttendanceAction(schoolDomain, staff.id, status);
      if (res.success) {
        setAlertMsg({ type: "success", text: `Marked today's attendance as ${status}.` });
        const refreshed = await fetchStaffFullProfile(schoolDomain, staff.id);
        if (refreshed.success && refreshed.data) {
          setProfileData(refreshed.data);
        }
        if (onStaffUpdated) onStaffUpdated();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to update attendance." });
      }
    });
  };

  const handleGenerateVoucher = async () => {
    const amt = parseFloat(voucherAmount);
    if (isNaN(amt) || amt <= 0) {
      setAlertMsg({ type: "error", text: "Please enter a valid salary amount." });
      return;
    }

    startTransition(async () => {
      const res = await generateStaffPayrollVoucherAction(schoolDomain, staff.id, amt);
      if (res.success) {
        setAlertMsg({ type: "success", text: `Payroll voucher generated for ₦${amt.toLocaleString()}!` });
        setShowVoucherForm(false);
        const refreshed = await fetchStaffFullProfile(schoolDomain, staff.id);
        if (refreshed.success && refreshed.data) {
          setProfileData(refreshed.data);
        }
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to create voucher." });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="p-6 bg-slate-900 text-white flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-lg border-2 border-indigo-400/30">
                {profileData?.firstName?.[0]}
                {profileData?.lastName?.[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black tracking-tight text-white">
                    {profileData?.firstName} {profileData?.lastName}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    profileData?.status === "ACTIVE"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {profileData?.status}
                  </span>
                </div>
                <p className="text-xs text-indigo-200 mt-0.5 font-medium flex items-center gap-2">
                  <span>{profileData?.role}</span>
                  <span>•</span>
                  <span>{profileData?.department?.name || "Unassigned Dept"}</span>
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  ID: <strong className="text-slate-200">{staffEmployeeId}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ACTION TOOLBAR */}
          <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-800 text-xs">
            <button
              onClick={() => onPrintIdCard && onPrintIdCard(profileData)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>Print ID Card</span>
            </button>
            <button
              onClick={() => onPrintAppointmentLetter && onPrintAppointmentLetter(profileData)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg flex items-center gap-1.5 transition"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Appointment Letter</span>
            </button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1.5 font-medium rounded-lg flex items-center gap-1.5 transition ml-auto ${
                isEditing
                  ? "bg-amber-500 text-slate-900 font-bold"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? "Cancel Edit" : "Edit Profile"}</span>
            </button>
          </div>

          {/* TAB STRIP */}
          <div className="flex items-center gap-1 mt-4 -mb-2 border-b border-slate-800">
            {[
              { id: "bio", label: "Bio-Data & Contact" },
              { id: "qualifications", label: "TRCN & Qualifications" },
              { id: "department", label: "Dept & Attendance" },
              { id: "payroll", label: "Salary & Banking" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 text-xs font-bold transition border-b-2 ${
                  activeTab === tab.id
                    ? "border-indigo-400 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ALERT BANNER */}
        {alertMsg && (
          <div className={`p-3 text-xs font-semibold flex items-center gap-2 ${
            alertMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200" : "bg-red-50 text-red-800 border-b border-red-200"
          }`}>
            {alertMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{alertMsg.text}</span>
          </div>
        )}

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {isEditing ? (
            /* EDIT FORM */
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                  Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +234 803 123 4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">WhatsApp Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. 2348031234567"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">NIN (11 Digits)</label>
                    <input
                      type="text"
                      maxLength={11}
                      placeholder="e.g. 98234120932"
                      value={formData.nin}
                      onChange={(e) => setFormData({ ...formData, nin: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">State of Origin</label>
                    <input
                      type="text"
                      placeholder="e.g. Lagos, Ogun, Kano"
                      value={formData.stateOfOrigin}
                      onChange={(e) => setFormData({ ...formData, stateOfOrigin: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* QUALIFICATIONS & TRCN */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                  TRCN & Academic Credentials
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Highest Qualification</label>
                    <select
                      value={formData.qualification}
                      onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
                    >
                      {QUALIFICATIONS.map((q) => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Awarding Institution</label>
                    <input
                      type="text"
                      placeholder="e.g. University of Lagos / FCE Akoka"
                      value={formData.institution}
                      onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">TRCN Registration No.</label>
                    <input
                      type="text"
                      placeholder="e.g. TRCN/LA/2024/09842"
                      value={formData.trcnNumber}
                      onChange={(e) => setFormData({ ...formData, trcnNumber: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">TRCN Category</label>
                    <select
                      value={formData.trcnCategory}
                      onChange={(e) => setFormData({ ...formData, trcnCategory: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
                    >
                      {TRCN_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">TRCN Certification Status</label>
                    <select
                      value={formData.trcnStatus}
                      onChange={(e) => setFormData({ ...formData, trcnStatus: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
                    >
                      <option value="REGISTERED">Registered & Certified Teacher</option>
                      <option value="IN_PROGRESS">Examination Passed (License Pending)</option>
                      <option value="EXEMPT">Non-Teaching / Administrative Exempt</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Teaching Specialization</label>
                    <input
                      type="text"
                      placeholder="e.g. Mathematics & Further Maths"
                      value={formData.specialization}
                      onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* DEPARTMENT & COMPENSATION */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                  Department & Remuneration
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Academic Department</label>
                    <select
                      value={formData.departmentId}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
                    >
                      <option value="">-- Select Department --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Employment Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="ONBOARDING">ONBOARDING</option>
                      <option value="LEAVE">LEAVE OF ABSENCE</option>
                      <option value="OFFBOARDED">OFFBOARDED</option>
                      <option value="TERMINATED">TERMINATED</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Monthly Base Salary (₦)</label>
                    <input
                      type="number"
                      placeholder="e.g. 220000"
                      value={formData.baseSalary}
                      onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Bank Name</label>
                    <select
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white"
                    >
                      {NIGERIAN_BANKS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">NUBAN Account Number (10 Digits)</label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="e.g. 0123456789"
                      value={formData.bankAccountNumber}
                      onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Verified Account Name</label>
                    <input
                      type="text"
                      value={formData.accountName}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{isPending ? "Saving..." : "Save Profile"}</span>
                </button>
              </div>
            </form>
          ) : (
            /* VIEW MODE TABS */
            <div className="space-y-6">
              {/* TAB 1: BIO-DATA & CONTACT */}
              {activeTab === "bio" && (
                <div className="space-y-5">
                  {/* DIRECT COMMUNICATION ACTION BUTTONS */}
                  <div className="grid grid-cols-3 gap-3">
                    <a
                      href={meta.phone ? `tel:${meta.phone}` : undefined}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-semibold text-xs transition ${
                        meta.phone
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-400 border-slate-200 pointer-events-none"
                      }`}
                    >
                      <Phone className="w-4 h-4" />
                      <span>{meta.phone ? "Call Phone" : "No Phone"}</span>
                    </a>

                    <a
                      href={meta.whatsapp ? `https://wa.me/${meta.whatsapp.replace(/\D/g, "")}` : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-semibold text-xs transition ${
                        meta.whatsapp
                          ? "bg-green-50 text-green-800 border-green-200 hover:bg-green-100"
                          : "bg-slate-100 text-slate-400 border-slate-200 pointer-events-none"
                      }`}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{meta.whatsapp ? "WhatsApp" : "No WhatsApp"}</span>
                    </a>

                    <a
                      href={`mailto:${profileData?.email}`}
                      className="p-3 rounded-xl border bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 flex items-center justify-center gap-2 font-semibold text-xs transition"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Send Email</span>
                    </a>
                  </div>

                  {/* IDENTIFICATION & STATUTORY DATA */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                      National Identification & Bio-Data
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">National Identification No (NIN)</span>
                        {meta.nin ? (
                          <span className="inline-flex items-center gap-1.5 font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            {meta.nin}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold">NIN Pending Registration</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">Gender</span>
                        <p className="font-bold text-slate-800">{meta.gender || "Not specified"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">State & LGA of Origin</span>
                        <p className="font-bold text-slate-800">
                          {meta.state_of_origin ? `${meta.state_of_origin} State (${meta.lga_of_origin || "LGA"})` : "Not specified"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">Residential Address</span>
                        <p className="font-bold text-slate-800">{meta.residential_address || "On file in registrar office"}</p>
                      </div>
                    </div>
                  </div>

                  {/* EMERGENCY CONTACT */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                      Emergency Contact Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">Contact Person</span>
                        <p className="font-bold text-slate-800">{meta.emergency_name || "Next of Kin / Spouse"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">Emergency Telephone</span>
                        <p className="font-bold text-slate-800">{meta.emergency_phone || "Same as primary phone"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: QUALIFICATIONS & TRCN */}
              {activeTab === "qualifications" && (
                <div className="space-y-5">
                  {/* TRCN ACCREDITATION CARD */}
                  <div className="bg-emerald-900 text-white p-5 rounded-2xl shadow-sm border border-emerald-800 relative overflow-hidden">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                          Teachers Registration Council of Nigeria
                        </span>
                        <h4 className="text-lg font-black mt-1">TRCN Professional Certification</h4>
                        <p className="text-xs text-emerald-200 mt-1 font-medium">
                          License No: <strong className="text-white font-mono">{meta.trcn_number || "TRCN/PENDING/2026"}</strong>
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-emerald-800/80 flex items-center justify-center text-emerald-300">
                        <Award className="w-7 h-7" />
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-emerald-800/60 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-emerald-400 text-[10px] uppercase font-bold block">Accreditation Tier</span>
                        <span className="font-black text-white">{meta.trcn_category || "Category C (B.Ed)"}</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 bg-emerald-500 text-slate-900 font-black px-2.5 py-1 rounded-full text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{meta.trcn_status === "REGISTERED" ? "Verified & Licensed" : "Exam Passed"}</span>
                      </span>
                    </div>
                  </div>

                  {/* HIGHEST DEGREE */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                      Academic Degree & Institutions
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">Highest Qualification</span>
                        <p className="font-black text-slate-800 text-sm">
                          {meta.qualification || "B.Ed (Bachelor of Education)"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">Awarding Institution</span>
                        <p className="font-bold text-slate-800">{meta.institution || "Premier University / COE"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">Graduation Year</span>
                        <p className="font-bold text-slate-800">{meta.graduation_year || "2020"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">Teaching Subject Specialty</span>
                        <p className="font-bold text-slate-800">{meta.specialization || "General Education"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: DEPARTMENT & ATTENDANCE */}
              {activeTab === "department" && (
                <div className="space-y-5">
                  {/* ATTENDANCE SUMMARY METRICS */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Turnout Rate
                      </span>
                      <p className="text-2xl font-black text-slate-800">{stats.attendanceRate}%</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Days Present
                      </span>
                      <p className="text-2xl font-black text-emerald-600">{stats.presentCount}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Days Late
                      </span>
                      <p className="text-2xl font-black text-amber-600">{stats.lateCount}</p>
                    </div>
                  </div>

                  {/* QUICK CLOCK-IN FOR TODAY */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Mark Today&apos;s Attendance
                      </h4>
                      <span className="text-[11px] font-mono font-medium text-slate-400">
                        {new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => handleMarkAttendance("PRESENT")}
                        disabled={isPending}
                        className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl text-xs transition active:scale-95"
                      >
                        Present
                      </button>
                      <button
                        onClick={() => handleMarkAttendance("LATE")}
                        disabled={isPending}
                        className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs transition active:scale-95"
                      >
                        Late
                      </button>
                      <button
                        onClick={() => handleMarkAttendance("EXCUSED")}
                        disabled={isPending}
                        className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold rounded-xl text-xs transition active:scale-95"
                      >
                        Excused
                      </button>
                      <button
                        onClick={() => handleMarkAttendance("ABSENT")}
                        disabled={isPending}
                        className="p-2.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 font-bold rounded-xl text-xs transition active:scale-95"
                      >
                        Absent
                      </button>
                    </div>
                  </div>

                  {/* RECENT ATTENDANCE LOG */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                      Recent Attendance Records (14 Days)
                    </h4>
                    {profileData?.StaffAttendance?.length > 0 ? (
                      <div className="divide-y divide-slate-100 text-xs">
                        {profileData.StaffAttendance.map((rec: any) => (
                          <div key={rec.id} className="py-2.5 flex items-center justify-between">
                            <span className="font-medium text-slate-700">
                              {new Date(rec.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              rec.status === "PRESENT" ? "bg-emerald-100 text-emerald-800" :
                              rec.status === "LATE" ? "bg-amber-100 text-amber-800" :
                              rec.status === "EXCUSED" ? "bg-blue-100 text-blue-800" :
                              "bg-red-100 text-red-800"
                            }`}>
                              {rec.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-3 text-center">No attendance recorded yet for this period.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: REMUNERATION & BANKING */}
              {activeTab === "payroll" && (
                <div className="space-y-5">
                  {/* COMPENSATION CARD */}
                  <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                          Monthly Remuneration Package
                        </span>
                        <p className="text-3xl font-black mt-1">
                          ₦{(profileData?.baseSalary || 0).toLocaleString()}
                          <span className="text-xs font-normal text-slate-400 ml-1">/ month</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setShowVoucherForm(!showVoucherForm)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition"
                      >
                        Generate Voucher
                      </button>
                    </div>

                    {/* VOUCHER MODAL / INLINE FORM */}
                    {showVoucherForm && (
                      <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                        <label className="text-xs font-semibold text-slate-300 block">
                          Remuneration Amount (₦)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={voucherAmount}
                            onChange={(e) => setVoucherAmount(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs flex-1 font-mono"
                          />
                          <button
                            onClick={handleGenerateVoucher}
                            disabled={isPending}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition"
                          >
                            Submit Voucher
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* NIGERIAN BANKING DESTINATION */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                      Electronic Bank Transfer Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">Bank Institution</span>
                        <p className="font-bold text-slate-800">{profileData?.bankName || "Zenith Bank Plc"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-medium">Account Number (NUBAN)</span>
                        <p className="font-black text-slate-800 font-mono text-sm">
                          {profileData?.bankAccountNumber || "Pending submission"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block mb-0.5 font-medium">Account Beneficiary Name</span>
                        <p className="font-bold text-slate-800">{profileData?.accountName || `${profileData?.firstName} ${profileData?.lastName}`}</p>
                      </div>
                    </div>
                  </div>

                  {/* RECENT PAYSLIPS / VOUCHERS */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                      Historical Payroll Disbursements
                    </h4>
                    {profileData?.PayrollRecord?.length > 0 ? (
                      <div className="divide-y divide-slate-100 text-xs">
                        {profileData.PayrollRecord.map((p: any) => (
                          <div key={p.id} className="py-2.5 flex items-center justify-between">
                            <div>
                              <span className="font-black text-slate-800">₦{p.amount.toLocaleString()}</span>
                              <span className="text-slate-400 font-mono text-[11px] ml-2">
                                Ref: {p.receiptCode || "VOUCHER"}
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              p.status === "PAID" || p.status === "DISBURSED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}>
                              {p.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-3 text-center">No payroll records logged yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM DRAWER FOOTER */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{schoolName} • Faculty Management Portal</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
