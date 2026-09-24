"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Save,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Search,
} from "lucide-react";
import { BursarContext, updateSchoolSettlementBank } from "../actions";

const NIGERIAN_BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Guaranty Trust Bank (GTBank)", code: "058" },
  { name: "Zenith Bank", code: "057" },
  { name: "United Bank for Africa (UBA)", code: "033" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Wema Bank", code: "035" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "Sterling Bank", code: "232" },
  { name: "Kuda Microfinance Bank", code: "50211" },
  { name: "Opay (Paycom)", code: "999992" },
  { name: "PalmPay", code: "999991" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "Raenest", code: "RAENEST" },
];

export function BankingDeskClient({ context }: { context: BursarContext }) {
  const [bankName, setBankName] = useState(context.settlementBankName || "Access Bank");
  const [bankCode, setBankCode] = useState("044");
  const [accountNumber, setAccountNumber] = useState(context.settlementAccountNumber || "0123456789");
  const [accountName, setAccountName] = useState(context.settlementAccountName || `${context.schoolName} - Tuition`);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ success?: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Searchable bank dropdown
  const [bankSearch, setBankSearch] = useState("");
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  const filteredBanks = NIGERIAN_BANKS.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setBankDropdownOpen(false);
        setBankSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleBankSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = NIGERIAN_BANKS.find((b) => b.name === e.target.value);
    if (selected) {
      setBankName(selected.name);
      setBankCode(selected.code);
    } else {
      setBankName(e.target.value);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (accountNumber.length !== 10) {
      setFeedback({ success: false, text: "Nigerian NUBAN accounts must be exactly 10 digits." });
      return;
    }

    startTransition(async () => {
      const res = await updateSchoolSettlementBank(
        context.schoolId,
        bankName,
        bankCode,
        accountNumber,
        accountName
      );

      if (res.success) {
        setFeedback({ success: true, text: "Settlement account successfully updated and active for parent tuition payments." });
      } else {
        setFeedback({ success: false, text: res.error || "Failed to update account." });
      }
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Direct Bank Collection Accounts
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Configure the direct institutional bank account displayed to parents and students for manual fee transfers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Live Preview Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 text-white shadow-xl border border-indigo-800/60 relative overflow-hidden space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                  Parent Payment Display
                </span>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified NUBAN</span>
              </span>
            </div>

            <div>
              <p className="text-xs text-indigo-300">Designated Receiving Bank</p>
              <h3 className="text-lg font-black text-white">{bankName}</h3>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 border border-white/15 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-indigo-200 font-bold uppercase">Account Number</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded-md hover:bg-white/20 text-indigo-200 hover:text-white transition flex items-center gap-1 text-[11px]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-emerald-300">
                {accountNumber}
              </div>
            </div>

            <div>
              <p className="text-xs text-indigo-300">Account Beneficiary Name</p>
              <p className="text-sm font-extrabold text-white">{accountName}</p>
            </div>

            <div className="pt-3 border-t border-indigo-800/80 text-[11px] text-indigo-300 leading-relaxed">
              Parents see this account when making fee deposits via mobile banking apps, USSD, or direct bank counter tellers.
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Configuration Form */}
        <div className="lg:col-span-7">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-5">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <span>Update Settlement Account Details</span>
            </h3>

            {feedback && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.success
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                }`}
              >
                {feedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{feedback.text}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Searchable Bank Dropdown */}
              <div ref={bankDropdownRef}>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Bank Name *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setBankDropdownOpen((o) => !o); setBankSearch(""); }}
                    className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between"
                  >
                    <span>{bankName}</span>
                    <span className="text-slate-400 text-xs">&#9660;</span>
                  </button>

                  {bankDropdownOpen && (
                    <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-slate-100 dark:border-zinc-700">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            autoFocus
                            type="text"
                            value={bankSearch}
                            onChange={(e) => setBankSearch(e.target.value)}
                            placeholder="Search bank name..."
                            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <ul className="max-h-52 overflow-y-auto">
                        {filteredBanks.length === 0 ? (
                          <li className="px-3 py-3 text-xs text-slate-400 text-center">No banks found.</li>
                        ) : (
                          filteredBanks.map((b) => (
                            <li
                              key={b.code}
                              onClick={() => {
                                setBankName(b.name);
                                setBankCode(b.code);
                                setBankDropdownOpen(false);
                                setBankSearch("");
                              }}
                              className={`px-3 py-2 text-xs cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition ${
                                bankName === b.name
                                  ? "bg-indigo-50 dark:bg-indigo-950/40 font-bold text-indigo-700 dark:text-indigo-300"
                                  : "text-slate-800 dark:text-zinc-200"
                              }`}
                            >
                              {b.name}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  10-Digit NUBAN Account Number *
                </label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-10 px-3 text-sm font-mono font-bold rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Account Name / Beneficiary *
                </label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Settlement Details...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Bank Settings</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
