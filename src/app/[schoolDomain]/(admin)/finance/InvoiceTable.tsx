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

  const renderStatus = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">Pending</span>;
      case "PARTIAL":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">Partial</span>;
      case "PAID":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Paid</span>;
      case "OVERDUE":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Overdue</span>;
      default:
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">{status}</span>;
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
        <form onSubmit={handleCreateInvoice} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          {errorMsg && (
            <div className="md:col-span-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Student</label>
            <select required className="w-full border border-slate-300 rounded-lg p-2" value={invoiceData.studentId} onChange={e => setInvoiceData({...invoiceData, studentId: e.target.value})}>
              <option value="" disabled>Select a student</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fee Template (Optional)</label>
            <select className="w-full border border-slate-300 rounded-lg p-2" value={invoiceData.feeTemplateId} onChange={handleTemplateChange}>
              <option value="">-- Custom Invoice --</option>
              {feeTemplates.map(t => <option key={t.id} value={t.id}>{t.name} (${t.defaultAmount})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount Due ($)</label>
            <input required type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-2" value={invoiceData.amountDue || ""} onChange={e => setInvoiceData({...invoiceData, amountDue: parseFloat(e.target.value)})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input required type="date" className="w-full border border-slate-300 rounded-lg p-2" value={invoiceData.dueDate} onChange={e => setInvoiceData({...invoiceData, dueDate: e.target.value})} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input required type="text" placeholder="e.g. Fall Tuition" className="w-full border border-slate-300 rounded-lg p-2" value={invoiceData.description} onChange={e => setInvoiceData({...invoiceData, description: e.target.value})} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button disabled={isPending} type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50">
              Save Invoice
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-6 py-4 font-semibold">Student</th>
              <th className="px-6 py-4 font-semibold">Description</th>
              <th className="px-6 py-4 font-semibold">Amount Due</th>
              <th className="px-6 py-4 font-semibold">Balance</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-lg">
                  No invoices found.
                </td>
              </tr>
            )}
            {invoices.map((invoice) => {
              const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountPaid, 0);
              const balance = invoice.amountDue - totalPaid;
              
              return (
                <React.Fragment key={invoice.id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {invoice.student.firstName} {invoice.student.lastName}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{invoice.description}</td>
                    <td className="px-6 py-4">${invoice.amountDue.toFixed(2)}</td>
                    <td className="px-6 py-4 font-semibold text-slate-700">${balance.toFixed(2)}</td>
                    <td className="px-6 py-4">{renderStatus(invoice.status)}</td>
                    <td className="px-6 py-4 text-right">
                      {invoice.status !== "PAID" && (
                        <button 
                          onClick={() => {
                            setShowPaymentForm(showPaymentForm === invoice.id ? null : invoice.id);
                            setPaymentData({ amountPaid: balance, method: "CASH" });
                            setErrorMsg(null);
                          }}
                          className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium rounded transition"
                        >
                          Payment
                        </button>
                      )}
                    </td>
                  </tr>
                  {showPaymentForm === invoice.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-6 py-4">
                        <form onSubmit={(e) => handleRecordPayment(e, invoice)} className="flex items-end gap-4 p-4 bg-white rounded-lg border border-slate-200 shadow-inner">
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Amount ($)</label>
                            <input required type="number" step="0.01" max={balance} className="w-full border border-slate-300 rounded p-2" value={paymentData.amountPaid || ""} onChange={e => setPaymentData({...paymentData, amountPaid: parseFloat(e.target.value)})} />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Method</label>
                            <select className="w-full border border-slate-300 rounded p-2" value={paymentData.method} onChange={e => setPaymentData({...paymentData, method: e.target.value})}>
                              <option value="CASH">Cash</option>
                              <option value="CARD">Credit Card</option>
                              <option value="TRANSFER">Bank Transfer</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <button disabled={isPending} type="submit" className="px-4 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700 transition disabled:opacity-50">
                              Record
                            </button>
                            <button type="button" onClick={() => setShowPaymentForm(null)} className="px-4 py-2 text-slate-500 hover:text-slate-700 transition">
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
    </div>
  );
}
