"use client";

import React, { useState } from "react";
import { NIGERIAN_BANKS } from "@/lib/nigerian-banks";
import { updateSchoolBankDetails } from "./actions";
import {
  Building2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Copy,
  Info,
} from "lucide-react";

interface BankSettingsClientProps {
  schoolDomain: string;
  initialData: {
    name: string;
    settlementBankName: string | null;
    settlementBankCode: string | null;
    settlementAccountNumber: string | null;
    settlementAccountName: string | null;
    paymentInstruction: string | null;
    collectionMode: string | null;
  };
}

export default function BankSettingsClient({
  schoolDomain,
  initialData,
}: BankSettingsClientProps) {
  const [bankName, setBankName] = useState(initialData.settlementBankName || "");
  const [bankCode, setBankCode] = useState(initialData.settlementBankCode || "");
  const [accountNumber, setAccountNumber] = useState(initialData.settlementAccountNumber || "");
  const [accountName, setAccountName] = useState(initialData.settlementAccountName || "");
  const [paymentInstruction, setPaymentInstruction] = useState(
    initialData.paymentInstruction || "Use Student Admission No as transfer narration"
  );

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    setBankName(selectedName);
    const found = NIGERIAN_BANKS.find((b) => b.name === selectedName);
    setBankCode(found ? found.code : "");
    setErrorMsg(null);
  };

  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numeric = e.target.value.replace(/\D/g, "").slice(0, 10);
    setAccountNumber(numeric);
    setErrorMsg(null);
  };

  const handleAccountNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountName(e.target.value.toUpperCase());
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!bankName) {
      setErrorMsg("Please select your Nigerian bank.");
      setIsSaving(false);
      return;
    }

    if (accountNumber.length !== 10) {
      setErrorMsg("Account number must be exactly 10 digits.");
      setIsSaving(false);
      return;
    }

    if (!accountName.trim()) {
      setErrorMsg("Please enter the authentic account holder name.");
      setIsSaving(false);
      return;
    }

    const res = await updateSchoolBankDetails(schoolDomain, {
      bankName,
      bankCode,
      accountNumber,
      accountName,
      paymentInstruction,
    });

    setIsSaving(false);

    if (res.success) {
      setSuccessMsg("School bank account settings saved successfully!");
      setTimeout(() => setSuccessMsg(null), 5000);
    } else {
      setErrorMsg(res.error || "Failed to update bank details.");
    }
  };

  const handleCopyTest = () => {
    if (accountNumber) {
      navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner: 100% Direct Settlement Guarantee */}
      <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3.5 text-emerald-900 dark:text-emerald-100">
        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-sm">
          <h3 className="font-bold text-base text-emerald-950 dark:text-emerald-50">
            Direct Commercial Bank Settlement (0% Platform Fee)
          </h3>
          <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed text-xs sm:text-sm">
            Parents and guardians transfer tuition fees directly to this bank account using their banking apps. Funds enter your school account immediately — <strong>SchoolERP never holds or pools your money</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration Form */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">
              Configure Collection Account
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Enter your official Nigerian institutional account details where parents will make bank transfers.
            </p>
          </div>

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Nigerian Bank Dropdown */}
            <div className="space-y-1.5">
              <label htmlFor="bank-select" className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Bank Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="bank-select"
                  required
                  value={bankName}
                  onChange={handleBankChange}
                  className="flex h-11 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                >
                  <option value="">Select a Nigerian Commercial or Microfinance Bank</option>
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b.code} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. 10-Digit NUBAN Account Number */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="acc-number" className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Account Number (10 Digits) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {accountNumber.length}/10 digits
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <input
                  id="acc-number"
                  type="text"
                  required
                  maxLength={10}
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={handleAccountNumberChange}
                  placeholder="e.g. 0123456789"
                  className="flex h-11 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-10 pr-4 py-2 text-sm font-mono tracking-widest text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            </div>

            {/* 3. Account Name */}
            <div className="space-y-1.5">
              <label htmlFor="acc-name" className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Beneficiary Account Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  id="acc-name"
                  type="text"
                  required
                  value={accountName}
                  onChange={handleAccountNameChange}
                  placeholder="e.g. GREENWOOD ACADEMY OPERATING ACCOUNT"
                  className="flex h-11 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-10 pr-4 py-2 text-sm uppercase tracking-wide text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Must match the official registered name of your school bank account.
              </p>
            </div>

            {/* 4. Payment Narration Instruction */}
            <div className="space-y-1.5">
              <label htmlFor="narration" className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Transfer Narration Instruction
              </label>
              <textarea
                id="narration"
                rows={2}
                value={paymentInstruction}
                onChange={(e) => setPaymentInstruction(e.target.value)}
                placeholder="Use Student Admission No as transfer narration"
                className="flex w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
              />
              <p className="text-[11px] text-slate-400">
                Parents will be instructed to type this into their bank app transfer narration/remarks box.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full h-11 px-4 py-2 mt-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-md shadow-blue-600/20 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Account Details...</span>
                </>
              ) : (
                <span>Save School Bank Account</span>
              )}
            </button>
          </form>
        </div>

        {/* Right: Live Parent View Preview Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>Live Parent Preview</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              This is the exact payment card parents will see when paying school fees.
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white rounded-2xl p-6 shadow-xl border border-slate-800 space-y-5 relative overflow-hidden">
            {/* Background subtle glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider block">
                    {initialData.name || "School ERP"}
                  </span>
                  <span className="text-[10px] text-blue-400 font-medium block">
                    Direct Collection Account
                  </span>
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                0% Fee
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] text-slate-400 block">Bank Name</span>
                <span className="text-sm font-bold text-white">
                  {bankName || "Access Bank / GTBank"}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">Account Number</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xl font-black font-mono tracking-wider text-emerald-400">
                    {accountNumber || "0123456789"}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyTest}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">Account Name</span>
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  {accountName || "YOUR OFFICIAL SCHOOL NAME"}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-400 block">Mandatory Transfer Narration</span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {paymentInstruction || "Use Student Admission No as transfer narration"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
