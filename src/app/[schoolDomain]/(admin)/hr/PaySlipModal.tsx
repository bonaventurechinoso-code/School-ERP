"use client";

import React from "react";
import { Printer, X, CheckCircle, Clock } from "lucide-react";

export interface PaySlipData {
  id: string;
  amount: number;
  payDate: string;
  status: string;
  receiptCode?: string | null;
  staff: {
    firstName: string;
    lastName: string;
    role: string;
    email: string;
    bankName?: string | null;
    accountName?: string | null;
    bankAccountNumber?: string | null;
    department?: { name: string } | null;
  };
  schoolName: string;
}

export default function PaySlipModal({
  data,
  onClose,
}: {
  data: PaySlipData;
  onClose: () => void;
}) {
  const handlePrint = () => {
    window.print();
  };

  const isDisbursed = data.status.includes("DISBURSED");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header - Not printed */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 print:hidden">
          <h3 className="font-bold text-slate-800 text-base">Employee Salary Pay Slip</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Slip
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Pay Slip Sheet */}
        <div className="p-8 overflow-y-auto space-y-6 text-slate-800 print:p-0 print:m-0" id="payslip-content">
          {/* Institutional Banner */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">{data.schoolName}</h1>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-0.5">Staff Remuneration & Payroll Advice</p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isDisbursed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                {isDisbursed ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {data.status}
              </span>
              <div className="text-xs text-slate-400 font-mono mt-1">REF: #{data.id.slice(0, 8).toUpperCase()}</div>
            </div>
          </div>

          {/* Employee & Payment Metadata */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Employee Name</span>
              <span className="font-bold text-slate-900 text-base">{data.staff.firstName} {data.staff.lastName}</span>
              <span className="text-xs text-slate-600 block mt-0.5">{data.staff.role} &bull; {data.staff.department?.name || "General Staff"}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Payment Date</span>
              <span className="font-bold text-slate-900 text-base">{new Date(data.payDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="text-xs text-slate-600 block mt-0.5">{data.staff.email}</span>
            </div>
          </div>

          {/* Bank Account Info */}
          <div className="border border-slate-200 rounded-xl p-4 text-xs space-y-1.5">
            <span className="font-bold uppercase tracking-wider text-slate-500 block mb-2">Disbursement Destination</span>
            <div className="flex justify-between">
              <span className="text-slate-500">Bank Name:</span>
              <span className="font-semibold text-slate-800">{data.staff.bankName || "Not on file"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Account Name:</span>
              <span className="font-semibold text-slate-800">{data.staff.accountName || `${data.staff.firstName} ${data.staff.lastName}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Account Number:</span>
              <span className="font-mono font-semibold text-slate-800">{data.staff.bankAccountNumber || "—"}</span>
            </div>
            {data.receiptCode && (
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <span className="text-slate-500">Disbursement Receipt:</span>
                <span className="font-mono font-bold text-indigo-700">{data.receiptCode}</span>
              </div>
            )}
          </div>

          {/* Earnings Breakdown */}
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left py-2">Description</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 font-medium text-slate-800">Base Salary / Periodic Compensation</td>
                  <td className="py-3 text-right font-mono font-semibold text-slate-900">${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td className="py-3 text-slate-600">Statutory Tax & Deductions</td>
                  <td className="py-3 text-right font-mono text-slate-500">$0.00</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 font-bold text-slate-900">
                  <td className="py-3 text-base">Net Payable / Disbursed Amount</td>
                  <td className="py-3 text-right text-lg font-mono text-emerald-700">
                    ${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Verification Stamp */}
          <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-400">
            <div>
              Generated on {new Date().toLocaleDateString()} via SchoolERP Payroll Bureau
            </div>
            <div className="text-right font-mono text-[10px]">
              AUTHENTICATED ELECTRONIC RECORD
            </div>
          </div>
        </div>

        {/* Footer - Not printed */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
