"use client";

import React, { useState, useTransition } from "react";
import {
  FileBarChart,
  Download,
  Filter,
  AlertCircle,
  Phone,
  Mail,
  RefreshCw,
  Search,
  Banknote,
  Calendar,
  Users,
} from "lucide-react";
import { BursarContext, getBursarDefaultersReport } from "../actions";

export function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ReportsDeskClient({
  context,
  initialDefaulters,
  totalOutstanding,
  count,
  classrooms,
}: {
  context: BursarContext;
  initialDefaulters: any[];
  totalOutstanding: number;
  count: number;
  classrooms: string[];
}) {
  const [defaulters, setDefaulters] = useState<any[]>(initialDefaulters);
  const [currentTotal, setCurrentTotal] = useState<number>(totalOutstanding);
  const [currentCount, setCurrentCount] = useState<number>(count);
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [minDebt, setMinDebt] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = (newClass: string, newMinDebt: number) => {
    startTransition(async () => {
      const res = await getBursarDefaultersReport(context.schoolId, {
        classroom: newClass,
        minDebt: newMinDebt,
      });
      if (res.success) {
        setDefaulters(res.defaulters);
        setCurrentTotal(res.totalOutstanding);
        setCurrentCount(res.count);
      }
    });
  };

  const filteredDefaulters = defaulters.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.studentName.toLowerCase().includes(q) ||
      d.admissionNumber.toLowerCase().includes(q) ||
      d.currentClass.toLowerCase().includes(q)
    );
  });

  const handleExportCSV = () => {
    const headers = [
      "Student Name",
      "Admission Number",
      "Class",
      "Guardian Phone",
      "Guardian Email",
      "Total Due (NGN)",
      "Total Paid (NGN)",
      "Outstanding Balance (NGN)",
      "Unpaid Invoices Count",
      "Oldest Due Date",
    ];

    const rows = filteredDefaulters.map((d) => [
      `"${d.studentName}"`,
      `"${d.admissionNumber}"`,
      `"${d.currentClass}"`,
      `"${d.parentPhone || "N/A"}"`,
      `"${d.parentEmail || "N/A"}"`,
      d.totalDue,
      d.totalPaid,
      d.balance,
      d.unpaidInvoicesCount,
      `"${new Date(d.oldestDueDate).toLocaleDateString()}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `defaulters-report-${context.schoolSubdomain}-${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Defaulters &amp; Debtors Audit
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Audit student tuition debt, track overdue accounts, and generate CSV reports for administration.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={filteredDefaulters.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Defaulters CSV</span>
        </button>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Debt Outstanding
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {formatNaira(currentTotal)}
          </div>
          <p className="text-[11px] text-slate-400">Aggregated unpaid tuition</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Debtor Students
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {currentCount} Students
          </div>
          <p className="text-[11px] text-slate-400">With overdue/pending balances</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Average Debt per Student
          </span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {formatNaira(currentCount > 0 ? Math.round(currentTotal / currentCount) : 0)}
          </div>
          <p className="text-[11px] text-slate-400">Mean liability per debtor</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search debtor name, class or admission..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Class Filter */}
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              handleFilterChange(e.target.value, minDebt);
            }}
            className="h-9 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 focus:outline-none"
          >
            <option value="ALL">All Classes</option>
            {classrooms.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Min Debt Filter */}
          <select
            value={minDebt}
            onChange={(e) => {
              const val = Number(e.target.value);
              setMinDebt(val);
              handleFilterChange(selectedClass, val);
            }}
            className="h-9 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 focus:outline-none"
          >
            <option value={0}>Any Debt (&gt; ₦0)</option>
            <option value={20000}>Above ₦20,000</option>
            <option value={50000}>Above ₦50,000</option>
            <option value={100000}>Above ₦100,000</option>
          </select>

          {isPending && <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />}
        </div>
      </div>

      {/* Defaulters Table */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {filteredDefaulters.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-zinc-500 italic text-sm space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600" />
            <p>No defaulting accounts found matching your filter criteria!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Guardian Contact</th>
                  <th className="py-3 px-4">Total Billed</th>
                  <th className="py-3 px-4">Amount Paid</th>
                  <th className="py-3 px-4">Outstanding Balance</th>
                  <th className="py-3 px-4">Unpaid Bills</th>
                  <th className="py-3 px-4">Oldest Due Date</th>
                  <th className="py-3 px-4 text-right">Collect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {filteredDefaulters.map((d) => (
                  <tr
                    key={d.studentId}
                    className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {d.studentName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                        {d.admissionNumber} &bull; {d.currentClass}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                      {d.parentPhone ? (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{d.parentPhone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No phone on file</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-zinc-200">
                      {formatNaira(d.totalDue)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNaira(d.totalPaid)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-rose-600 dark:text-rose-400">
                      {formatNaira(d.balance)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                        {d.unpaidInvoicesCount} {d.unpaidInvoicesCount === 1 ? "Bill" : "Bills"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-zinc-400">
                      {new Date(d.oldestDueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={`/bursar/collect?studentId=${d.studentId}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow-xs"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Collect</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
