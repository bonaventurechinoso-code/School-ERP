"use client";

import React, { useState, useMemo, useTransition, useRef } from "react";
import { Invoice, Payment, Student, FeeTemplate } from "@prisma/client";
import { createInvoice, recordPayment, deleteInvoice } from "./actions";
import { useTenant } from "@/lib/tenant-context";
import { formatNaira } from "./FinanceDashboard";
import { apiClient } from "@/lib/api-client";
import { 
  Search, 
  Trash2, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  PlusCircle,
  RefreshCw
} from "lucide-react";
import { useActiveTierConfig } from "@/hooks/useClientTier";

type InvoiceWithDetails = Invoice & {
  student: Student & { currentClass?: string | null };
  payments: Payment[];
};

export default function InvoiceTable({ 
  activeTier: initialActiveTier,
  invoices, 
  students,
  feeTemplates,
  schoolId 
}: { 
  activeTier?: string;
  invoices: InvoiceWithDetails[], 
  students: (Student & { currentClass?: string | null })[],
  feeTemplates: FeeTemplate[],
  schoolId: string 
}) {
  const [isPending, startTransition] = useTransition();
  const tenant = useTenant();

  const { 
    activeTier, 
    tierConfig, 
    filterStudents, 
    filterInvoices, 
    filterFeeTemplates 
  } = useActiveTierConfig(initialActiveTier);

  // Prune students, invoices, and fee templates by active tier
  const tierStudents = useMemo(() => {
    return filterStudents(students);
  }, [students, filterStudents]);

  const isolatedFeeTemplates = useMemo(() => {
    return filterFeeTemplates(feeTemplates);
  }, [feeTemplates, filterFeeTemplates]);

  const tierInvoices = useMemo(() => {
    return filterInvoices(invoices);
  }, [invoices, filterInvoices]);

  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceData, setInvoiceData] = useState({ studentId: "", feeTemplateId: "", amountDue: 0, dueDate: "", description: "" });
  
  // Reactive Student Search State (Rule 2)
  const [studentSearchInput, setStudentSearchInput] = useState("");
  const [isSearchingStudent, setIsSearchingStudent] = useState(false);
  const [studentSearchResult, setStudentSearchResult] = useState<{
    student: { id: string; name: string; admissionNumber?: string | null; currentClass?: string | null };
    ledgerBalance: number;
  } | null>(null);
  const [studentSearchError, setStudentSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performStudentLookup = async (query: string) => {
    if (!query.trim()) return;
    setIsSearchingStudent(true);
    setStudentSearchError(null);

    try {
      // Dispatch internal API request using client interceptor to fetch student ledger balance via Prisma
      const res = await apiClient.get(
        `/api/v1/finance/student-balance?q=${encodeURIComponent(query.trim())}&schoolId=${schoolId}`
      );
      const data = await res.json();

      if (res.ok && data.success && data.student) {
        setInvoiceData((prev) => ({
          ...prev,
          studentId: data.student.id,
          amountDue: data.amountDue !== undefined ? data.amountDue : prev.amountDue,
          dueDate: data.dueDate || prev.dueDate,
          description: data.description || prev.description,
        }));
        setStudentSearchResult({
          student: data.student,
          ledgerBalance: data.ledgerBalance || 0,
        });
        setStudentSearchError(null);
      } else {
        setStudentSearchError(data.error || `No student ledger record found for "${query}".`);
        setStudentSearchResult(null);
      }
    } catch (err: any) {
      console.error("[Student Lookup Error]:", err);
      setStudentSearchError("Failed to lookup student ledger balance. Check connection.");
      setStudentSearchResult(null);
    } finally {
      setIsSearchingStudent(false);
    }
  };

  const handleStudentSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStudentSearchInput(val);
    setStudentSearchError(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!val.trim()) {
      setStudentSearchResult(null);
      return;
    }

    // Debounce optimization (350ms)
    searchTimeoutRef.current = setTimeout(() => {
      performStudentLookup(val);
    }, 350);
  };

  const handleStudentSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      performStudentLookup(studentSearchInput);
    }
  };

  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState({ amountPaid: 0, method: "CASH" });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE">("ALL");

  const filteredInvoices = useMemo(() => {
    return tierInvoices.filter(inv => {
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
  }, [tierInvoices, statusFilter, searchQuery]);

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
      const dashboardUrl = tenant?.subdomain ? `/${tenant.subdomain}/finance` : "/dashboard";
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
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                padding: 32px; 
                color: #0f172a; 
                max-width: 780px; 
                margin: 0 auto; 
                line-height: 1.5; 
                background-color: #ffffff;
              }
              @media print { 
                .print\\:hidden, [class*="print:hidden"], [className*="print:hidden"], .btn-bar { display: none !important; } 
                body { padding: 0 !important; max-width: 100% !important; } 
              }
            </style>
          </head>
          <body class="bg-white text-slate-900">
            <!-- Print-Shielded Top Navigation Action Bar -->
            <div class="print:hidden flex items-center justify-between w-full mb-6 p-4 border-b border-gray-100" className="print:hidden flex items-center justify-between w-full mb-6 p-4 border-b border-gray-100">
              <a href="${dashboardUrl}" onclick="if (window.opener) { window.close(); return false; }" class="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition no-underline">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m12 19-7-7 7-7"/>
                  <path d="M19 12H5"/>
                </svg>
                <span>Back to Dashboard</span>
              </a>

              <button class="inline-flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-800 transition cursor-pointer" onclick="window.print()">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect width="12" height="8" x="6" y="14"/>
                </svg>
                <span>Print Official Receipt</span>
              </button>
            </div>

            <!-- Official Header -->
            <div class="text-center border-b-2 border-slate-900 pb-5 mb-6">
              <h1 class="text-2xl font-black uppercase tracking-wider text-slate-900 mb-1">${schoolName}</h1>
              <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Official Bursary & Tuition Receipt</p>
              <div class="mt-2 inline-flex items-center px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-mono font-bold text-slate-700">
                ${receiptNo}
              </div>
            </div>

            <!-- 2-Column Split Grid: Student Profile & Receipt Metadata -->
            <div class="grid grid-cols-2 gap-8 mb-6 p-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
              <!-- Left Column: Student Details -->
              <div class="space-y-2.5">
                <div class="text-[10px] font-bold uppercase tracking-widest text-slate-400 pb-1 border-b border-slate-200">
                  Student Information
                </div>
                <div class="flex justify-between items-baseline gap-2">
                  <span class="text-slate-500 font-medium">Student Name:</span>
                  <span class="font-bold text-slate-900 text-right">${invoice.student.firstName} ${invoice.student.lastName}</span>
                </div>
                <div class="flex justify-between items-baseline gap-2">
                  <span class="text-slate-500 font-medium">Admission No:</span>
                  <span class="font-bold text-slate-700 font-mono text-right">${invoice.student.admissionNumber || "N/A"}</span>
                </div>
                <div class="flex justify-between items-baseline gap-2">
                  <span class="text-slate-500 font-medium">Class / Tier:</span>
                  <span class="font-bold text-slate-700 text-right">${invoice.student.currentClass || "Unassigned"}</span>
                </div>
              </div>

              <!-- Right Column: Receipt Details -->
              <div class="space-y-2.5">
                <div class="text-[10px] font-bold uppercase tracking-widest text-slate-400 pb-1 border-b border-slate-200">
                  Receipt Details
                </div>
                <div class="flex justify-between items-baseline gap-2">
                  <span class="text-slate-500 font-medium">Date Issued:</span>
                  <span class="font-semibold text-slate-700 text-right">${new Date(invoice.createdAt).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}</span>
                </div>
                <div class="flex justify-between items-baseline gap-2">
                  <span class="text-slate-500 font-medium">Due Date:</span>
                  <span class="font-semibold text-slate-700 text-right">${new Date(invoice.dueDate).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}</span>
                </div>
                <div class="flex justify-between items-baseline gap-2">
                  <span class="text-slate-500 font-medium">Receipt Date:</span>
                  <span class="font-semibold text-slate-700 font-mono text-right">${printDate}</span>
                </div>
              </div>
            </div>

            <!-- Structured Bill Items Table -->
            <div class="overflow-hidden border border-slate-200 rounded-2xl mb-6 shadow-2xs">
              <table class="w-full border-collapse text-left text-xs">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <th class="py-3 px-4 border-r border-slate-200">Billing Item Description</th>
                    <th class="py-3 px-4 text-center border-r border-slate-200 w-32">Status</th>
                    <th class="py-3 px-4 text-right w-44">Amount Billed</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td class="py-4 px-4 font-semibold text-slate-800 border-r border-slate-100">
                      ${invoice.description}
                    </td>
                    <td class="py-4 px-4 text-center border-r border-slate-100">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        invoice.status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : invoice.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }">
                        ${invoice.status}
                      </span>
                    </td>
                    <td class="py-4 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      ₦${invoice.amountDue.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Bounded Summary & Audit Log Section -->
            <div class="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 mb-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                
                <!-- Transaction Audit Log Box -->
                <div class="p-4 bg-white border border-slate-200 rounded-xl h-full flex flex-col">
                  <div class="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Transaction Audit Log</span>
                    <span class="text-[10px] font-semibold text-slate-400 font-mono">${invoice.payments?.length || 0} entry(ies)</span>
                  </div>
                  ${invoice.payments && invoice.payments.length > 0 ? `
                    <ul class="space-y-2 text-xs flex-1">
                      ${invoice.payments.map(p => `
                        <li class="flex items-center justify-between py-1 border-b border-dashed border-slate-100 last:border-0">
                          <div>
                            <strong class="text-slate-700 font-semibold">${p.method}</strong>
                            <div class="text-slate-400 text-[10px]">${new Date(p.paymentDate).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}</div>
                          </div>
                          <span class="font-mono font-bold text-emerald-600">₦${p.amountPaid.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span>
                        </li>
                      `).join("")}
                    </ul>
                  ` : `
                    <div class="text-xs text-slate-400 italic py-4 text-center flex-1 flex items-center justify-center">
                      No electronic payment entries recorded.
                    </div>
                  `}
                </div>

                <!-- Reconciliation Tallies Box -->
                <div class="p-4 bg-white border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reconciliation Summary</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      balance <= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }">
                      ${balance <= 0 ? 'CLEARED' : 'OUTSTANDING'}
                    </span>
                  </div>

                  <div class="flex items-center justify-between py-1 text-slate-600">
                    <span class="font-medium text-slate-500">Total Billed:</span>
                    <span class="font-mono font-bold text-slate-800">
                      ₦${invoice.amountDue.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div class="flex items-center justify-between py-1 border-t border-slate-100 text-emerald-700">
                    <span class="font-medium">Total Reconciled / Paid:</span>
                    <span class="font-mono font-bold text-sm">
                      ₦${totalPaid.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div class="flex items-center justify-between py-1.5 border-t border-slate-200 font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}">
                    <span class="text-xs">Outstanding Balance:</span>
                    <span class="font-mono text-base font-black">
                      ₦${balance.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            <!-- Official Seal & Authorization Footer -->
            <div class="flex items-end justify-between pt-4 border-t border-slate-200 text-xs mt-6">
              <div>
                <p class="font-semibold text-slate-700 m-0">Issued by Bursary & Accounts Department</p>
                <p class="text-[11px] text-slate-400 mt-0.5 m-0 font-mono">Official System Voucher • Ref: ${receiptNo}</p>
              </div>
              <div class="border-2 border-dashed border-sky-600 text-sky-700 px-4 py-2 rounded-xl text-center font-extrabold text-[11px] tracking-widest uppercase">
                <div>OFFICIALLY RECONCILED</div>
                <div class="text-[9px] font-normal text-sky-500 mt-0.5">BURSARY OFFICE AUDIT</div>
              </div>
            </div>

            <div class="text-center mt-6 text-[11px] text-slate-400">
              <p>Thank you for your institutional payment. Please retain this official receipt for financial clearance.</p>
            </div>

            <!-- Print Button Bottom Fallback (Shielded) -->
            <div class="btn-bar print:hidden text-center mt-6">
              <button class="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-sm transition cursor-pointer" onclick="window.print()">
                Print Official Receipt
              </button>
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
          {/* Reactive Student Search Trigger (Rule 2) */}
          <div className="md:col-span-2 bg-slate-50 dark:bg-zinc-950/60 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                Student Search (Ledger Lookup)
              </label>
              {isSearchingStudent && (
                <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Fetching ledger balance...
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. Nnamdi nwaosu"
                value={studentSearchInput}
                onChange={handleStudentSearchChange}
                onKeyDown={handleStudentSearchKeyDown}
                className="w-full pl-9 pr-24 py-2 text-sm bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => performStudentLookup(studentSearchInput)}
                disabled={isSearchingStudent || !studentSearchInput.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
              >
                Lookup
              </button>
            </div>

            {/* Search Feedback: Success Alert */}
            {studentSearchResult && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">
                  Linked <strong>{studentSearchResult.student.name}</strong> ({studentSearchResult.student.currentClass || "Enrolled"}) — Outstanding Ledger Balance: <strong>{formatNaira(studentSearchResult.ledgerBalance)}</strong>. Populated Amount Due, Due Date, and Description.
                </span>
              </div>
            )}

            {/* Search Feedback: Error Alert */}
            {studentSearchError && (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{studentSearchError}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Student</label>
            <select 
              required 
              className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" 
              value={invoiceData.studentId} 
              onChange={e => {
                const sid = e.target.value;
                setInvoiceData({...invoiceData, studentId: sid});
                if (sid) {
                  performStudentLookup(sid);
                }
              }}
            >
              <option value="" disabled>Select student ({tierStudents.length} available)...</option>
              {tierStudents.map(s => (
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
              {isolatedFeeTemplates.map(t => (
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
              placeholder={`e.g. 1st ${tierConfig.terms.periodName} ${tierConfig.terms.billingTitle}`} 
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
