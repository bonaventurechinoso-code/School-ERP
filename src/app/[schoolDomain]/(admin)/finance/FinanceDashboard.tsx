"use client";

import React, { useState } from "react";
import { Invoice, Payment, Student, FeeTemplate, Transaction } from "@prisma/client";
import { useTenant } from "@/lib/tenant-context";
import { apiClient } from "@/lib/api-client";
import { 
  FileText, 
  CreditCard, 
  TrendingDown, 
  Wallet, 
  AlertCircle, 
  PlusCircle, 
  Layers, 
  ArrowUpRight,
  ArrowDownRight,
  Bot,
  Send,
  RefreshCw,
  X
} from "lucide-react";
import InvoiceTable from "./InvoiceTable";
import FeeTemplatesList from "./FeeTemplatesList";
import LedgerTable from "./LedgerTable";
import { useActiveTierConfig } from "@/lib/tier-config";

export function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type InvoiceWithDetails = Invoice & {
  student: Student;
  payments: Payment[];
};

export default function FinanceDashboard({
  hasHigherEd,
  activeTier,
  invoices,
  students,
  classrooms = [],
  feeTemplates,
  transactions,
  schoolId,
  totalInvoiced,
  totalPaid,
  totalExpenses,
  outstandingBalance,
}: {
  hasHigherEd: boolean;
  activeTier?: string;
  invoices: InvoiceWithDetails[];
  students: (Student & { currentClass?: string | null })[];
  classrooms?: string[];
  feeTemplates: FeeTemplate[];
  transactions: Transaction[];
  schoolId: string;
  totalInvoiced: number;
  totalPaid: number;
  totalExpenses: number;
  outstandingBalance: number;
}) {
  const tenant = useTenant();
  const { tierConfig, filterClasses, filterInvoices, filterFeeTemplates, filterStudents } = useActiveTierConfig(activeTier);

  // Isolate lists by the active tier context
  const tierInvoices = React.useMemo(() => filterInvoices(invoices), [invoices, filterInvoices]);
  const tierTemplates = React.useMemo(() => filterFeeTemplates(feeTemplates), [feeTemplates, filterFeeTemplates]);
  const tierStudents = React.useMemo(() => filterStudents(students), [students, filterStudents]);
  const tierClassrooms = React.useMemo(() => classrooms ? filterClasses(classrooms) : [], [classrooms, filterClasses]);

  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "templates" | "ledger">("overview");

  // Institutional AI Input State (Rule 3)
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiFallbackAlert, setAiFallbackAlert] = useState<string | null>(null);

  const handleAiQuerySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = aiInput.trim();
    if (!prompt) {
      setAiFallbackAlert("Please enter a query before asking Institutional AI.");
      return;
    }

    setIsAiLoading(true);
    setAiFallbackAlert(null);

    try {
      // Forward input strings to AI router stream via client interceptor
      const res = await apiClient.post("/api/v1/admin/ai-query", { prompt });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `AI stream error: ${res.status}`);
      }

      const data = await res.json();
      const feedback = data?.response;

      // Safely catch empty/null feedback states with fallback UI alert
      if (!feedback || typeof feedback !== "string" || !feedback.trim()) {
        setAiFallbackAlert("Institutional AI router returned empty feedback. Please rephrase or query specific metrics like student enrollment or fees.");
        setAiResponse(null);
      } else {
        setAiResponse(feedback);
        setAiFallbackAlert(null);
      }
    } catch (err: any) {
      console.error("[Institutional AI Error]:", err);
      setAiFallbackAlert(err.message || "Failed to communicate with Institutional AI router stream.");
      setAiResponse(null);
    } finally {
      setIsAiLoading(false);
    }
  };

  const netCashFlow = totalPaid - totalExpenses;
  const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex overflow-x-auto whitespace-nowrap hide-scrollbar border-b border-slate-200 dark:border-zinc-800 gap-4 sm:gap-6 pb-0">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors ${
            activeTab === "overview" 
              ? "border-b-2 text-slate-900 dark:text-white" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
          }`}
          style={{ borderBottomColor: activeTab === "overview" ? tenant.branding.primaryColor : "transparent" }}
        >
          Overview & Metrics
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={`pb-3 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors ${
            activeTab === "invoices" 
              ? "border-b-2 text-slate-900 dark:text-white" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
          }`}
          style={{ borderBottomColor: activeTab === "invoices" ? tenant.branding.primaryColor : "transparent" }}
        >
          Invoices & Payments ({tierInvoices.length})
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-3 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors ${
            activeTab === "templates" 
              ? "border-b-2 text-slate-900 dark:text-white" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
          }`}
          style={{ borderBottomColor: activeTab === "templates" ? tenant.branding.primaryColor : "transparent" }}
        >
          Fee Templates ({tierTemplates.length})
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`pb-3 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors ${
            activeTab === "ledger" 
              ? "border-b-2 text-slate-900 dark:text-white" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
          }`}
          style={{ borderBottomColor: activeTab === "ledger" ? tenant.branding.primaryColor : "transparent" }}
        >
          General Ledger & Expenses ({transactions.length})
        </button>
      </div>

      {/* Content */}
      <div className="pt-2">
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Quick Action Shortcuts */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Quick Actions:</span>
                <span className="text-xs text-slate-600 dark:text-zinc-300 font-medium hidden sm:inline">
                  Collection Efficiency: <strong className="text-emerald-600 dark:text-emerald-400">{collectionRate}%</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("invoices")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Issue Invoice</span>
                </button>
                <button
                  onClick={() => setActiveTab("ledger")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Record Expense</span>
                </button>
                <button
                  onClick={() => setActiveTab("templates")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Fee Schedules</span>
                </button>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {/* Total Invoiced */}
              <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-blue-500">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Total Invoiced</h3>
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate font-mono">
                  {formatNaira(totalInvoiced)}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                  {invoices.length} billing items generated
                </p>
              </div>

              {/* Total Collected */}
              <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-emerald-500">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Total Collected</h3>
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 truncate font-mono">
                  {formatNaira(totalPaid)}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 mt-2 font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>{collectionRate}% of total receivables collected</span>
                </div>
              </div>

              {/* Total Expenses */}
              <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-rose-500">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Institutional Expenses</h3>
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                </div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate font-mono">
                  {formatNaira(totalExpenses)}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                  Operational & payroll disbursements
                </p>
              </div>

              {/* Net Cash Flow / Ledger Balance */}
              <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-indigo-500">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Net Cash Position</h3>
                  <Wallet className="w-4 h-4 text-indigo-500" />
                </div>
                <p className={`text-2xl sm:text-3xl font-black truncate font-mono ${netCashFlow >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600 dark:text-rose-400"}`}>
                  {formatNaira(netCashFlow)}
                </p>
                <div className="flex items-center gap-1.5 text-xs mt-2 font-medium">
                  {netCashFlow >= 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Positive Net Operating Cash
                    </span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5" /> Deficit: Expenses exceed cash receipts
                    </span>
                  )}
                </div>
              </div>

              {/* Outstanding Receivables */}
              <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-amber-500 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Outstanding Receivables</h3>
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                </div>
                <p className={`text-2xl sm:text-3xl font-black truncate font-mono ${outstandingBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>
                  {formatNaira(outstandingBalance)}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                  {outstandingBalance > 0 ? "Unpaid or partially settled student bills" : "All invoiced fees fully cleared"}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="animate-in fade-in duration-300">
            <InvoiceTable 
              activeTier={activeTier}
              invoices={tierInvoices} 
              students={tierStudents} 
              feeTemplates={tierTemplates}
              schoolId={schoolId} 
            />
          </div>
        )}

        {activeTab === "templates" && (
          <div className="animate-in fade-in duration-300">
            <FeeTemplatesList 
              hasHigherEd={hasHigherEd}
              activeTier={activeTier}
              feeTemplates={tierTemplates}
              students={tierStudents}
              classrooms={tierClassrooms}
              schoolId={schoolId} 
            />
          </div>
        )}

        {activeTab === "ledger" && (
          <div className="animate-in fade-in duration-300">
            <LedgerTable 
              transactions={transactions} 
              schoolId={schoolId}
            />
          </div>
        )}
      </div>

      {/* Ask Institutional AI Entry Form at Bottom (Rule 3) */}
      <div className="bg-slate-900 dark:bg-black text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Ask Institutional AI</h4>
              <p className="text-xs text-slate-400">Institutional analytical assistant for enrollment, fee collections, and cash flow</p>
            </div>
          </div>
          {isAiLoading && (
            <span className="text-xs text-blue-400 flex items-center gap-1.5 self-start sm:self-auto font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Querying AI router stream...</span>
            </span>
          )}
        </div>

        {/* Fallback UI Alert for Empty/Null Feedback States */}
        {aiFallbackAlert && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">{aiFallbackAlert}</div>
            <button
              type="button"
              onClick={() => setAiFallbackAlert(null)}
              className="text-amber-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* AI Response Output Card */}
        {aiResponse && (
          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/80 text-xs sm:text-sm text-slate-100 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs text-blue-400 font-semibold uppercase tracking-wider">
              <span>Institutional AI Feedback</span>
              <button
                type="button"
                onClick={() => setAiResponse(null)}
                className="text-slate-400 hover:text-white cursor-pointer text-xs"
              >
                Clear
              </button>
            </div>
            <p className="leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
          </div>
        )}

        {/* AI Input Form */}
        <form onSubmit={handleAiQuerySubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Ask anything about fees, collections, student counts, or institutional ledger..."
            value={aiInput}
            onChange={(e) => {
              setAiInput(e.target.value);
              if (aiFallbackAlert) setAiFallbackAlert(null);
            }}
            disabled={isAiLoading}
            className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isAiLoading || !aiInput.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>
        </form>
      </div>
    </div>
  );
}

