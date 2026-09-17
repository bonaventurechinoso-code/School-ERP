"use client";

import React, { useState, useMemo, useTransition } from "react";
import { FeeTemplate, Student } from "@prisma/client";
import { createFeeTemplate, deleteFeeTemplate, bulkCreateInvoices } from "./actions";
import { useTenant } from "@/lib/tenant-context";
import { formatNaira } from "./FinanceDashboard";
import { 
  Users, 
  Trash2, 
  PlusCircle, 
  Layers, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Filter,
  Calculator
} from "lucide-react";

export default function FeeTemplatesList({
  hasHigherEd,
  feeTemplates,
  students,
  classrooms = [],
  schoolId,
}: {
  hasHigherEd: boolean;
  feeTemplates: FeeTemplate[];
  students: (Student & { currentClass?: string | null })[];
  classrooms?: string[];
  schoolId: string;
}) {
  const tenant = useTenant();
  const [isPending, startTransition] = useTransition();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", defaultAmount: 0, billingType: "FLAT" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Bulk Invoicing State
  const [showBulkForm, setShowBulkForm] = useState<string | null>(null);
  const [bulkData, setBulkData] = useState({ dueDate: "" });
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);

  // Filter inside bulk modal
  const [modalClassFilter, setModalClassFilter] = useState<string>("ALL");
  const [modalSearch, setModalSearch] = useState<string>("");

  // Extract all available classes
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    classrooms.forEach(c => set.add(c));
    students.forEach(s => {
      if (s.currentClass) set.add(s.currentClass);
    });
    return Array.from(set).sort();
  }, [classrooms, students]);

  // Filter students in the bulk modal
  const modalFilteredStudents = useMemo(() => {
    return students.filter(s => {
      if (modalClassFilter !== "ALL" && (s.currentClass || "Unassigned") !== modalClassFilter) {
        return false;
      }
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase().trim();
        const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
        const adm = (s.admissionNumber || "").toLowerCase();
        return fullName.includes(q) || adm.includes(q);
      }
      return true;
    });
  }, [students, modalClassFilter, modalSearch]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      const res = await createFeeTemplate(schoolId, formData);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setShowForm(false);
        setFormData({ name: "", defaultAmount: 0, billingType: "FLAT" });
      }
    });
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the fee template "${name}"?`)) return;
    startTransition(async () => {
      await deleteFeeTemplate(schoolId, id);
    });
  };

  const handleBulkInvoice = async (e: React.FormEvent, templateId: string) => {
    e.preventDefault();
    setErrorMsg(null);
    setBulkSuccessMsg(null);

    if (selectedStudents.size === 0) {
      setErrorMsg("Please select at least one student.");
      return;
    }

    startTransition(async () => {
      const res = await bulkCreateInvoices(schoolId, {
        templateId,
        studentIds: Array.from(selectedStudents),
        dueDate: bulkData.dueDate,
      });

      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setBulkSuccessMsg(`Successfully generated and dispatched ${res.count} invoices!`);
        setShowBulkForm(null);
        setSelectedStudents(new Set());
        setBulkData({ dueDate: "" });
      }
    });
  };

  const toggleStudent = (studentId: string) => {
    const newSet = new Set(selectedStudents);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setSelectedStudents(newSet);
  };

  const selectAllFiltered = () => {
    const newSet = new Set(selectedStudents);
    const allFilteredSelected = modalFilteredStudents.every(s => newSet.has(s.id));

    if (allFilteredSelected) {
      // Unselect all filtered
      modalFilteredStudents.forEach(s => newSet.delete(s.id));
    } else {
      // Select all filtered
      modalFilteredStudents.forEach(s => newSet.add(s.id));
    }
    setSelectedStudents(newSet);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Fee Schedules & Templates</h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Preconfigure standard termly rates for bulk billing and automatic ledger tagging.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-white font-semibold rounded-xl shadow-xs transition text-xs sm:text-sm cursor-pointer"
          style={{ backgroundColor: tenant.branding.primaryColor }}
        >
          {showForm ? "Cancel" : "New Fee Template"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateTemplate} className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
          {errorMsg && (
            <div className="md:col-span-2 p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-sm font-medium">
              {errorMsg}
            </div>
          )}
          {hasHigherEd && (
            <div className="md:col-span-2 flex items-center space-x-4 mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Billing Structure:</label>
              <label className="flex items-center space-x-2 text-sm cursor-pointer text-slate-700 dark:text-zinc-300">
                <input type="radio" name="billingType" checked={formData.billingType === "FLAT"} onChange={() => setFormData({...formData, billingType: "FLAT"})} className="text-indigo-600 focus:ring-indigo-500" />
                <span>Flat Termly Fee</span>
              </label>
              <label className="flex items-center space-x-2 text-sm cursor-pointer text-slate-700 dark:text-zinc-300">
                <input type="radio" name="billingType" checked={formData.billingType === "PER_CREDIT"} onChange={() => setFormData({...formData, billingType: "PER_CREDIT"})} className="text-indigo-600 focus:ring-indigo-500" />
                <span>Per Credit Unit</span>
              </label>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Fee Schedule Name</label>
            <input 
              required 
              type="text" 
              placeholder="e.g. 1st Term Tuition (Junior Secondary)" 
              className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
              {formData.billingType === "PER_CREDIT" ? "Amount Per Credit Unit (₦)" : "Fixed Amount (₦)"}
            </label>
            <input 
              required 
              type="number" 
              step="0.01" 
              className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm font-mono" 
              value={formData.defaultAmount || ""} 
              onChange={e => setFormData({ ...formData, defaultAmount: parseFloat(e.target.value) })} 
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button 
              type="button" 
              onClick={() => setShowForm(false)} 
              className="px-4 py-2.5 text-slate-600 dark:text-zinc-400 hover:text-slate-800 text-sm font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button 
              disabled={isPending} 
              type="submit" 
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl shadow-sm transition disabled:opacity-50 text-sm cursor-pointer"
            >
              {isPending ? "Saving..." : "Save Template"}
            </button>
          </div>
        </form>
      )}

      {bulkSuccessMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl shadow-sm font-medium text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{bulkSuccessMsg}</span>
          </div>
          <button onClick={() => setBulkSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {feeTemplates.length === 0 && (
          <div className="col-span-full p-12 text-center text-slate-500 dark:text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm italic text-sm">
            No fee templates created yet. Click "New Fee Template" to build tuition or fee schedules.
          </div>
        )}
        
        {feeTemplates.map(template => {
          const isBulkOpen = showBulkForm === template.id;
          const projectedTotal = selectedStudents.size * template.defaultAmount;

          return (
            <div key={template.id} className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 flex flex-col relative transition-shadow hover:shadow-md">
              <div className="absolute top-5 right-5 sm:top-6 sm:right-6">
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${template.billingType === 'PER_CREDIT' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'}`}>
                  {template.billingType === 'PER_CREDIT' ? 'Per Credit' : 'Flat Rate'}
                </span>
              </div>
              <div className="flex-1 pr-16">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{template.name}</h3>
                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 mt-2 font-mono">
                  {formatNaira(template.defaultAmount)}
                  {template.billingType === 'PER_CREDIT' && <span className="text-xs font-medium text-slate-400 tracking-normal ml-1">/ credit</span>}
                </p>
              </div>
              
              <div className="mt-5 sm:mt-6 flex gap-2">
                <button 
                  onClick={() => {
                    setShowBulkForm(isBulkOpen ? null : template.id);
                    setErrorMsg(null);
                    setBulkSuccessMsg(null);
                    setSelectedStudents(new Set());
                    setModalClassFilter("ALL");
                    setModalSearch("");
                  }}
                  className="flex-1 px-3.5 py-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold rounded-xl transition text-xs sm:text-sm text-center border border-blue-200 dark:border-blue-800/80 cursor-pointer"
                >
                  {isBulkOpen ? "Close Invoicing" : "Bulk Invoice Class"}
                </button>
                <button 
                  onClick={() => handleDeleteTemplate(template.id, template.name)}
                  disabled={isPending}
                  className="px-3 py-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold rounded-xl transition text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
                  title="Delete Template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Bulk Invoice Inline Form */}
              {isBulkOpen && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3 animate-in fade-in duration-300">
                  <form onSubmit={(e) => handleBulkInvoice(e, template.id)} className="space-y-3 sm:space-y-4">
                    {errorMsg && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-medium">
                        {errorMsg}
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase mb-1">Due Date</label>
                      <input 
                        required 
                        type="date" 
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs sm:text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100" 
                        value={bulkData.dueDate} 
                        onChange={e => setBulkData({ dueDate: e.target.value })} 
                      />
                    </div>

                    {/* Class & Search Filter Bar inside Modal */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase">Class Filter:</label>
                        <select
                          value={modalClassFilter}
                          onChange={e => setModalClassFilter(e.target.value)}
                          className="text-xs border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200"
                        >
                          <option value="ALL">All Classes ({students.length})</option>
                          {availableClasses.map(c => {
                            const count = students.filter(s => (s.currentClass || "Unassigned") === c).length;
                            return (
                              <option key={c} value={c}>
                                {c} ({count})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search student..."
                          value={modalSearch}
                          onChange={e => setModalSearch(e.target.value)}
                          className="w-full pl-8 pr-2 py-1 text-xs border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200"
                        />
                      </div>
                    </div>

                    {/* Student Selection Checklist */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5 text-xs">
                        <span className="font-semibold text-slate-600 dark:text-zinc-400">
                          Matching: {modalFilteredStudents.length}
                        </span>
                        <button 
                          type="button" 
                          onClick={selectAllFiltered} 
                          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                        >
                          Toggle All
                        </button>
                      </div>
                      
                      <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-zinc-700 rounded-xl p-2 space-y-1 bg-slate-50 dark:bg-zinc-950/50 text-xs">
                        {modalFilteredStudents.length === 0 ? (
                          <div className="p-3 text-center text-slate-400 italic">No students match filter.</div>
                        ) : (
                          modalFilteredStudents.map(student => (
                            <label key={student.id} className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={selectedStudents.has(student.id)} 
                                onChange={() => toggleStudent(student.id)} 
                                className="rounded border-slate-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="truncate flex-1">
                                {student.firstName} {student.lastName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {student.currentClass || "Unassigned"}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Projected Billing Summary */}
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 text-xs flex justify-between items-center">
                      <div>
                        <span className="text-slate-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Selected</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {selectedStudents.size} students
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Total Invoiced</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatNaira(projectedTotal)}
                        </span>
                      </div>
                    </div>

                    <button 
                      disabled={isPending || selectedStudents.size === 0} 
                      type="submit" 
                      className="w-full px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50 text-xs sm:text-sm shadow-xs cursor-pointer"
                    >
                      {isPending ? "Generating Invoices..." : `Issue ${selectedStudents.size} Invoices`}
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
