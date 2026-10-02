"use client";

import React from "react";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";

interface AdmitSlipClientViewProps {
  schoolName: string;
  schoolDomain: string;
  applicantName: string;
  targetGrade: string;
  tierName: string;
  parentPhone: string;
  examNo: string;
  examDate: string;
  arrivalTime: string;
  venue: string;
  subjects: string;
}

export default function AdmitSlipClientView({
  schoolName,
  schoolDomain,
  applicantName,
  targetGrade,
  tierName,
  parentPhone,
  examNo,
  examDate,
  arrivalTime,
  venue,
  subjects,
}: AdmitSlipClientViewProps) {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-8">
      {/* Top action bar - Hidden during print */}
      <div className="print:hidden mb-6 w-full max-w-2xl flex items-center justify-between gap-3">
        <Link
          href={`/${schoolDomain}`}
          className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold rounded-xl text-xs sm:text-sm hover:bg-slate-300 dark:hover:bg-zinc-700 transition flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to School Portal</span>
        </Link>
        <button
          onClick={handlePrint}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print Examination Slip</span>
        </button>
      </div>

      {/* Visual Template matching AdmissionsPipeline exactly */}
      <div className="w-full max-w-2xl bg-white border-2 border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-800 pb-4">
          <h2 className="text-2xl font-black uppercase text-slate-900">{schoolName}</h2>
          <p className="text-xs uppercase tracking-widest font-bold text-slate-500 mt-1">
            Entrance Screening &amp; Examination Admit Card
          </p>
          <span className="inline-block mt-3 font-mono font-bold text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg shadow-sm">
            Roll No: {examNo}
          </span>
        </div>

        {/* Candidate Details */}
        <div className="flex items-center gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-xs font-bold text-center shrink-0">
            <span>Affix Recent</span>
            <span>Passport Photo</span>
          </div>
          <div className="text-sm space-y-2 min-w-0">
            <p>
              <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Candidate Name</span>
              <strong className="text-slate-900 text-base md:text-lg block">{applicantName}</strong>
            </p>
            <p>
              <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Target Grade:</span>
              <strong className="text-slate-800 ml-1.5">{targetGrade}</strong> ({tierName})
            </p>
            <p>
              <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Parent Telephone:</span>
              <strong className="text-slate-800 font-mono ml-1.5">{parentPhone}</strong>
            </p>
          </div>
        </div>

        {/* Exam Schedule */}
        <div className="border border-slate-200 rounded-2xl p-5 text-sm space-y-3">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-100 pb-2">
            Screening Schedule &amp; Venue
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-slate-500 block text-xs font-medium">Test Date</span>
              <strong className="text-slate-900 text-sm sm:text-base">{examDate}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs font-medium">Arrival &amp; Accreditation</span>
              <strong className="text-slate-900 text-sm sm:text-base">{arrivalTime}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs font-medium">Examination Hall</span>
              <strong className="text-slate-900 text-sm sm:text-base">{venue}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs font-medium">Test Subjects</span>
              <strong className="text-slate-900 text-sm sm:text-base">{subjects}</strong>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-xs text-slate-600 border-t border-slate-200 pt-4 space-y-1.5 leading-relaxed">
          <p>• Candidates must arrive in neat mufti or previous school uniform with this printed slip.</p>
          <p>• Writing materials (HB Pencils, Erasers, Pens) are required. Calculators and mobile phones are strictly prohibited.</p>
        </div>
      </div>
    </div>
  );
}
