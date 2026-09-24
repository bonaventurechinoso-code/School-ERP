"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
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
  Copy,
  Check,
  Landmark,
  Eye,
  Trash2,
  Shield,
  Receipt,
  Download,
  Building,
  ArrowRight,
  Search,
} from "lucide-react";
import {
  fetchStaffFullProfile,
  updateStaffProfile,
  markStaffQuickAttendanceAction,
  generateStaffPayrollVoucherAction,
  updatePayrollVoucherStatusAction,
  deletePayrollVoucherAction,
} from "./actions";

/**
 * Computes official Nigerian educational salary structure:
 * - Basic Salary (60%)
 * - Housing Allowance (20%)
 * - Transport Allowance (10%)
 * - Teaching / Utility Allowance (10%)
 * - Contributory Pension (8% on BHT)
 * - PAYE Tax (estimated progressive band ~5%)
 * - Net Pay
 */
export function calculateSalaryBreakdown(gross: number) {
  const safeGross = Math.max(0, gross || 0);
  const basic = Math.round(safeGross * 0.60);
  const housing = Math.round(safeGross * 0.20);
  const transport = Math.round(safeGross * 0.10);
  const utilityTeaching = Math.max(0, safeGross - (basic + housing + transport)); // 10%
  
  // Statutory deductions:
  // Contributory Pension (PRA 2014): 8% of BHT (Basic + Housing + Transport = 90% of Gross)
  const bht = basic + housing + transport;
  const pension = Math.round(bht * 0.08); // 7.2% of Gross
  // PAYE Tax (estimated standard progressive band ~5% effective for educational salary scale)
  const payeTax = Math.round(safeGross * 0.05);
  const totalDeductions = pension + payeTax;
  const netPay = Math.max(0, safeGross - totalDeductions);

  return {
    gross: safeGross,
    basic,
    housing,
    transport,
    utilityTeaching,
    pension,
    payeTax,
    totalDeductions,
    netPay,
  };
}

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
  "Raenest",
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
  const [voucherPeriod, setVoucherPeriod] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  });
  const [selectedVoucherForModal, setSelectedVoucherForModal] = useState<any | null>(null);
  const [copiedNuban, setCopiedNuban] = useState(false);
  const [voucherProcessingId, setVoucherProcessingId] = useState<string | null>(null);

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
      setSelectedVoucherForModal(null);
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

  const handleCopyNuban = (nuban: string) => {
    if (!nuban) return;
    try {
      navigator.clipboard.writeText(nuban);
      setCopiedNuban(true);
      setTimeout(() => setCopiedNuban(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);

    if (formData.bankAccountNumber && formData.bankAccountNumber.trim()) {
      if (!/^\d{10}$/.test(formData.bankAccountNumber.trim())) {
        setAlertMsg({ type: "error", text: "NUBAN account number must be exactly 10 numerical digits." });
        return;
      }
    }

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
        if (onStaffUpdated) onStaffUpdated();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to create voucher." });
      }
    });
  };

  const handleUpdateVoucherStatus = async (voucherId: string, newStatus: "PENDING" | "DISBURSED" | "PAID") => {
    setVoucherProcessingId(voucherId);
    try {
      const res = await updatePayrollVoucherStatusAction(schoolDomain, voucherId, newStatus);
      if (res.success) {
        setAlertMsg({ type: "success", text: `Voucher marked as ${newStatus} successfully!` });
        if (selectedVoucherForModal && selectedVoucherForModal.id === voucherId) {
          setSelectedVoucherForModal((prev: any) => ({ ...prev, status: newStatus }));
        }
        const refreshed = await fetchStaffFullProfile(schoolDomain, staff.id);
        if (refreshed.success && refreshed.data) {
          setProfileData(refreshed.data);
        }
        if (onStaffUpdated) onStaffUpdated();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to update voucher status." });
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Failed to update voucher status." });
    } finally {
      setVoucherProcessingId(null);
    }
  };

  const handleDeleteVoucher = async (voucherId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this pending payroll voucher?")) return;
    setVoucherProcessingId(voucherId);
    try {
      const res = await deletePayrollVoucherAction(schoolDomain, voucherId);
      if (res.success) {
        setAlertMsg({ type: "success", text: "Payroll voucher removed successfully." });
        if (selectedVoucherForModal && selectedVoucherForModal.id === voucherId) {
          setSelectedVoucherForModal(null);
        }
        const refreshed = await fetchStaffFullProfile(schoolDomain, staff.id);
        if (refreshed.success && refreshed.data) {
          setProfileData(refreshed.data);
        }
        if (onStaffUpdated) onStaffUpdated();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to delete voucher." });
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Failed to delete voucher." });
    } finally {
      setVoucherProcessingId(null);
    }
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
                    {/* Searchable bank dropdown */}
                    {(() => {
                      const [bankDrawerSearch, setBankDrawerSearch] = React.useState("");
                      const [bankDrawerOpen, setBankDrawerOpen] = React.useState(false);
                      const bankDrawerRef = React.useRef<HTMLDivElement>(null);
                      const filtered = NIGERIAN_BANKS.filter((b) => b.toLowerCase().includes(bankDrawerSearch.toLowerCase()));
                      React.useEffect(() => {
                        const handler = (e: MouseEvent) => {
                          if (bankDrawerRef.current && !bankDrawerRef.current.contains(e.target as Node)) {
                            setBankDrawerOpen(false); setBankDrawerSearch("");
                          }
                        };
                        document.addEventListener("mousedown", handler);
                        return () => document.removeEventListener("mousedown", handler);
                      }, []);
                      return (
                        <div ref={bankDrawerRef} className="relative">
                          <button type="button" onClick={() => { setBankDrawerOpen(o => !o); setBankDrawerSearch(""); }}
                            className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white text-xs flex items-center justify-between text-left">
                            <span>{formData.bankName || "Select bank..."}</span>
                            <span className="text-slate-400 text-xs">&#9660;</span>
                          </button>
                          {bankDrawerOpen && (
                            <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                              <div className="p-1.5 border-b border-slate-100">
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                  <input autoFocus type="text" value={bankDrawerSearch} onChange={(e) => setBankDrawerSearch(e.target.value)}
                                    placeholder="Search bank..." className="w-full pl-6 pr-2 py-1 text-xs rounded border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                </div>
                              </div>
                              <ul className="max-h-48 overflow-y-auto">
                                {filtered.length === 0 ? <li className="px-3 py-2 text-xs text-slate-400 text-center">No banks found.</li> : filtered.map((b) => (
                                  <li key={b} onClick={() => { setFormData({ ...formData, bankName: b }); setBankDrawerOpen(false); setBankDrawerSearch(""); }}
                                    className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-indigo-50 transition ${formData.bankName === b ? "bg-indigo-50 font-bold text-indigo-700" : "text-slate-700"}`}>{b}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
              {activeTab === "payroll" && (() => {
                const salaryBreakdown = calculateSalaryBreakdown(profileData?.baseSalary || 0);

                return (
                  <div className="space-y-5">
                    {/* CONSOLIDATED REMUNERATION PACKAGE CARD */}
                    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block mb-1">
                            Consolidated Monthly Remuneration
                          </span>
                          <p className="text-3xl font-black">
                            ₦{(profileData?.baseSalary || 0).toLocaleString()}
                            <span className="text-xs font-normal text-slate-400 ml-1.5">/ month gross</span>
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Includes statutory basic pay, housing, transport &amp; teaching utility allowances.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowVoucherForm(!showVoucherForm)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-md self-start"
                        >
                          <Receipt className="w-3.5 h-3.5 text-indigo-200" />
                          <span>{showVoucherForm ? "Close Form" : "Generate Monthly Voucher"}</span>
                        </button>
                      </div>

                      {/* INLINE VOUCHER FORM */}
                      {showVoucherForm && (
                        <div className="pt-4 border-t border-slate-800 space-y-3 animate-in fade-in duration-150">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-300 block mb-1">
                                Voucher Remuneration Amount (₦)
                              </label>
                              <input
                                type="number"
                                value={voucherAmount}
                                onChange={(e) => setVoucherAmount(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-mono"
                                placeholder="e.g. 220000"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-300 block mb-1">
                                Payment Period / Month
                              </label>
                              <input
                                type="text"
                                value={voucherPeriod}
                                onChange={(e) => setVoucherPeriod(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs"
                                placeholder="e.g. September 2026"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowVoucherForm(false)}
                              className="px-3 py-1.5 text-slate-400 hover:text-white text-xs font-semibold"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleGenerateVoucher}
                              disabled={isPending}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-md"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isPending ? "Generating..." : "Submit Salary Voucher"}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* STATUTORY ALLOWANCE & DEDUCTION BREAKDOWN CHIPS */}
                      <div className="pt-2 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Basic Salary (60%)</span>
                          <p className="font-mono font-bold text-slate-200 mt-0.5">₦{salaryBreakdown.basic.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Housing (20%)</span>
                          <p className="font-mono font-bold text-slate-200 mt-0.5">₦{salaryBreakdown.housing.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Transport (10%)</span>
                          <p className="font-mono font-bold text-slate-200 mt-0.5">₦{salaryBreakdown.transport.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Utility / Teaching (10%)</span>
                          <p className="font-mono font-bold text-slate-200 mt-0.5">₦{salaryBreakdown.utilityTeaching.toLocaleString()}</p>
                        </div>
                        <div className="bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/40">
                          <span className="text-[10px] text-rose-300 uppercase font-bold block">Pension (8% BHT)</span>
                          <p className="font-mono font-bold text-rose-200 mt-0.5">-₦{salaryBreakdown.pension.toLocaleString()}</p>
                        </div>
                        <div className="bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/40">
                          <span className="text-[10px] text-rose-300 uppercase font-bold block">PAYE Tax (Est. 5%)</span>
                          <p className="font-mono font-bold text-rose-200 mt-0.5">-₦{salaryBreakdown.payeTax.toLocaleString()}</p>
                        </div>
                        <div className="col-span-2 bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-700/50 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-emerald-300 uppercase font-black block">Est. Net Take-Home</span>
                            <p className="font-mono font-black text-emerald-200 text-sm mt-0.5">₦{salaryBreakdown.netPay.toLocaleString()}</p>
                          </div>
                          <span className="text-[10px] text-emerald-400/80 font-medium">To Staff Bank</span>
                        </div>
                      </div>
                    </div>

                    {/* NIGERIAN BANKING DESTINATION */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Landmark className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                            Direct Bank Electronic Settlement (NUBAN)
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>CBN Model A Compliant</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 block mb-0.5 font-medium">Bank Institution</span>
                          <p className="font-bold text-slate-800">{profileData?.bankName || "Zenith Bank Plc"}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5 font-medium">Account Number (NUBAN)</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="font-black text-slate-800 font-mono text-sm tracking-wider">
                              {profileData?.bankAccountNumber || "Pending submission"}
                            </p>
                            {profileData?.bankAccountNumber && (
                              <button
                                type="button"
                                onClick={() => handleCopyNuban(profileData.bankAccountNumber)}
                                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                                title="Copy Account Number"
                              >
                                {copiedNuban ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                          {copiedNuban && <span className="text-[10px] text-emerald-600 font-bold">Copied to clipboard!</span>}
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-slate-400 block mb-0.5 font-medium">Beneficiary Account Name</span>
                          <p className="font-bold text-slate-800">{profileData?.accountName || `${profileData?.firstName} ${profileData?.lastName}`}</p>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-500">
                        <Shield className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                        <p>
                          Direct electronic bank transfer: Salaries are credited directly to the staff member&apos;s verified Nigerian NUBAN account with zero intermediary platform escrow.
                        </p>
                      </div>
                    </div>

                    {/* HISTORICAL PAYSLIPS / VOUCHERS */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                            Historical Payroll Disbursements &amp; Remuneration Slips
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Click any voucher record to inspect full breakdown, settle, or print official payslip
                          </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-400">
                          {profileData?.PayrollRecord?.length || 0} record(s)
                        </span>
                      </div>

                      {profileData?.PayrollRecord?.length > 0 ? (
                        <div className="divide-y divide-slate-100 text-xs">
                          {profileData.PayrollRecord.map((p: any) => {
                            const isDisbursed = p.status === "PAID" || p.status === "DISBURSED";
                            const isProcessing = voucherProcessingId === p.id;

                            return (
                              <div
                                key={p.id}
                                onClick={() => setSelectedVoucherForModal(p)}
                                className="py-3 px-2 rounded-xl hover:bg-slate-50/80 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition group"
                              >
                                <div className="flex items-start sm:items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                                    isDisbursed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                  }`}>
                                    ₦
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-black text-slate-800 text-sm">₦{p.amount.toLocaleString()}</span>
                                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                        isDisbursed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                      }`}>
                                        {p.status}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400 text-[11px] font-mono mt-0.5">
                                      <span>Ref: {p.receiptCode || "VOUCHER"}</span>
                                      <span>•</span>
                                      <span>{new Date(p.payDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedVoucherForModal(p)}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 transition"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Payslip</span>
                                  </button>
                                  {!isDisbursed && (
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => handleUpdateVoucherStatus(p.id, "DISBURSED")}
                                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1 transition disabled:opacity-50"
                                      title="Mark as Disbursed"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>{isProcessing ? "Updating..." : "Disburse"}</span>
                                    </button>
                                  )}
                                  {!isDisbursed && (
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={(e) => handleDeleteVoucher(p.id, e)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                                      title="Delete Draft Voucher"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-600">No payroll vouchers generated yet</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Click &quot;Generate Monthly Voucher&quot; above to create the first remuneration record.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* BOTTOM DRAWER FOOTER */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{schoolName} • Staff Management Portal</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
          >
            Close Dossier
          </button>
        </div>
      </div>

      {/* OFFICIAL PRINTABLE PAYSLIP & SALARY VOUCHER MODAL */}
      {selectedVoucherForModal && (() => {
        const vb = calculateSalaryBreakdown(selectedVoucherForModal.amount);
        const isVoucherDisbursed = selectedVoucherForModal.status === "PAID" || selectedVoucherForModal.status === "DISBURSED";
        const voucherDate = new Date(selectedVoucherForModal.payDate);
        const formattedMonth = voucherDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
        const hashToken = `0x${(selectedVoucherForModal.id + selectedVoucherForModal.amount).replace(/-/g, "").slice(0, 20).toUpperCase()}`;

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
            <style dangerouslySetInnerHTML={{
              __html: `
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-payslip, #printable-payslip * {
                    visibility: visible !important;
                  }
                  #printable-payslip {
                    position: fixed !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100vw !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 24px !important;
                    box-shadow: none !important;
                    border: 1px solid #cbd5e1 !important;
                    background: white !important;
                    z-index: 999999 !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `
            }} />
            <div 
              id="printable-payslip"
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* MODAL ACTIONS BAR (HIDDEN ON PRINT) */}
              <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Official Salary Advice &amp; Voucher
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!isVoucherDisbursed && (
                    <button
                      type="button"
                      disabled={voucherProcessingId === selectedVoucherForModal.id}
                      onClick={() => handleUpdateVoucherStatus(selectedVoucherForModal.id, "DISBURSED")}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Disbursed</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Payslip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVoucherForModal(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* PRINTABLE SLIP CONTENT */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800">
                {/* INSTITUTION HEADER */}
                <div className="text-center border-b-2 border-slate-900 pb-5">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                    {schoolName}
                  </h2>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-1">
                    Human Resources &amp; Bursary Division • {schoolDomain}.bonaveeict.com.ng
                  </p>
                  <div className="inline-block mt-3 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-700">
                    Official Monthly Payslip &amp; Remuneration Voucher
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 mt-4 px-2 gap-2">
                    <span><strong>Pay Period:</strong> {formattedMonth}</span>
                    <span><strong>Voucher Ref:</strong> <code className="font-mono text-slate-700 font-bold">{selectedVoucherForModal.receiptCode || "VOUCHER"}</code></span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                      isVoucherDisbursed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {isVoucherDisbursed ? "DISBURSED / SETTLED" : "PENDING DISBURSEMENT"}
                    </span>
                  </div>
                </div>

                {/* STAFF & BANK PARTICULARS GRID */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium uppercase text-[10px]">Staff Full Name</span>
                    <p className="font-black text-slate-900 text-sm">{profileData?.firstName} {profileData?.lastName}</p>
                    <p className="text-slate-500 font-mono text-[11px] mt-0.5">ID: {staffEmployeeId}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium uppercase text-[10px]">Staff Designation</span>
                    <p className="font-bold text-slate-800">{profileData?.role}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">{profileData?.department?.name || "General Staff"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium uppercase text-[10px]">TRCN Category &amp; License</span>
                    <p className="font-bold text-slate-800">{meta.trcn_category || "Category C"}</p>
                    <p className="text-slate-500 font-mono text-[11px] mt-0.5">{meta.trcn_number || "TRCN Registered"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium uppercase text-[10px]">Settlement Bank (NUBAN)</span>
                    <p className="font-bold text-slate-800">{profileData?.bankName || "Zenith Bank"}</p>
                    <p className="text-slate-900 font-mono font-black text-xs tracking-wider mt-0.5">
                      {profileData?.bankAccountNumber || "Pending submission"}
                    </p>
                  </div>
                </div>

                {/* EARNINGS AND DEDUCTIONS TABLE */}
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left divide-y divide-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">Remuneration &amp; Allowance Item</th>
                        <th className="p-3 text-right">Amount (₦)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-2.5 font-medium text-slate-700 pl-4">Basic Salary Component (60%)</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-800 pr-4">₦{vb.basic.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-700 pl-4">Housing Allowance (20%)</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-800 pr-4">₦{vb.housing.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-700 pl-4">Transport Allowance (10%)</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-800 pr-4">₦{vb.transport.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-700 pl-4">Teaching &amp; Utility Allowance (10%)</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-800 pr-4">₦{vb.utilityTeaching.toLocaleString()}</td>
                      </tr>
                      <tr className="bg-slate-50 font-bold border-t border-slate-200">
                        <td className="p-2.5 text-slate-900 pl-4 uppercase text-[11px]">Total Gross Remuneration</td>
                        <td className="p-2.5 text-right font-mono font-black text-slate-900 pr-4">₦{vb.gross.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-rose-700 pl-4 font-medium">Contributory Pension Deduction (8% BHT)</td>
                        <td className="p-2.5 text-right font-mono font-bold text-rose-700 pr-4">-₦{vb.pension.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-rose-700 pl-4 font-medium">Personal Income Tax (PAYE Statutory)</td>
                        <td className="p-2.5 text-right font-mono font-bold text-rose-700 pr-4">-₦{vb.payeTax.toLocaleString()}</td>
                      </tr>
                      <tr className="bg-rose-50/50 font-bold">
                        <td className="p-2.5 text-rose-800 pl-4 uppercase text-[11px]">Total Statutory Deductions</td>
                        <td className="p-2.5 text-right font-mono font-black text-rose-800 pr-4">-₦{vb.totalDeductions.toLocaleString()}</td>
                      </tr>
                      <tr className="bg-emerald-50 text-emerald-950 font-black border-t-2 border-emerald-600">
                        <td className="p-3 pl-4 uppercase text-xs tracking-wider">
                          Net Remuneration Payable (Take-Home)
                        </td>
                        <td className="p-3 text-right font-mono text-base font-black text-emerald-800 pr-4">
                          ₦{vb.netPay.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* AUDIT & SECURITY TOKEN */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono gap-2">
                  <span>AUDIT TOKEN: <strong>{hashToken}</strong></span>
                  <span>CBN Model A Direct Electronic Clearing</span>
                </div>

                {/* SIGNATORIES BLOCK */}
                <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-xs">
                  <div className="space-y-6">
                    <div className="border-b border-slate-400 w-48"></div>
                    <div>
                      <p className="font-bold text-slate-800">Bursar / Accounts Officer</p>
                      <p className="text-[10px] text-slate-400 uppercase">Authorized Signature &amp; Stamp</p>
                    </div>
                  </div>
                  <div className="space-y-6 text-right flex flex-col items-end">
                    <div className="border-b border-slate-400 w-48"></div>
                    <div>
                      <p className="font-bold text-slate-800">Head of School / Principal</p>
                      <p className="text-[10px] text-slate-400 uppercase">Approval &amp; Endorsement</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>Official institutional payslip generated for {profileData?.firstName} {profileData?.lastName}</span>
                <button
                  type="button"
                  onClick={() => setSelectedVoucherForModal(null)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
