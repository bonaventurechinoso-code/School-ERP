"use client";

import React, { useState } from "react";
import { X, Printer, Calendar } from "lucide-react";

interface PrintableEnrollmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolName: string;
  schoolPrefix: string;
  currentSession: string;
  availableSessions: string[];
  activeTier?: string;
}

export default function PrintableEnrollmentFormModal({
  isOpen,
  onClose,
  schoolName,
  schoolPrefix,
  currentSession,
  availableSessions,
  activeTier,
}: PrintableEnrollmentFormModalProps) {
  const [session, setSession] = useState<string>(currentSession || "2026/2027");
  const [numPages, setNumPages] = useState<number>(2); // 15 students per page = 30 students

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const rowsPerPage = 15;
  const isTertiary =
    activeTier?.toLowerCase().includes("tertiary") ||
    activeTier?.toLowerCase().includes("university") ||
    activeTier?.toLowerCase().includes("polytechnic");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header - Screen only */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 dark:bg-zinc-950/80 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Print Blank Student Enrollment Form (Landscape A4)
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Official intake sheet with parent login delivery channels &amp; credentials receipt acknowledgment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-xs">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <label htmlFor="printable-form-session" className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                Session:
              </label>
              <select
                id="printable-form-session"
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
              >
                {availableSessions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-xs">
              <label htmlFor="printable-form-pages" className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                Pages:
              </label>
              <select
                id="printable-form-pages"
                value={numPages}
                onChange={(e) => setNumPages(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
              >
                <option value={1}>1 Page (15 Students)</option>
                <option value={2}>2 Pages (30 Students)</option>
                <option value={4}>4 Pages (60 Students)</option>
                <option value={10}>10 Pages (150 Students)</option>
                <option value={20}>20 Pages (300 Students)</option>
              </select>
            </div>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Form</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-100 dark:bg-zinc-950 print:p-0 print:bg-white print:overflow-visible">
          {Array.from({ length: numPages }).map((_, pageIdx) => (
            <div
              key={pageIdx}
              className="bg-white text-black p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 print:shadow-none print:border-none print:p-4 print:mb-0 print:break-after-page"
              style={{ minHeight: "100%", width: "100%" }}
            >
              {/* Form Header */}
              <div className="border-b-2 border-black pb-3 mb-3 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-wider">{schoolName}</h1>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Official Student Bulk Admission &amp; Intake Register
                  </h2>
                  <p className="text-[11px] text-slate-700 mt-0.5">
                    <strong>Instructions:</strong> Fill neatly in blue or black ink. Each pupil entry occupies 2 lines.{" "}
                    <span className="underline font-bold">
                      {isTertiary
                        ? "Tertiary Tier: Student Phone and Student Email are REQUIRED for direct portal credentials."
                        : "K-12 Tier: Guardian Phone or Email is REQUIRED for SMS/WhatsApp parent portal login."}
                    </span>
                  </p>
                </div>
                <div className="text-right text-xs font-bold space-y-0.5 shrink-0">
                  <div className="bg-slate-100 border border-black px-2 py-1 rounded">
                    <span>School Code: </span>
                    <strong className="font-mono text-sm">{schoolPrefix}</strong>
                  </div>
                  <div>
                    Session: <strong>{session}</strong>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Page {pageIdx + 1} of {numPages}
                  </div>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-[10px] border-collapse border border-black">
                <thead>
                  <tr className="bg-slate-100 border-b border-black text-left font-bold">
                    <th className="border border-black p-1 text-center w-7">#</th>
                    <th className="border border-black p-1">
                      Line 1: Student Bio-Data
                      <br />
                      Line 2: Parent / Guardian Info
                    </th>
                    <th className="border border-black p-1 w-20">Sex / Rel</th>
                    <th className="border border-black p-1 w-32">
                      DOB
                      <br />
                      Student Phone (Tertiary Only)
                    </th>
                    <th className="border border-black p-1 w-24">Class &amp; Arm</th>
                    <th className="border border-black p-1 w-24">
                      Intake Year
                      <br />
                      (Auto Cohort)
                    </th>
                    <th className="border border-black p-1 w-36">Previous School</th>
                    <th className="border border-black p-1 w-44">
                      Guardian Phone (REQ for K-12 SMS/WhatsApp)
                      <br />
                      Guardian Email (Portal Login)
                    </th>
                    <th className="border border-black p-1 w-28 text-center bg-slate-50">
                      Assigned RegNo
                      <br />
                      <span className="text-[9px] font-normal italic">(Leave blank — System assigns)</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowsPerPage }).map((_, rIdx) => {
                    const rowNumber = pageIdx * rowsPerPage + rIdx + 1;
                    return (
                      <React.Fragment key={rIdx}>
                        {/* Line 1: Student Info */}
                        <tr className="border-t border-black bg-white h-7">
                          <td rowSpan={2} className="border border-black p-1 text-center font-bold text-xs">
                            {rowNumber}
                          </td>
                          <td className="border-r border-black p-1 font-semibold text-slate-600">
                            Student Name:{" "}
                            <span className="text-black font-normal">_____________________________________</span>
                          </td>
                          <td className="border-r border-black p-1">Sex: [ ] M [ ] F</td>
                          <td className="border-r border-black p-1">DOB: ____/____/________</td>
                          <td className="border-r border-black p-1 font-semibold">Class: ____________</td>
                          <td className="border-r border-black p-1 font-bold">Year: {session.split("/")[0]}</td>
                          <td className="border-r border-black p-1 text-[9px]">
                            Prev: ______________________
                          </td>
                          <td className="border-r border-black p-1 text-[9px] text-slate-700">
                            Parent Phone: __________________
                          </td>
                          <td
                            rowSpan={2}
                            className="border border-black p-1 text-center font-mono text-[9px] bg-slate-50 text-slate-500"
                          >
                            <span className="block font-bold text-slate-900">{schoolPrefix}/...</span>
                            <span className="text-[8px] text-slate-400">System Assigned</span>
                          </td>
                        </tr>

                        {/* Line 2: Guardian Info */}
                        <tr className="border-b border-black bg-slate-50/40 h-7">
                          <td className="border-r border-black p-1 text-slate-700">
                            Parent/Guardian:{" "}
                            <span className="text-black font-normal">_____________________________________</span>
                          </td>
                          <td className="border-r border-black p-1 text-slate-700">Rel: _____________</td>
                          <td className="border-r border-black p-1 text-slate-700 text-[9px]">
                            Stu Phone: _________________
                          </td>
                          <td className="border-r border-black p-1 text-slate-700">Arm: _____________</td>
                          <td className="border-r border-black p-1 text-[9px] text-slate-500 font-mono">
                            COHORT (Auto)
                          </td>
                          <td className="border-r border-black p-1 text-[9px] text-slate-500">
                            Prev Cert: [ ] Yes [ ] No
                          </td>
                          <td className="border-r border-black p-1 text-[9px] text-slate-700">
                            Parent Email: __________________
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* Official Credentials Notice */}
              <div className="mt-3 p-2 border border-slate-400 rounded bg-slate-50 text-[10px] text-slate-800 leading-snug">
                <span className="font-bold">★ CREDENTIALS NOTICE &amp; DELIVERY POLICY: </span>
                No pupil is officially enrolled until login credentials are confirmed. In Creche, Primary, and Secondary
                schools, login credentials belong to the Parent/Guardian. The parent receives their Admission No / Username
                and Temporary Password via SMS/WhatsApp or printed credentials sheet. In Tertiary institutions, credentials
                are issued directly to the student.
              </div>

              {/* Footer Signatures */}
              <div className="mt-3 pt-2 border-t border-slate-300 grid grid-cols-3 gap-4 text-[10px] text-slate-800">
                <div className="border border-slate-300 p-2 rounded">
                  <div className="font-bold text-slate-900 mb-1">Class Teacher / Intake Officer</div>
                  <div className="mt-4">Signature: __________________________</div>
                  <div className="mt-1">Date: ________________________</div>
                </div>

                <div className="border border-slate-300 p-2 rounded">
                  <div className="font-bold text-slate-900 mb-1">Headmaster / Principal / Registrar</div>
                  <div className="mt-4">Signature: __________________________</div>
                  <div className="mt-1">Date: ________________________</div>
                </div>

                <div className="border border-slate-300 p-2 rounded bg-amber-50/50 border-amber-300">
                  <div className="font-bold text-slate-900 mb-1">Parent / Guardian Signature</div>
                  <div className="text-[9px] text-slate-600 mb-1">I confirm receiving login credentials / SMS instructions:</div>
                  <div className="mt-2">Signature: __________________________</div>
                  <div className="mt-1">Date: ________________________</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
