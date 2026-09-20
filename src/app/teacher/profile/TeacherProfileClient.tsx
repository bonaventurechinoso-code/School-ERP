"use client";

import React, { useState, useTransition } from "react";
import {
  UserCheck,
  Building2,
  Mail,
  CreditCard,
  BookOpen,
  Calendar,
  Save,
  CheckCircle2,
  Shield,
  FileText,
} from "lucide-react";
import { updateTeacherProfile } from "../actions";

interface ProfileData {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  department?: string;
  status?: string;
  bankName: string;
  bankAccountNumber: string;
  accountName: string;
  assignedClasses: string[];
  assignedSubjects: string[];
  createdAt?: string;
}

interface PayslipItem {
  id: string;
  amount: number;
  status: string;
  payDate: string;
}

interface TeacherProfileClientProps {
  profile: ProfileData;
  recentPayslips: PayslipItem[];
  schoolName: string;
}

export function TeacherProfileClient({
  profile,
  recentPayslips,
  schoolName,
}: TeacherProfileClientProps) {
  const [firstName, setFirstName] = useState(profile.firstName || "");
  const [lastName, setLastName] = useState(profile.lastName || "");
  const [isPending, startTransition] = useTransition();
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateMsg(null);
    startTransition(async () => {
      try {
        await updateTeacherProfile({ firstName, lastName });
        setUpdateMsg("Profile details updated successfully.");
        setTimeout(() => setUpdateMsg(null), 4000);
      } catch (err: any) {
        setUpdateMsg(`Update failed: ${err.message}`);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-1">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Faculty File Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Teacher Profile & Credentials
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Institutional records, assigned curriculum streams, and remuneration details.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-xs font-bold">
          <Shield className="w-3.5 h-3.5" />
          <span>Status: {profile.status || "ACTIVE"}</span>
        </div>
      </div>

      {updateMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{updateMsg}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal File & Edit Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit Form Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              Personal Identification
            </h3>

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Faculty Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={profile.email || ""}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Academic Designation
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile.role || "Class Teacher"}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isPending ? "Saving..." : "Update File"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Assigned Classes & Subjects */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              Curriculum Allocations
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700/60 space-y-2">
                <p className="font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">
                  Assigned Homeroom & Classes
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.assignedClasses.map((cls) => (
                    <span
                      key={cls}
                      className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800/60"
                    >
                      {cls}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700/60 space-y-2">
                <p className="font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">
                  Assigned Subject Disciplines
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.assignedSubjects.map((sub) => (
                    <span
                      key={sub}
                      className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold border border-blue-200/60 dark:border-blue-800/60"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Remuneration & Payslips */}
        <div className="space-y-6">
          {/* Remuneration Banking Profile */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                Remuneration Details
              </h3>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-zinc-900 text-white space-y-3 shadow-md">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  Beneficiary Institution
                </p>
                <p className="font-bold text-sm">{profile.bankName}</p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Account Number
                  </p>
                  <p className="font-mono font-bold text-sm tracking-widest">
                    {profile.bankAccountNumber}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  Verified
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Direct payroll disbursement managed by School Bursary.
            </p>
          </div>

          {/* Recent Payslips */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Recent Remuneration Records
              </h3>
              <FileText className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-2.5">
              {recentPayslips.length > 0 ? (
                recentPayslips.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        ₦{(pay.amount || 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {pay.payDate}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                      {pay.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No previous salary disbursements on record.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
