"use client";

import React, { useState } from "react";
import { X, Printer, FileText, Calendar } from "lucide-react";

interface PrintableEnrollmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolName: string;
  schoolPrefix: string;
  currentSession: string;
  availableSessions: string[];
}

export default function PrintableEnrollmentFormModal({
  isOpen,
  onClose,
  schoolName,
  schoolPrefix,
  currentSession,
  availableSessions,
}: PrintableEnrollmentFormModalProps) {
  const [session, setSession] = useState<string>(currentSession || "2026/2027");
  const [numPages, setNumPages] = useState<number>(2); // 15 students per page = 30 students

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const rowsPerPage = 15;
  const totalRows = numPages * rowsPerPage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
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
                For manual paper registration • Teachers write by hand, then Admin types into Method A
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-xs">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <label htmlFor="printable-form-session" className="text-xs font-bold text-slate-600 dark:text-zinc-300">Session:</label>
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
              <label htmlFor="printable-form-pages" className="text-xs font-bold text-slate-600 dark:text-zinc-300">Pages:</label>
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
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
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
              <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-wider">{schoolName}</h1>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Official Student Bulk Admission &amp; Intake Register
                  </h2>
                  <p className="text-[11px] text-slate-600 italic mt-0.5">
                    Instructions: Fill neatly in blue or black ballpoint pen. Each student row consists of 2 lines (Line 1: Student Info, Line 2: Guardian Info).
                  </p>
                </div>
                <div className="text-right text-xs font-bold space-y-0.5">
                  <div className="bg-slate-100 border border-black px-2 py-1 rounded">
                    <span>School Code: </span>
                    <strong className="font-mono text-sm">{schoolPrefix}</strong>
                  </div>
                  <div>Session: <strong>{session}</strong></div>
                  <div className="text-[10px] text-slate-500">Page {pageIdx + 1} of {numPages}</div>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-[10px] border-collapse border border-black">
                <thead>
                  <tr className="bg-slate-100 border-b border-black text-left font-bold">
                    <th className="border border-black p-1 text-center w-8">#</th>
                    <th className="border border-black p-1">Student / Guardian Bio-Data (Line 1: Student | Line 2: Guardian)</th>
                    <th className="border border-black p-1 w-24">Gender / Rel</th>
                    <th className="border border-black p-1 w-28">DOB / Phone</th>
                    <th className="border border-black p-1 w-28">Class &amp; Arm</th>
                    <th className="border border-black p-1 w-24">Admission Year</th>
                    <th className="border border-black p-1 w-36">Prev School / Email</th>
                    <th className="border border-black p-1 w-24 text-center">Assigned RegNo</th>
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
                          <td className="border-r border-black p-1 font-semibold text-slate-500">
                            Name: <span className="text-black font-normal">__________________________________________</span>
                          </td>
                          <td className="border-r border-black p-1">
                            Sex: [ ] M  [ ] F
                          </td>
                          <td className="border-r border-black p-1">
                            DOB: ____/____/________
                          </td>
                          <td className="border-r border-black p-1">
                            Class: ____________
                          </td>
                          <td className="border-r border-black p-1 font-bold">
                            Year: ________
                          </td>
                          <td className="border-r border-black p-1 text-[9px]">
                            Prev: __________________
                          </td>
                          <td rowSpan={2} className="border border-black p-1 text-center font-mono text-[9px] text-slate-400">
                            {schoolPrefix}/____/____
                          </td>
                        </tr>

                        {/* Line 2: Guardian Info */}
                        <tr className="border-b border-black bg-slate-50/50 h-7">
                          <td className="border-r border-black p-1 text-slate-600">
                            Parent: <span className="text-black font-normal">__________________________________________</span>
                          </td>
                          <td className="border-r border-black p-1 text-slate-600">
                            Rel: _____________
                          </td>
                          <td className="border-r border-black p-1 text-slate-600">
                            Tel: _________________
                          </td>
                          <td className="border-r border-black p-1 text-slate-600">
                            Arm: _____________
                          </td>
                          <td className="border-r border-black p-1 text-slate-600 text-[9px]">
                            COHORT (Auto)
                          </td>
                          <td className="border-r border-black p-1 text-[9px] text-slate-600">
                            Email: _________________
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer signature line */}
              <div className="mt-4 pt-3 border-t border-slate-300 flex justify-between items-center text-[10px] text-slate-700">
                <div>
                  <span>Class Teacher Name &amp; Signature: ___________________________________</span>
                </div>
                <div>
                  <span>Verified by Headmaster / Principal: ___________________________________</span>
                </div>
                <div>
                  <span>Date: ________________________</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

