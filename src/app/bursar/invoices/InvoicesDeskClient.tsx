"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Banknote,
  Calendar,
  Layers,
  X,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { BursarContext, createBursarInvoice, getBursarInvoices } from "../actions";

export function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function InvoicesDeskClient({
  context,
  initialInvoices,
  totalCount,
  classrooms,
  templates,
}: {
  context: BursarContext;
  initialInvoices: any[];
  totalCount: number;
  classrooms: string[];
  templates: Array<{ id: string; name: string; defaultAmount: number }>;
}) {
  const [invoices, setInvoices] = useState<any[]>(initialInvoices);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Create Invoice Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [billingMode, setBillingMode] = useState<"SINGLE" | "CLASS">("CLASS");
  const [targetStudentQuery, setTargetStudentQuery] = useState<string>("");
  const [targetStudentId, setTargetStudentId] = useState<string>("");
  const [targetClassroom, setTargetClassroom] = useState<string>(classrooms[0] || "");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [invoiceDescription, setInvoiceDescription] = useState<string>("1st Term Tuition Fee");
  const [invoiceAmount, setInvoiceAmount] = useState<string>("75000");
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [createMsg, setCreateMsg] = useState<{ success?: boolean; text: string } | null>(null);

  const handleFilterChange = (newStatus: string, newClass: string, newSearch: string) => {
    startTransition(async () => {
      const res = await getBursarInvoices(context.schoolId, {
        status: newStatus,
        classroom: newClass,
        search: newSearch,
      });
      if (res.success) {
        setInvoices(res.invoices);
      }
    });
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      setInvoiceDescription(tmpl.name);
      setInvoiceAmount(tmpl.defaultAmount.toString());
    }
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);

    const parsedAmount = parseFloat(invoiceAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setCreateMsg({ success: false, text: "Please enter a valid amount greater than zero." });
      return;
    }

    startTransition(async () => {
      const res = await createBursarInvoice({
        schoolId: context.schoolId,
        studentId: billingMode === "SINGLE" ? targetStudentId : undefined,
        classroomId: billingMode === "CLASS" ? targetClassroom : undefined,
        templateId: selectedTemplateId || undefined,
        description: invoiceDescription.trim(),
        amount: parsedAmount,
        dueDate: invoiceDueDate,
      });

      if (res.success) {
        setCreateMsg({
          success: true,
          text: `Success! Created ${res.createdCount || 1} invoice(s).`,
        });

        // Refresh invoices list
        const updated = await getBursarInvoices(context.schoolId, {
          status: statusFilter,
          classroom: classFilter,
          search: searchQuery,
        });
        if (updated.success) {
          setInvoices(updated.invoices);
        }

        setTimeout(() => {
          setShowCreateModal(false);
          setCreateMsg(null);
        }, 1500);
      } else {
        setCreateMsg({ success: false, text: res.error || "Failed to create invoices." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Student Invoices & Billing
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Generate termly tuition schedules, track debtor statuses, and manage student fee ledgers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Invoices</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search student, admission no, or bill..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleFilterChange(statusFilter, classFilter, e.target.value);
            }}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              handleFilterChange(e.target.value, classFilter, searchQuery);
            }}
            className="h-9 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="PENDING">Pending (Unpaid)</option>
            <option value="OVERDUE">Overdue</option>
          </select>

          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              handleFilterChange(statusFilter, e.target.value, searchQuery);
            }}
            className="h-9 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 focus:outline-none"
          >
            <option value="ALL">All Classes</option>
            {classrooms.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>

          {isPending && <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {invoices.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-zinc-500 italic text-sm space-y-2">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600" />
            <p>No invoices matching your active filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Fee Item / Description</th>
                  <th className="py-3 px-4">Amount Due</th>
                  <th className="py-3 px-4">Amount Paid</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {invoices.map((inv) => {
                  const balance = Math.max(0, inv.amountDue - inv.amountPaid);
                  const isPaid = inv.status === "PAID";
                  const isPartial = inv.status === "PARTIAL";

                  const statusBadge = isPaid
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : isPartial
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300";

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {inv.student.firstName} {inv.student.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                          {inv.student.admissionNumber} &bull; {inv.student.currentClass || "General"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-zinc-200">
                        {inv.description}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {formatNaira(inv.amountDue)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatNaira(inv.amountPaid)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatNaira(balance)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${statusBadge}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 font-mono">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isPaid && (
                          <Link
                            href={`/bursar/collect?invoiceId=${inv.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow-xs"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            <span>Collect</span>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE INVOICE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 sm:p-8 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <span>Generate Fee Invoice</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  createMsg.success
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {createMsg.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{createMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              {/* Billing Mode Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Billing Target
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingMode("CLASS")}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition ${
                      billingMode === "CLASS"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
                    }`}
                  >
                    Entire Class (Batch)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingMode("SINGLE")}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition ${
                      billingMode === "SINGLE"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
                    }`}
                  >
                    Individual Student
                  </button>
                </div>
              </div>

              {/* Class Selector if Batch */}
              {billingMode === "CLASS" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Select Target Class *
                  </label>
                  <select
                    value={targetClassroom}
                    onChange={(e) => setTargetClassroom(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  >
                    {classrooms.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Student ID or Admission Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Student UUID or Admission No"
                    value={targetStudentId}
                    onChange={(e) => setTargetStudentId(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              {/* Template Quick Select */}
              {templates.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Load from Fee Template (Optional)
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  >
                    <option value="">Custom Bill Entry</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {formatNaira(t.defaultAmount)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Invoice Description *
                </label>
                <input
                  type="text"
                  required
                  value={invoiceDescription}
                  onChange={(e) => setInvoiceDescription(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Amount & Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Amount (₦) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    className="w-full h-10 px-3 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDueDate}
                    onChange={(e) => setInvoiceDueDate(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-md transition flex items-center gap-1.5"
                >
                  {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Issue Invoices</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
