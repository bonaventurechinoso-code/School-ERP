"use client";

import React, { useState, useTransition } from "react";
import {
  Printer,
  CheckCircle2,
  AlertCircle,
  QrCode,
  CreditCard,
  Banknote,
  FileCheck,
  User,
  Phone,
  Mail,
  GraduationCap,
  Calendar,
  Building2,
  RefreshCw,
} from "lucide-react";
import { recordWalkInApplication } from "./actions";

interface WalkInProps {
  schoolId: string;
  schoolName: string;
  subdomain: string;
  classrooms: Array<{ id: string; name: string }>;
}

export default function WalkInIntakeClient({
  schoolId,
  schoolName,
  subdomain,
  classrooms,
}: WalkInProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    email: "",
    phoneNumber: "",
    whatsappNumber: "",
    dateOfBirth: "",
    gender: "MALE",
    parentName: "",
    parentPhone: "",
    programId: classrooms[0]?.name || "Primary 1",
    registrarName: "Front Desk Officer",
    paymentMethod: "POS_COUNTER" as "POS_COUNTER" | "CASH",
    paymentAmount: 5000,
    posRef: "",
  });

  const [physicalDocs, setPhysicalDocs] = useState({
    birthCertificate: true,
    passportPhotograph: true,
    academicResults: true,
    lgaIndigeneCert: false,
  });

  const [isPending, startTransition] = useTransition();
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const res = await recordWalkInApplication({
        schoolId,
        registrarName: formData.registrarName,
        programId: formData.programId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        whatsappNumber: formData.whatsappNumber,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        parentName: formData.parentName,
        parentPhone: formData.parentPhone,
        physicalDocsSighted: physicalDocs,
        payment: {
          method: formData.paymentMethod,
          amount: formData.paymentAmount,
          posTerminalReference: formData.posRef || undefined,
        },
      });

      if (res.success && res.receiptPayload) {
        setReceiptData(res.receiptPayload);
      } else {
        setErrorMessage(res.error || "Failed to record walk-in applicant.");
      }
    });
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleResetForm = () => {
    setReceiptData(null);
    setFormData({
      firstName: "",
      lastName: "",
      middleName: "",
      email: "",
      phoneNumber: "",
      whatsappNumber: "",
      dateOfBirth: "",
      gender: "MALE",
      parentName: "",
      parentPhone: "",
      programId: classrooms[0]?.name || "Primary 1",
      registrarName: formData.registrarName,
      paymentMethod: "POS_COUNTER",
      paymentAmount: 5000,
      posRef: "",
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Walk-In Admissions Intake Desk
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {schoolName} • High-Speed Registrar Processing & Thermal QR Receipt
            </p>
          </div>
        </div>

        {receiptData && (
          <button
            onClick={handleResetForm}
            className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Walk-In</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      {receiptData ? (
        /* Printable Thermal Receipt Card */
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl max-w-md mx-auto text-center space-y-6 print:m-0 print:border-none print:shadow-none">
          <div className="border-b border-dashed border-slate-300 dark:border-zinc-700 pb-4">
            <h2 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
              {receiptData.schoolName}
            </h2>
            <p className="text-[11px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">
              Official Admissions Intake Receipt
            </p>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              Date: {new Date(receiptData.issuedAt).toLocaleString()}
            </div>
          </div>

          {/* QR Code Block */}
          <div className="p-4 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700 inline-block mx-auto">
            <QrCode className="w-24 h-24 mx-auto text-slate-900 dark:text-white" />
            <span className="text-[9px] font-mono text-slate-500 block mt-1">
              SCAN TO TRACK PROGRESS
            </span>
          </div>

          <div className="text-left text-xs space-y-2 border-t border-b border-dashed border-slate-300 dark:border-zinc-700 py-3 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">APPLICANT REF:</span>
              <span className="font-black text-indigo-600 dark:text-indigo-400">
                {receiptData.applicationNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">CANDIDATE:</span>
              <span className="font-bold text-slate-900 dark:text-white truncate">
                {receiptData.applicantName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">PROGRAM/CLASS:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {receiptData.program}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">PAYMENT:</span>
              <span className="font-bold text-emerald-600">
                {receiptData.paymentMethod} (PAID)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">AMOUNT PAID:</span>
              <span className="font-black text-slate-900 dark:text-white">
                NGN {Number(receiptData.amount).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">REGISTRAR:</span>
              <span className="text-slate-600 dark:text-zinc-400">
                {receiptData.registrarName}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 italic">
            Automated invitation and magic tracking link dispatched to applicant phone via WhatsApp and SMS.
          </div>

          <div className="flex items-center gap-3 pt-2 print:hidden">
            <button
              onClick={handlePrintReceipt}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print Thermal Slip</span>
            </button>
            <button
              onClick={handleResetForm}
              className="py-3 px-4 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-colors"
            >
              Next Candidate
            </button>
          </div>
        </div>
      ) : (
        /* Desk Intake Form */
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Candidate Bio-Data */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              1. Candidate Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">First Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Somto"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Last Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eze"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Middle Name</label>
                <input
                  type="text"
                  placeholder="e.g. Paul"
                  value={formData.middleName}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="candidate@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="08012345678"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Target Class / Program *</label>
                <select
                  value={formData.programId}
                  onChange={(e) => setFormData({ ...formData, programId: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold"
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="General Science">General Science</option>
                  <option value="Health Technology">Health Technology</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Parent/Guardian Name</label>
                <input
                  type="text"
                  placeholder="e.g. Chief Eze"
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Parent Phone Number</label>
                <input
                  type="tel"
                  placeholder="08098765432"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Physical Document Sighting Checklist */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              2. Physical Documents Sighted at Front Desk
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Check off physical certificates sighted and inspected during in-person registration.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                { key: "birthCertificate", label: "Original Birth Certificate / Age Declaration" },
                { key: "passportPhotograph", label: "Physical Passport Photograph Submitted" },
                { key: "academicResults", label: "Original Academic Report / Result Slip Sighted" },
                { key: "lgaIndigeneCert", label: "LGA Indigene Identification Certificate" },
              ].map((doc) => (
                <label
                  key={doc.key}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/40 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={(physicalDocs as any)[doc.key]}
                    onChange={(e) =>
                      setPhysicalDocs({
                        ...physicalDocs,
                        [doc.key]: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                    {doc.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 3: Instant POS / Cash Desk Intake Recording */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              3. Counter Payment Settlement & Fiscal Receipt
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Payment Method *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentMethod: "POS_COUNTER" })}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                      formData.paymentMethod === "POS_COUNTER"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>POS Terminal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentMethod: "CASH" })}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                      formData.paymentMethod === "CASH"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600"
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Cash Intake</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">Amount Collected (NGN) *</label>
                <input
                  type="number"
                  required
                  value={formData.paymentAmount}
                  onChange={(e) => setFormData({ ...formData, paymentAmount: Number(e.target.value) })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">
                  {formData.paymentMethod === "POS_COUNTER" ? "POS Stan / Terminal Ref" : "Cash Receipt Number"}
                </label>
                <input
                  type="text"
                  placeholder="e.g. STAN-849201"
                  value={formData.posRef}
                  onChange={(e) => setFormData({ ...formData, posRef: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="py-3.5 px-8 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2"
            >
              {isPending ? "Logging Walk-In Applicant..." : "Record Intake & Issue Thermal Receipt"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

