"use client";

import React, { useState, useTransition } from "react";
import { Invoice, Payment, Student, FeeTemplate } from "@prisma/client";
import { createInvoice, recordPayment } from "./actions";
import { useTenant } from "@/lib/tenant-context";

type InvoiceWithDetails = Invoice & {
  student: Student;
  payments: Payment[];
};

export default function InvoiceTable({ 
  invoices, 
  students,
  feeTemplates,
  schoolId 
}: { 
  invoices: InvoiceWithDetails[], 
  students: Student[],
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
      }
    });
  };

  const handleRecordPayment = async (e: React.FormEvent, invoice: InvoiceWithDetails) => {
    e.preventDefault();
    setErrorMsg(null);
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
      }
    });
  };

  const printReceipt = (invoice: InvoiceWithDetails, totalPaid: number, balance: number) => {
    const receiptWindow = window.open("", "_blank");
    if (receiptWindow) {
      receiptWindow.document.write(`
        <html>
          <head>
            <title>Official Payment Receipt - ${invoice.student.firstName} ${invoice.student.lastName}</title>
            <style>
              body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; max-width: 600px; margin: 0 auto; }
              .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
              .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
              .header p { color: #64748b; margin: 5px 0 0 0; font-size: 14px; }
              .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; }
              .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
              .table th { background: #f8fafc; font-size: 12px; text-transform: uppercase; }
              .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #94a3b8; }
              @media print { .print-btn { display: none; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${tenant.name || "INSTITUTIONAL RECEIPT"}</h1>
              <p>Official Invoice & Payment Receipt</p>
            </div>
            <div class="info">
              <div>
                <strong>Student:</strong> ${invoice.student.firstName} ${invoice.student.lastName}<br/>
                <strong>Invoice ID:</strong> ${invoice.id.substring(0, 8).toUpperCase()}<br/>
                <strong>Status:</strong> ${invoice.status}
              </div>
              <div style="text-align: right;">
                <strong>Date Issued:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}<br/>
                <strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}
              </div>
            </div>
            <table class="table">
              <thead>
                <tr><th>Description</th><th style="text-align: right;">Amount</th></tr>
              </thead>
              <tbody>
                <tr><td>${invoice.description}</td><td style="text-align: right;">$${invoice.amountDue.toFixed(2)}</td></tr>
                <tr><td><strong>Total Paid</strong></td><td style="text-align: right; color: #16a34a;"><strong>$${totalPaid.toFixed(2)}</strong></td></tr>
                <tr><td><strong>Balance Remaining</strong></td><td style="text-align: right; color: #dc2626;"><strong>$${balance.toFixed(2)}</strong></td></tr>
              </tbody>
            </table>
            <div class="footer">
              <p>Thank you for your payment. Keep this document for your records.</p>
              <button class="print-btn" onclick="window.print()" style="padding: 10px 20px; background: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print Receipt</button>
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
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">Pending</span>;
      case "PARTIAL":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400">Partial</span>;
      case "PAID":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400">Paid</span>;
      case "OVERDUE":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-400">Overdue</span>;
      default:
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowInvoiceForm(!showInvoiceForm)}
          className="px-4 py-2 text-white font-medium rounded-lg shadow-sm transition"
          style={{ backgroundColor: tenant.branding.primaryColor }}
        >
          {showInvoiceForm ? "Cancel" : "Create Invoice"}
        </button>
      </div>

      {showInvoiceForm && (
        <form onSubmit={handleCreateInvoice} className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          {errorMsg && (
            <div className="md:col-span-2 p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-sm font-medium">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Student</label>
            <select required className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" value={invoiceData.studentId} onChange={e => setInvoiceData({...invoiceData, studentId: e.target.value})}>
              <option value="" disabled>Select a student</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Fee Template (Optional)</label>
            <select className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" value={invoiceData.feeTemplateId} onChange={handleTemplateChange}>
              <option value="">-- Custom Invoice --</option>
              {feeTemplates.map(t => <option key={t.id} value={t.id}>{t.name} (${t.defaultAmount})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Amount Due ($)</label>
            <input required type="number" step="0.01" className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" value={invoiceData.amountDue || ""} onChange={e => setInvoiceData({...invoiceData, amountDue: parseFloat(e.target.value)})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Due Date</label>
            <input required type="date" className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" value={invoiceData.dueDate} onChange={e => setInvoiceData({...invoiceData, dueDate: e.target.value})} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Description</label>
            <input required type="text" placeholder="e.g. Fall Tuition" className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" value={invoiceData.description} onChange={e => setInvoiceData({...invoiceData, description: e.target.value})} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button disabled={isPending} type="submit" className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl shadow-sm transition disabled:opacity-50 text-sm">
              Save Invoice
            </button>
          </div>
        </form>
      )}

      {/* DESKTOP TABLE VIEW (md+) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">Student</th>
              <th className="px-6 py-4 font-semibold">Description</th>
              <th className="px-6 py-4 font-semibold">Amount Due</th>
              <th className="px-6 py-4 font-semibold">Balance</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-zinc-500 text-base italic">
                  No invoices found.
                </td>
              </tr>
            )}
            {invoices.map((invoice) => {
              const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountPaid, 0);
              const balance = invoice.amountDue - totalPaid;
              
              return (
                <React.Fragment key={invoice.id}>
                  <tr className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {invoice.student.firstName} {invoice.student.lastName}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-zinc-400">{invoice.description}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-zinc-100">${invoice.amountDue.toFixed(2)}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-zinc-200">${balance.toFixed(2)}</td>
                    <td className="px-6 py-4">{renderStatus(invoice.status)}</td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      {invoice.status !== "PAID" && (
                        <button 
                          onClick={() => {
                            setShowPaymentForm(showPaymentForm === invoice.id ? null : invoice.id);
                            setPaymentData({ amountPaid: balance, method: "CASH" });
                            setErrorMsg(null);
                          }}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 font-medium rounded-lg transition text-xs"
                        >
                          Record Payment
                        </button>
                      )}
                      <button
                        onClick={() => printReceipt(invoice, totalPaid, balance)}
                        className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-medium rounded-lg transition text-xs"
                      >
                        Print Receipt
                      </button>
                    </td>
                  </tr>
                  {showPaymentForm === invoice.id && (
                    <tr className="bg-slate-50/70 dark:bg-zinc-950/60">
                      <td colSpan={6} className="px-6 py-4">
                        <form onSubmit={(e) => handleRecordPayment(e, invoice)} className="flex items-end gap-4 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-inner">
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Amount ($)</label>
                            <input required type="number" step="0.01" max={balance} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" value={paymentData.amountPaid || ""} onChange={e => setPaymentData({...paymentData, amountPaid: parseFloat(e.target.value)})} />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Method</label>
                            <select className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" value={paymentData.method} onChange={e => setPaymentData({...paymentData, method: e.target.value})}>
                              <option value="CASH">Cash</option>
                              <option value="CARD">Credit Card</option>
                              <option value="TRANSFER">Bank Transfer</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <button disabled={isPending} type="submit" className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 text-sm">
                              Record
                            </button>
                            <button type="button" onClick={() => setShowPaymentForm(null)} className="px-4 py-2 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition text-sm">
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
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-zinc-500 italic bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            No invoices found.
          </div>
        ) : (
          invoices.map((invoice) => {
            const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountPaid, 0);
            const balance = invoice.amountDue - totalPaid;

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
                      {invoice.description}
                    </p>
                  </div>
                  <div>{renderStatus(invoice.status)}</div>
                </div>

                {/* Amounts Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/60 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800/40">
                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Amount Due</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm block mt-0.5">
                      ${invoice.amountDue.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800/40">
                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Balance</span>
                    <span className={`font-bold text-sm block mt-0.5 ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      ${balance.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/60">
                  {invoice.status !== "PAID" && (
                    <button 
                      onClick={() => {
                        setShowPaymentForm(showPaymentForm === invoice.id ? null : invoice.id);
                        setPaymentData({ amountPaid: balance, method: "CASH" });
                        setErrorMsg(null);
                      }}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 font-medium rounded-lg transition text-xs"
                    >
                      {showPaymentForm === invoice.id ? "Close Payment" : "Record Payment"}
                    </button>
                  )}
                  <button
                    onClick={() => printReceipt(invoice, totalPaid, balance)}
                    className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-medium rounded-lg transition text-xs"
                  >
                    Print Receipt
                  </button>
                </div>

                {/* Mobile Inline Payment Form */}
                {showPaymentForm === invoice.id && (
                  <form onSubmit={(e) => handleRecordPayment(e, invoice)} className="mt-3 p-3.5 bg-slate-50 dark:bg-zinc-950/70 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-300">Record Payment</h5>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Amount ($)</label>
                      <input required type="number" step="0.01" max={balance} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs" value={paymentData.amountPaid || ""} onChange={e => setPaymentData({...paymentData, amountPaid: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Payment Method</label>
                      <select className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs" value={paymentData.method} onChange={e => setPaymentData({...paymentData, method: e.target.value})}>
                        <option value="CASH">Cash</option>
                        <option value="CARD">Credit Card</option>
                        <option value="TRANSFER">Bank Transfer</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button type="button" onClick={() => setShowPaymentForm(null)} className="px-3 py-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition text-xs">
                        Cancel
                      </button>
                      <button disabled={isPending} type="submit" className="px-3.5 py-1.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 text-xs">
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
