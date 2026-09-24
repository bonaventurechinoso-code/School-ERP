"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Landmark,
  ShieldCheck,
  TrendingUp,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowRight,
  Sparkles,
  CreditCard,
  PlusCircle,
  Clock,
  Search,
  Check,
  Copy,
} from "lucide-react";
import { NIGERIAN_BANKS, getBankByCode, isValidNubanAccountNumber } from "@/lib/nigerian-banks";
import { formatCurrency } from "@/lib/format-utils";
import {
  updatePlatformCorporateBankAction,
  verifyTenantManualSubscriptionAction,
  recordManualPlatformDepositAction,
  PlatformBankConfigData,
} from "./actions";

export interface BankModuleTenant {
  id: string;
  schoolName: string;
  subdomain: string;
  status: string;
  planName: string;
  planPrice: number;
  billingCycle: string;
  nextRenewalDate: string | null;
  adminEmail: string;
}

export interface BankModuleTransaction {
  id: string;
  type: string;
  amount: number;
  reference: string;
  createdAt: string;
  tenantName?: string;
}

export default function BankModuleClient({
  initialPlatformBank,
  wallet,
  estimatedMrr,
  tenants,
  recentTransactions,
}: {
  initialPlatformBank: PlatformBankConfigData;
  wallet: { balance: number; totalRevenue: number };
  estimatedMrr: number;
  tenants: BankModuleTenant[];
  recentTransactions: BankModuleTransaction[];
}) {
  const [platformBank, setPlatformBank] = useState<PlatformBankConfigData>(initialPlatformBank);
  const [selectedBankCode, setSelectedBankCode] = useState(initialPlatformBank.bankCode || "035");
  const [accountNumber, setAccountNumber] = useState(initialPlatformBank.accountNumber || "0123456789");
  const [accountName, setAccountName] = useState(initialPlatformBank.accountName || "BonaVee ICT Corporate");

  // Searchable bank dropdown state
  const [bankSearch, setBankSearch] = useState("");
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  const filteredBanks = NIGERIAN_BANKS.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );
  const selectedBankName = NIGERIAN_BANKS.find((b) => b.code === selectedBankCode)?.name ?? "Select bank...";

  // Close bank dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setBankDropdownOpen(false);
        setBankSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isSavingBank, startSavingBank] = useTransition();
  const [isProcessingSub, startProcessingSub] = useTransition();
  const [isProcessingDeposit, startProcessingDeposit] = useTransition();

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Verification Modal State
  const [verifyModal, setVerifyModal] = useState<{
    isOpen: boolean;
    tenant: BankModuleTenant | null;
    amountPaid: number;
    durationDays: number;
    reference: string;
  }>({
    isOpen: false,
    tenant: null,
    amountPaid: 0,
    durationDays: 30,
    reference: "",
  });

  // Manual Deposit Modal State
  const [depositModal, setDepositModal] = useState<{
    isOpen: boolean;
    amount: number;
    reference: string;
    narration: string;
  }>({
    isOpen: false,
    amount: 50000,
    reference: "",
    narration: "",
  });

  const showToast = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleCopyAccount = () => {
    if (!platformBank.accountNumber) return;
    navigator.clipboard.writeText(platformBank.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidNubanAccountNumber(accountNumber)) {
      showToast("error", "Account number must be exactly 10 digits.");
      return;
    }

    startSavingBank(async () => {
      const res = await updatePlatformCorporateBankAction(
        selectedBankCode,
        accountNumber,
        accountName
      );
      if (res.success && res.platformBank) {
        setPlatformBank(res.platformBank);
        showToast("success", res.message || "Platform corporate bank account updated.");
      } else {
        showToast("error", res.error || "Failed to update corporate bank account.");
      }
    });
  };

  const handleOpenVerifyModal = (tenant: BankModuleTenant) => {
    setVerifyModal({
      isOpen: true,
      tenant,
      amountPaid: tenant.planPrice || 25000,
      durationDays: tenant.billingCycle === "yearly" ? 365 : tenant.billingCycle === "termly" ? 90 : 30,
      reference: `MANUAL-${tenant.subdomain.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    });
  };

  const handleConfirmVerification = () => {
    if (!verifyModal.tenant) return;
    startProcessingSub(async () => {
      const res = await verifyTenantManualSubscriptionAction({
        tenantId: verifyModal.tenant!.id,
        amountPaid: verifyModal.amountPaid,
        durationDays: verifyModal.durationDays,
        reference: verifyModal.reference,
      });

      if (res.success) {
        showToast("success", res.message || "Subscription successfully verified.");
        setVerifyModal({ isOpen: false, tenant: null, amountPaid: 0, durationDays: 30, reference: "" });
      } else {
        showToast("error", res.error || "Failed to verify subscription.");
      }
    });
  };

  const handleConfirmDeposit = () => {
    if (depositModal.amount <= 0) {
      showToast("error", "Please specify a positive deposit amount.");
      return;
    }

    startProcessingDeposit(async () => {
      const res = await recordManualPlatformDepositAction({
        amount: depositModal.amount,
        reference: depositModal.reference,
        narration: depositModal.narration,
      });

      if (res.success) {
        showToast("success", res.message || "Deposit successfully recorded.");
        setDepositModal({ isOpen: false, amount: 50000, reference: "", narration: "" });
      } else {
        showToast("error", res.error || "Failed to record deposit.");
      }
    });
  };

  // Filter Tenants
  const filteredTenants = tenants.filter((t) => {
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      t.schoolName.toLowerCase().includes(q) ||
      t.subdomain.toLowerCase().includes(q) ||
      t.adminEmail.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl border backdrop-blur-md flex items-center gap-3 transition-all duration-300 ${
            feedback.type === "success"
              ? "bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50/95 dark:bg-rose-950/90 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm font-medium">{feedback.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Bank
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Corporate Banking &amp; Subscription Management
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Bank &amp; Subscription Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Configure the platform corporate bank account, verify school subscription payments, and record incoming deposits.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setDepositModal({ isOpen: true, amount: 50000, reference: "", narration: "" })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            Record Deposit
          </button>
        </div>
      </div>

      {/* Platform Info Banner */}
      <div className="p-4 sm:p-5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-zinc-900 shadow-xs flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200">
            Manual Subscription Platform
          </span>
          <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-zinc-300 leading-relaxed">
            Schools pay their software subscriptions manually via bank transfer. Each payment is verified here and the subscription is activated or extended instantly.
          </p>
        </div>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Platform Revenue */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Platform Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {formatCurrency(wallet.totalRevenue)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cumulative manual SaaS receipts</p>
        </div>

        {/* Corporate Account Balance */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Corporate Account Balance
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {formatCurrency(wallet.balance)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Direct corporate platform balance</p>
        </div>

        {/* Estimated MRR */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Estimated MRR
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {formatCurrency(estimatedMrr)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            ARR: <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatCurrency(estimatedMrr * 12)}</span>
          </p>
        </div>

        {/* Billing Model */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Billing Model
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
            Manual
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            Bank transfer · verified by admin
          </p>
        </div>
      </div>

      {/* SECTION 1: SUPER ADMIN PLATFORM SUBSCRIPTION CORPORATE ACCOUNT CONFIGURATION */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Platform Subscription Corporate Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                The bank account where schools send their subscription payments. Update or change these details any time.
              </p>
            </div>
          </div>

          {/* Active Configuration Snapshot */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
            <span className="text-slate-500 dark:text-zinc-400 font-medium">Active Account:</span>
            <span className="font-bold text-slate-800 dark:text-zinc-100">
              {platformBank.bankName || "Wema Bank"}
            </span>
            <span className="text-slate-400 dark:text-zinc-600">•</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {platformBank.accountNumber || "0123456789"}
            </span>
            <button
              onClick={handleCopyAccount}
              className="ml-1 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 transition"
              title="Copy account number"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSaveBank} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Searchable Bank Selection */}
            <div className="md:col-span-5 space-y-1.5" ref={bankDropdownRef}>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Settlement Bank
              </label>
              <div className="relative">
                {/* Trigger button showing selected bank */}
                <button
                  type="button"
                  onClick={() => { setBankDropdownOpen((o) => !o); setBankSearch(""); }}
                  className="w-full text-xs font-semibold py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-left flex items-center justify-between"
                >
                  <span>{selectedBankName}</span>
                  <span className="text-slate-400 text-xs">▼</span>
                </button>

                {/* Dropdown panel */}
                {bankDropdownOpen && (
                  <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-100 dark:border-zinc-800">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          autoFocus
                          type="text"
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                          placeholder="Search bank name..."
                          className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    {/* Filtered list */}
                    <ul className="max-h-52 overflow-y-auto">
                      {filteredBanks.length === 0 ? (
                        <li className="px-3 py-3 text-xs text-slate-400 text-center">No banks found.</li>
                      ) : (
                        filteredBanks.map((bank) => (
                          <li
                            key={bank.code}
                            onClick={() => {
                              setSelectedBankCode(bank.code);
                              setBankDropdownOpen(false);
                              setBankSearch("");
                            }}
                            className={`px-3 py-2 text-xs cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition ${
                              selectedBankCode === bank.code
                                ? "bg-indigo-50 dark:bg-indigo-950/40 font-bold text-indigo-700 dark:text-indigo-300"
                                : "text-slate-800 dark:text-zinc-200"
                            }`}
                          >
                            {bank.name}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Account Number Input (Strict 10-digit validation) */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                10-Digit Account Number
              </label>
              <input
                type="text"
                maxLength={10}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="0123456789"
                className="w-full text-xs font-mono font-semibold py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                required
              />
            </div>

            {/* Account Name */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Account Holder Name
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="BonaVee ICT Corporate"
                className="w-full text-xs font-semibold py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-slate-400">
              * Supports all Nigerian commercial banks, microfinance banks, and digital institutions (including Raenest, Moniepoint, Wema, etc.).
            </p>
            <button
              type="submit"
              disabled={isSavingBank}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50"
            >
              <Landmark className="w-3.5 h-3.5" />
              {isSavingBank ? "Updating Corporate Account..." : "Save Corporate Bank Account"}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: MANUAL SUBSCRIPTION PROCESSING STATION */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              Tenant Subscriptions
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Review and verify bank transfer payments from schools to activate or extend their subscriptions.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search school name..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        {/* Tenants Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">Tenant School</th>
                <th className="px-4 py-3">Subdomain</th>
                <th className="px-4 py-3">Plan / Tier</th>
                <th className="px-4 py-3">Subscription Fee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs">
                    No matching tenants found.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition">
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                      {t.schoolName}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                      {t.subdomain}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-800 dark:text-zinc-200">
                        {t.planName}
                      </span>
                      <span className="text-[10px] text-slate-400 block uppercase">
                        {t.billingCycle}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                      {formatCurrency(t.planPrice)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                        }`}
                      >
                        {t.status}
                      </span>
                      {t.nextRenewalDate && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Renews: {new Date(t.nextRenewalDate).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenVerifyModal(t)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verify Manual Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: RECENT VERIFIED TRANSACTIONS LEDGER */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          Recent Deposits
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400 text-xs">
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-white">
                      {tx.reference}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-600 dark:text-zinc-400">
                      {tx.type}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: VERIFY MANUAL PAYMENT */}
      {verifyModal.isOpen && verifyModal.tenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Verify Manual Subscription Payment
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {verifyModal.tenant.schoolName} ({verifyModal.tenant.subdomain})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVerifyModal({ isOpen: false, tenant: null, amountPaid: 0, durationDays: 30, reference: "" })}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Amount Paid (NGN)
                </label>
                <input
                  type="number"
                  value={verifyModal.amountPaid}
                  onChange={(e) => setVerifyModal((prev) => ({ ...prev, amountPaid: Number(e.target.value) }))}
                  className="w-full text-sm font-bold py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Extension Duration
                </label>
                <select
                  value={verifyModal.durationDays}
                  onChange={(e) => setVerifyModal((prev) => ({ ...prev, durationDays: Number(e.target.value) }))}
                  className="w-full text-xs font-semibold py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none"
                >
                  <option value={30}>1 Month (30 Days)</option>
                  <option value={90}>1 Term (90 Days)</option>
                  <option value={365}>1 Full Year (365 Days)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Payment Reference / Narration
                </label>
                <input
                  type="text"
                  value={verifyModal.reference}
                  onChange={(e) => setVerifyModal((prev) => ({ ...prev, reference: e.target.value }))}
                  className="w-full text-xs font-mono py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              {/* Zero-Fee Settlement Calculation Breakdown */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Gross Transfer Amount:</span>
                  <span className="font-bold text-slate-900 dark:text-zinc-100">{formatCurrency(verifyModal.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Processing Fee (0% policy):</span>
                  <span>₦0.00</span>
                </div>
                <div className="border-t border-slate-200 dark:border-zinc-800 pt-2 flex justify-between font-black text-sm text-slate-900 dark:text-white">
                  <span>Net Credited to Corporate Balance:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(verifyModal.amountPaid)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setVerifyModal({ isOpen: false, tenant: null, amountPaid: 0, durationDays: 30, reference: "" })}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingSub}
                onClick={handleConfirmVerification}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50"
              >
                {isProcessingSub ? "Verifying..." : "Confirm & Activate Subscription"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECORD MANUAL DIRECT DEPOSIT */}
      {depositModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Record Corporate Account Bank Deposit
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Direct manual credit into {platformBank.bankName} ({platformBank.accountNumber})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDepositModal({ isOpen: false, amount: 50000, reference: "", narration: "" })}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Deposit Amount (NGN)
                </label>
                <input
                  type="number"
                  value={depositModal.amount}
                  onChange={(e) => setDepositModal((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  className="w-full text-sm font-bold py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Deposit Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. CBN-NIP-992381283"
                  value={depositModal.reference}
                  onChange={(e) => setDepositModal((prev) => ({ ...prev, reference: e.target.value }))}
                  className="w-full text-xs font-mono py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Narration / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Quarterly SaaS subscription settlement"
                  value={depositModal.narration}
                  onChange={(e) => setDepositModal((prev) => ({ ...prev, narration: e.target.value }))}
                  className="w-full text-xs py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
                The full amount will be added to the platform corporate balance.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDepositModal({ isOpen: false, amount: 50000, reference: "", narration: "" })}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingDeposit}
                onClick={handleConfirmDeposit}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50"
              >
                {isProcessingDeposit ? "Recording..." : "Record Deposit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
