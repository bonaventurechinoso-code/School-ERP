"use client";

import React, { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTenant } from "@/lib/tenant-context";
import { disbursePayroll, voidPayroll, deleteDepartment } from "./actions";
import BankDetailsForm from "./BankDetailsForm";
import PaySlipModal, { PaySlipData } from "./PaySlipModal";
import { Wallet, AlertCircle, FileText, CheckCircle2, Trash2, Building } from "lucide-react";
import { 
  StaffTierCategory, 
  resolveStaffTierCategory, 
  formatStaffRoleByTier 
} from "@/lib/staff-roles-config";

export interface PayrollDirectoryProps {
  schoolDomain: string;
  schoolName: string;
  walletBalance: number;
  departments: { id: string; name: string }[];
  staff: any[];
  activeTier?: string;
}

export default function PayrollDirectoryClient({
  schoolDomain,
  schoolName,
  walletBalance,
  departments,
  staff,
  activeTier,
}: PayrollDirectoryProps) {
  const tenant = useTenant();
  const searchParams = useSearchParams();
  const paramTier = searchParams?.get("tier");

  const effectiveTier = paramTier || activeTier || (tenant as any)?.activeTier || tenant?.preciseTier || "PRIMARY";
  const tierCategory: StaffTierCategory = resolveStaffTierCategory(effectiveTier);

  const [isPending, startTransition] = useTransition();
  const [selectedPaySlip, setSelectedPaySlip] = useState<PaySlipData | null>(null);
  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Calculate total pending liabilities
  const totalPending = staff.reduce((acc, s) => {
    const pendingSum = s.PayrollRecord.filter((p: any) => p.status === "PENDING").reduce((pAcc: number, p: any) => pAcc + p.amount, 0);
    return acc + pendingSum;
  }, 0);

  const handleDisburse = (payrollId: string, staffName: string) => {
    setActionAlert(null);
    setProcessingId(payrollId);

    startTransition(async () => {
      const res = await disbursePayroll(schoolDomain, payrollId);
      setProcessingId(null);
      if (res.success) {
        setActionAlert({
          type: "success",
          text: `Salary successfully disbursed for ${staffName}! Receipt code: ${res.receiptCode || "N/A"}`
        });
      } else {
        setActionAlert({
          type: "error",
          text: res.error || "Failed to disburse salary."
        });
      }
    });
  };

  const handleVoid = (payrollId: string) => {
    if (!confirm("Are you sure you want to void and remove this payroll entry?")) return;
    setActionAlert(null);
    startTransition(async () => {
      const res = await voidPayroll(schoolDomain, payrollId);
      if (res?.success === false) {
        setActionAlert({ type: "error", text: res.error || "Failed to void record." });
      } else {
        setActionAlert({ type: "success", text: "Payroll record voided successfully." });
      }
    });
  };

  const handleDeleteDept = (deptId: string, deptName: string) => {
    if (!confirm(`Delete department "${deptName}"?`)) return;
    setActionAlert(null);
    startTransition(async () => {
      const res = await deleteDepartment(schoolDomain, deptId);
      if (res.success) {
        setActionAlert({ type: "success", text: `Department "${deptName}" deleted.` });
      } else {
        setActionAlert({ type: "error", text: res.error || "Failed to delete department." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* WALLET BALANCE & HR KPI BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-sm flex flex-col justify-between min-h-[180px]">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-300">School Wallet Balance</span>
            <Wallet className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold tracking-tight font-mono">
              ${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1">Available for payroll disbursements & operational expenses</div>
          </div>
          <div>
            <a 
              href={`/${schoolDomain}/finance`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-white underline underline-offset-4"
            >
              Deposit Funds in Finance &rarr;
            </a>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between min-h-[180px]">
          <div className="text-xs uppercase font-bold tracking-wider text-slate-500">Pending Payroll Liability</div>
          <div className="my-3">
            <div className={`text-3xl font-extrabold tracking-tight font-mono ${totalPending > walletBalance ? 'text-rose-600' : 'text-slate-900'}`}>
              ${totalPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {totalPending > walletBalance ? (
                <span className="text-rose-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Balance is insufficient for all pending payouts
                </span>
              ) : (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Covered by available wallet funds
                </span>
              )}
            </div>
          </div>
          <div className="text-xs text-slate-400">Total unprocessed salary records awaiting payout</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between min-h-[180px]">
          <div className="text-xs uppercase font-bold tracking-wider text-slate-500">Staff Count & Organization</div>
          <div className="my-3">
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">
              {staff.length} <span className="text-base font-normal text-slate-500">Staff Members</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {departments.length > 0 
                ? `Organized across ${departments.length} department${departments.length > 1 ? "s" : ""}` 
                : "Staff members unassigned to departments"}
            </div>
          </div>
          <div className="text-xs text-slate-400">
            {departments.length > 0 
              ? "All staff bio-data and banking profiles are synchronized" 
              : "Operating under centralized institutional administrative pool"}
          </div>
        </div>
      </div>

      {/* FEEDBACK ALERT */}
      {actionAlert && (
        <div className={`p-4 rounded-xl text-sm font-medium border ${actionAlert.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
          <div className="flex items-center gap-2">
            {actionAlert.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{actionAlert.text}</span>
          </div>
        </div>
      )}

      {/* DEPARTMENTS QUICK BAR */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-600">Academic & Operational Departments</h4>
          {departments.length > 0 && (
            <span className="text-xs text-slate-400 font-medium">
              {departments.length} {departments.length === 1 ? "department" : "departments"} configured
            </span>
          )}
        </div>
        {departments.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2.5">
              <Building className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                <strong>No institutional departments configured yet.</strong> Staff members are unassigned to specific operational departments and managed under the central directory.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {departments.map((d) => {
              const deptStaffCount = staff.filter((s) => s.departmentId === d.id).length;
              return (
                <div key={d.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                  <span>{d.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-white text-slate-500 text-[10px] font-bold">
                    {deptStaffCount} staff
                  </span>
                  {deptStaffCount === 0 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDept(d.id, d.name)}
                      className="text-slate-400 hover:text-rose-600 transition"
                      title="Delete empty department"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STAFF DIRECTORY & PAYROLL TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Staff Payroll Registry</h3>
            <p className="text-xs text-slate-500">Manage employee accounts, bank details, payouts, and printable pay slips.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Role & Dept</th>
                <th className="p-4">Bank Destination</th>
                <th className="p-4">Payroll History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    No staff records found for this institution.
                  </td>
                </tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 align-top">
                      <div className="font-bold text-slate-900">{s.firstName} {s.lastName}</div>
                      <div className="text-xs text-slate-500">{s.email}</div>
                    </td>

                    <td className="p-4 align-top">
                      <div className="font-medium text-slate-800">{formatStaffRoleByTier(s.role, tierCategory)}</div>
                      <div className="text-xs text-slate-500">{s.department?.name || "General"}</div>
                    </td>

                    <td className="p-4 align-top max-w-xs">
                      <BankDetailsForm staff={s} schoolDomain={schoolDomain} />
                    </td>

                    <td className="p-4 align-top">
                      {s.PayrollRecord.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No payroll entries created</span>
                      ) : (
                        <div className="space-y-2">
                          {s.PayrollRecord.map((pr: any) => {
                            const isDisbursed = pr.status.includes("DISBURSED");
                            const isCurrentlyProcessing = processingId === pr.id;

                            return (
                              <div
                                key={pr.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs"
                              >
                                <div>
                                  <span className="font-bold text-slate-900 text-sm font-mono">
                                    ${pr.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                  <span className="text-slate-500 ml-2">
                                    &bull; {new Date(pr.payDate).toLocaleDateString()}
                                  </span>
                                  <div className="mt-0.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${isDisbursed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                      {pr.status}
                                    </span>
                                    {pr.receiptCode && (
                                      <span className="ml-1.5 font-mono text-[10px] text-slate-400" title={pr.receiptCode}>
                                        #{pr.receiptCode.slice(0, 12)}...
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {!isDisbursed && (
                                    <button
                                      disabled={isPending}
                                      onClick={() => handleDisburse(pr.id, `${s.firstName} ${s.lastName}`)}
                                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition disabled:opacity-50 shadow-sm"
                                    >
                                      {isCurrentlyProcessing ? "Disbursing..." : "Disburse"}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => setSelectedPaySlip({
                                      id: pr.id,
                                      amount: pr.amount,
                                      payDate: pr.payDate,
                                      status: pr.status,
                                      receiptCode: pr.receiptCode,
                                      staff: {
                                        ...s,
                                        role: formatStaffRoleByTier(s.role, tierCategory),
                                      },
                                      schoolName,
                                    })}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition"
                                    title="View & Print Official Pay Slip"
                                  >
                                    <FileText className="w-3 h-3 text-slate-500" />
                                    Pay Slip
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handleVoid(pr.id)}
                                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                                    title="Void record"
                                  >
                                    &times;
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAY SLIP MODAL */}
      {selectedPaySlip && (
        <PaySlipModal
          data={selectedPaySlip}
          onClose={() => setSelectedPaySlip(null)}
        />
      )}
    </div>
  );
}
