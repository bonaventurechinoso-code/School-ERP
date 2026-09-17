"use client";

import React, { useState, useMemo, useTransition } from "react";
import { Invoice, Payment, Student, FeeTemplate } from "@prisma/client";
import { createInvoice, recordPayment, deleteInvoice } from "./actions";
import { useTenant } from "@/lib/tenant-context";
import { formatNaira } from "./FinanceDashboard";
import { 
  Search, 
  Trash2, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  PlusCircle
} from "lucide-react";

type InvoiceWithDetails = Invoice & {
  student: Student & { currentClass?: string | null };
  payments: Payment[];
};

export default function InvoiceTable({ 
  invoices, 
  students,
  feeTemplates,
  schoolId 
}: { 
  invoices: InvoiceWithDetails[], 
  students: (Student & { currentClass?: string | null })[],
  feeTemplates: FeeTemplate[],
  schoolId: string 
}) {
  const [isPending, startTransition] = useTransition();
  const tenant = useTenant();

  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceData, setInvoiceData] = useState({ studentId: "", feeTemplateId: "", amountDue: 0, dueDate: "", description: "" });
  
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState({ amountPaid: 0, method: "CASH" });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE">("ALL");

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Status filter
      if (statusFilter !== "ALL" && inv.status !== statusFilter) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const studentName = `${inv.student.firstName} ${inv.student.lastName}`.toLowerCase();
        const adm = (inv.student.admissionNumber || "").toLowerCase();
        const currentClass = (inv.student.currentClass || "").toLowerCase();
        const desc = inv.description.toLowerCase();
        const invId = inv.id.toLowerCase();
        return studentName.includes(q) || adm.includes(q) || currentClass.includes(q) || desc.includes(q) || invId.includes(q);
      }
      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value;
    const template = feeTemplates.find(t => t.id === templateId);
    if (template) {
      setInvoiceData({ 
        ...invoiceData, 
        feeTemplateId: templateId,
        amountDue: template.defaultAmount,
        description: template.name
      });
    } else {
      setInvoiceData({ ...invoiceData, feeTemplateId: "" });
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionAlert(null);
    startTransition(async () => {
      const res = await createInvoice(schoolId, {
        studentId: invoiceData.studentId,
        amountDue: invoiceData.amountDue,
        dueDate: invoiceData.dueDate,
        description: invoiceData.description,
        feeTemplateId: invoiceData.feeTemplateId || undefined
      });
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setShowInvoiceForm(false);
        setInvoiceData({ studentId: "", feeTemplateId: "", amountDue: 0, dueDate: "", description: "" });
        setActionAlert({ type: "success", text: "Invoice successfully created and added to ledger." });
      }
    });
  };

  const handleRecordPayment = async (e: React.FormEvent, invoice: InvoiceWithDetails) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionAlert(null);
    startTransition(async () => {
      const res = await recordPayment(schoolId, {
        studentId: invoice.studentId,
        invoiceId: invoice.id,
        amountPaid: paymentData.amountPaid,
        method: paymentData.method,
      });
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setShowPaymentForm(null);
        setPaymentData({ amountPaid: 0, method: "CASH" });
        setActionAlert({ 
          type: "success", 
          text: `Payment of ${formatNaira(paymentData.amountPaid)} recorded for ${invoice.student.firstName} ${invoice.student.lastName}!` 
        });
      }
    });
  };

  const handleDeleteInvoice = async (invoice: InvoiceWithDetails) => {
    if (!confirm(`Are you sure you want to delete Invoice #${invoice.id.substring(0, 8).toUpperCase()} for ${invoice.student.firstName} ${invoice.student.lastName}?`)) {
      return;
    }
    setActionAlert(null);
    startTransition(async () => {
      const res = await deleteInvoice(schoolId, invoice.id);
      if (res.success) {
        setActionAlert({ type: "success", text: "Invoice deleted successfully." });
      } else {
        setActionAlert({ type: "error", text: res.error || "Failed to delete invoice." });
      }
    });
  };

  const printReceipt = (invoice: InvoiceWithDetails, totalPaid: number, balance: number) => {
    const receiptWindow = window.open("", "_blank");
    if (receiptWindow) {
      const schoolName = tenant.name || "INSTITUTIONAL BURSARY";
      const receiptNo = `RCP-${invoice.id.substring(0, 8).toUpperCase()}`;
      const printDate = new Date().toLocaleDateString("en-NG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      receiptWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Official Bursary Receipt - ${invoice.student.firstName} ${invoice.student.lastName}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #0f172a; max-width: 680px; margin: 0 auto; line-height: 1.5; }
              .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 18px; margin-bottom: 24px; }
              .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1.5px; color: #0f172a; }
              .header p { color: #64748b; margin: 4px 0 0 0; font-size: 13px; font-weight: 500; }
              .receipt-badge { display: inline-block; margin-top: 8px; padding: 3px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #334155; }
              .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 13px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; }
              .meta-grid strong { color: #475569; }
              .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              .table th, .table td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
              .table th { background: #f1f5f9; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; color: #475569; }
              .total-row { font-weight: 700; font-size: 14px; }
              .payment-log { margin-top: 18px; padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; font-size: 12px; }
              .stamp-box { margin-top: 36px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 1px solid #e2e8f0; }
              .seal { border: 2px dashed #0284c7; color: #0284c7; padding: 10px 18px; border-radius: 8px; font-size: 12px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
              .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8; }
              .btn-bar { text-align: center; margin-top: 20px; }
              .print-btn { padding: 9px 24px; background: #0f172a; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; }
              @media print { .btn-bar { display: none; } body { padding: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${schoolName}</h1>
              <p>Official Bursary & Tuition Receipt</p>
              <div class="receipt-badge">${receiptNo}</div>
            </div>

            <div class="meta-grid">
              <div>
                <div><strong>Student Name:</strong> ${invoice.student.firstName} ${invoice.student.lastName}</div>
                <div><strong>Admission No:</strong> ${invoice.student.admissionNumber || "N/A"}</div>
                <div><strong>Class / Tier:</strong> ${invoice.student.currentClass || "Unassigned"}</div>
              </div>
              <div style="text-align: right;">
                <div><strong>Date Issued:</strong> ${new Date(invoice.createdAt).toLocaleDateString("en-NG")}</div>
                <div><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString("en-NG")}</div>
                <div><strong>Receipt Date:</strong> ${printDate}</div>
              </div>
            </div>

            <table class="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right;">Status</th>
                  <th style="text-align: right;">Amount Billed</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>${invoice.description}</strong></td>
                  <td style="text-align: right;"><span style="font-weight: 700; color: ${invoice.status === 'PAID' ? '#16a34a' : '#ea580c'};">${invoice.status}</span></td>
                  <td style="text-align: right; font-weight: 700;">₦${invoice.amountDue.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="2" style="text-align: right; color: #16a34a;">Total Amount Reconciled / Paid:</td>
                  <td style="text-align: right; color: #16a34a;">₦${totalPaid.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="2" style="text-align: right; color: ${balance > 0 ? '#dc2626' : '#16a34a'};">Outstanding Balance:</td>
                  <td style="text-align: right; color: ${balance > 0 ? '#dc2626' : '#16a34a'};">₦${balance.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            ${invoice.payments && invoice.payments.length > 0 ? `
              <div class="payment-log">
                <strong>Transaction Audit Log:</strong>
                <ul style="margin: 6px 0 0 0; padding-left: 20px;">
                  ${invoice.payments.map(p => `
                    <li>₦${p.amountPaid.toLocaleString("en-NG", { minimumFractionDigits: 2 })} paid via <strong>${p.method}</strong> on ${new Date(p.paymentDate).toLocaleDateString("en-NG")}</li>
                  `).join("")}
                </ul>
              </div>
            ` : ''}

            <div class="stamp-box">
              <div>
                <p style="margin: 0; font-size: 12px; color: #64748b;">Issued by Bursary & Accounts Department</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #94a3b8;">Computer-generated official school financial voucher</p>
              </div>
              <div class="seal">
                OFFICIALLY RECONCILED<br/>
                <span style="font-size: 10px; font-weight: normal;">BURSARY OFFICE</span>
              </div>
            </div>

            <div class="footer">
              <p>Thank you for your institutional payment. Please retain this receipt for clearance.</p>
            </div>

            <div class="btn-bar">
              <button class="print-btn" onclick="window.print()">Print Official Receipt</button>
            </div>
          </body>
        </html>
      `);
      receiptWindow.document.close();
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">Pending</span>;
      case "PARTIAL":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">Partial</span>;
      case "PAID":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">Paid</span>;
      case "OVERDUE":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">Overdue</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {actionAlert && (
        <div className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between animate-in fade-in duration-300 ${
          actionAlert.type === "success" 
            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800" 
            : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800"
        }`}>
          <div className="flex items-center gap-2.5">
            {actionAlert.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{actionAlert.text}</span>
          </div>
          <button onClick={() => setActionAlert(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Toolbar: Search, Status Filter & Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name, admission #, class, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter & Create Button */}
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
            {(["ALL", "PENDING", "PARTIAL", "PAID"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  statusFilter === st
                    ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-bold"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                }`}
              >
                {st === "ALL" ? "All" : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setShowInvoiceForm(!showInvoiceForm)}
            className="px-4 py-2 text-white font-semibold rounded-xl shadow-xs transition text-xs sm:text-sm shrink-0 cursor-pointer"
            style={{ backgroundColor: tenant.branding.primaryColor }}
          >
            {showInvoiceForm ? "Cancel" : "Create Invoice"}
          </button>
        </div>
      </div>

      {/* Invoice Creation Form */}
      {showInvoiceForm && (
        <form onSubmit={handleCreateInvoice} className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
          {errorMsg && (
            <div className="md:col-span-2 p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-sm font-medium">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Student</label>
            <select 
              required 
              className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" 
              value={invoiceData.studentId} 
              onChange={e => setInvoiceData({...invoiceData, studentId: e.target.value})}
            >
              <option value="" disabled>Select student...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} {s.currentClass ? `(${s.currentClass})` : ""} {s.admissionNumber ? `- ${s.admissionNumber}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Fee Template (Optional)</label>
            <select 
              className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" 
              value={invoiceData.feeTemplateId} 
              onChange={handleTemplateChange}
            >
              <option value="">-- Custom Invoice --</option>
              {feeTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({formatNaira(t.defaultAmount)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Amount Due (₦)</label>
            <input 
              required 
              type="number" 
              step="0.01" 
              className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm font-mono" 
              value={invoiceData.amountDue || ""} 
              onChange={e => setInvoiceData({...invoiceData, amountDue: parseFloat(e.target.value)})} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Due Date</label>
            <input 
              required 
              type="date" 
              className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" 
              value={invoiceData.dueDate} 
              onChange={e => setInvoiceData({...invoiceData, dueDate: e.target.value})} 
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Description</label>
            <input 
              required 
              type="text" 
              placeholder="e.g. 1st Term Tuition & Feeding" 
              className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" 
              value={invoiceData.description} 
              onChange={e => setInvoiceData({...invoiceData, description: e.target.value})} 
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button 
              type="button" 
              onClick={() => setShowInvoiceForm(false)} 
              className="px-4 py-2.5 text-slate-600 hover:text-slate-800 dark:text-zinc-400 text-sm font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button 
              disabled={isPending} 
              type="submit" 
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl shadow-sm transition disabled:opacity-50 text-sm cursor-pointer"
            >
              {isPending ? "Saving..." : "Save Invoice"}
            </button>
          </div>
        </form>
      )}

      {/* DESKTOP TABLE VIEW (md+) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">Student & Class</th>
              <th className="px-6 py-4 font-semibold">Description</th>
              <th className="px-6 py-4 font-semibold">Amount Due</th>
              <th className="px-6 py-4 font-semibold">Balance</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-zinc-500 text-sm italic">
                  {invoices.length === 0 ? "No invoices found in database." : "No invoices match the selected filter criteria."}
                </td>
              </tr>
            )}
            {filteredInvoices.map((invoice) => {
              const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountPaid, 0);
              const balance = invoice.amountDue - totalPaid;
              const hasPayments = invoice.payments && invoice.payments.length > 0;
              
              return (
                <React.Fragment key={invoice.id}>
                  <tr className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {invoice.student.firstName} {invoice.student.lastName}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
                        {invoice.student.currentClass || "Unassigned"} &bull; {invoice.student.admissionNumber || "No Adm #"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-zinc-400">
                      <div className="max-w-[240px] truncate" title={invoice.description}>
                        {invoice.description}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-zinc-500">
                        Due: {new Date(invoice.dueDate).toLocaleDateString("en-NG")}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-zinc-100 font-mono font-medium">
                      {formatNaira(invoice.amountDue)}
                    </td>
                    <td className={`px-6 py-4 font-mono font-bold ${balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatNaira(balance)}
                    </td>
                    <td className="px-6 py-4">{renderStatus(invoice.status)}</td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      {invoice.status !== "PAID" && (
                        <button 
                          onClick={() => {
                            setShowPaymentForm(showPaymentForm === invoice.id ? null : invoice.id);
                            setPaymentData({ amountPaid: balance, method: "CASH" });
                            setErrorMsg(null);
                          }}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold rounded-lg transition text-xs border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                        >
                          Record Payment
                        </button>
                      )}
                      
                      <button
                        onClick={() => printReceipt(invoice, totalPaid, balance)}
                        className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-medium rounded-lg transition text-xs flex items-center gap-1 cursor-pointer"
                        title="Print Official Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>

                      {!hasPayments && (
                        <button
                          onClick={() => handleDeleteInvoice(invoice)}
                          disabled={isPending}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition cursor-pointer"
                          title="Delete Unpaid Invoice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Inline Payment Form (Desktop) */}
                  {showPaymentForm === invoice.id && (
                    <tr className="bg-slate-50/70 dark:bg-zinc-950/60">
                      <td colSpan={6} className="px-6 py-4">
                        <form onSubmit={(e) => handleRecordPayment(e, invoice)} className="flex items-end gap-4 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-inner">
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Payment Amount (₦)</label>
                            <input 
                              required 
                              type="number" 
                              step="0.01" 
                              max={balance} 
                              className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm font-mono" 
                              value={paymentData.amountPaid || ""} 
                              onChange={e => setPaymentData({...paymentData, amountPaid: parseFloat(e.target.value)})} 
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Method</label>
                            <select 
                              className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" 
                              value={paymentData.method} 
                              onChange={e => setPaymentData({...paymentData, method: e.target.value})}
                            >
                              <option value="CASH">Cash Deposit</option>
                              <option value="TRANSFER">Bank Transfer (Direct)</option>
                              <option value="CARD">Debit / POS Card</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <button disabled={isPending} type="submit" className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 text-sm shadow-xs cursor-pointer">
                              {isPending ? "Recording..." : "Confirm Payment"}
                            </button>
                            <button type="button" onClick={() => setShowPaymentForm(null)} className="px-4 py-2 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition text-sm cursor-pointer">
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARDS VIEW (< md) - Zero Features Dropped */}
      <div className="md:hidden space-y-3.5">
        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-zinc-500 italic bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm text-sm">
            {invoices.length === 0 ? "No invoices found." : "No invoices match search criteria."}
          </div>
        ) : (
          filteredInvoices.map((invoice) => {
            const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountPaid, 0);
            const balance = invoice.amountDue - totalPaid;
            const hasPayments = invoice.payments && invoice.payments.length > 0;

            return (
              <div 
                key={invoice.id} 
                className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-3 transition-shadow hover:shadow-md"
              >
                {/* Header: Student Name & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">
                      {invoice.student.firstName} {invoice.student.lastName}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                      {invoice.student.currentClass || "Unassigned"} &bull; {invoice.description}
                    </p>
                  </div>
                  <div>{renderStatus(invoice.status)}</div>
                </div>

                {/* Amounts Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/60 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800/40">
                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Amount Due</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm block mt-0.5 font-mono">
                      {formatNaira(invoice.amountDue)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800/40">
                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Balance</span>
                    <span className={`font-bold text-sm block mt-0.5 font-mono ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formatNaira(balance)}
                    </span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/60">
                  <div>
                    {!hasPayments && (
                      <button
                        onClick={() => handleDeleteInvoice(invoice)}
                        disabled={isPending}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {invoice.status !== "PAID" && (
                      <button 
                        onClick={() => {
                          setShowPaymentForm(showPaymentForm === invoice.id ? null : invoice.id);
                          setPaymentData({ amountPaid: balance, method: "CASH" });
                          setErrorMsg(null);
                        }}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold rounded-lg transition text-xs border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                      >
                        {showPaymentForm === invoice.id ? "Close" : "Record Payment"}
                      </button>
                    )}
                    <button
                      onClick={() => printReceipt(invoice, totalPaid, balance)}
                      className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-medium rounded-lg transition text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Receipt</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Inline Payment Form */}
                {showPaymentForm === invoice.id && (
                  <form onSubmit={(e) => handleRecordPayment(e, invoice)} className="mt-3 p-3.5 bg-slate-50 dark:bg-zinc-950/70 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-300">Record Payment</h5>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Amount (₦)</label>
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        max={balance} 
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs font-mono" 
                        value={paymentData.amountPaid || ""} 
                        onChange={e => setPaymentData({...paymentData, amountPaid: parseFloat(e.target.value)})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Payment Method</label>
                      <select 
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs" 
                        value={paymentData.method} 
                        onChange={e => setPaymentData({...paymentData, method: e.target.value})}
                      >
                        <option value="CASH">Cash</option>
                        <option value="TRANSFER">Bank Transfer</option>
                        <option value="CARD">Debit / POS Card</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button type="button" onClick={() => setShowPaymentForm(null)} className="px-3 py-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition text-xs cursor-pointer">
                        Cancel
                      </button>
                      <button disabled={isPending} type="submit" className="px-3.5 py-1.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 text-xs cursor-pointer">
                        {isPending ? "Recording..." : "Submit Payment"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
