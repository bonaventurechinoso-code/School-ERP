"use client";

import React, { useState, useTransition } from "react";
import { FeeTemplate, Student } from "@prisma/client";
import { createFeeTemplate, deleteFeeTemplate, bulkCreateInvoices } from "./actions";
import { useTenant } from "@/lib/tenant-context";

export default function FeeTemplatesList({
  hasHigherEd,
  feeTemplates,
  students,
  schoolId,
}: {
  hasHigherEd: boolean;
  feeTemplates: FeeTemplate[];
  students: Student[];
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

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fee template?")) return;
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
        setBulkSuccessMsg(`Successfully created ${res.count} invoices!`);
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

  const selectAllStudents = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set()); // deselect all
    } else {
      setSelectedStudents(new Set(students.map(s => s.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-white font-medium rounded-lg shadow-sm transition"
          style={{ backgroundColor: tenant.branding.primaryColor }}
        >
          {showForm ? "Cancel" : "New Fee Template"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateTemplate} className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          {errorMsg && (
            <div className="md:col-span-2 p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-sm font-medium">
              {errorMsg}
            </div>
          )}
          {hasHigherEd && (
            <div className="md:col-span-2 flex items-center space-x-4 mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Billing Type:</label>
              <label className="flex items-center space-x-2 text-sm cursor-pointer text-slate-700 dark:text-zinc-300">
                <input type="radio" name="billingType" checked={formData.billingType === "FLAT"} onChange={() => setFormData({...formData, billingType: "FLAT"})} className="text-indigo-600 focus:ring-indigo-500" />
                <span>Flat Fee</span>
              </label>
              <label className="flex items-center space-x-2 text-sm cursor-pointer text-slate-700 dark:text-zinc-300">
                <input type="radio" name="billingType" checked={formData.billingType === "PER_CREDIT"} onChange={() => setFormData({...formData, billingType: "PER_CREDIT"})} className="text-indigo-600 focus:ring-indigo-500" />
                <span>Per Credit Unit</span>
              </label>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Fee Name</label>
            <input required type="text" placeholder="e.g. Annual Tuition" className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
              {formData.billingType === "PER_CREDIT" ? "Amount Per Credit Unit ($)" : "Fixed Fee Amount ($)"}
            </label>
            <input required type="number" step="0.01" className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-sm" value={formData.defaultAmount || ""} onChange={e => setFormData({ ...formData, defaultAmount: parseFloat(e.target.value) })} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button disabled={isPending} type="submit" className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl shadow-sm transition disabled:opacity-50 text-sm">
              Save Template
            </button>
          </div>
        </form>
      )}

      {bulkSuccessMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl shadow-sm font-medium text-sm">
          {bulkSuccessMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {feeTemplates.length === 0 && (
          <div className="col-span-full p-8 text-center text-slate-500 dark:text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm italic text-sm">
            No fee templates found. Create one to easily generate invoices.
          </div>
        )}
        
        {feeTemplates.map(template => (
          <div key={template.id} className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 flex flex-col relative transition-shadow hover:shadow-md">
            <div className="absolute top-5 right-5 sm:top-6 sm:right-6">
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${template.billingType === 'PER_CREDIT' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'}`}>
                {template.billingType === 'PER_CREDIT' ? 'Per Credit' : 'Flat Fee'}
              </span>
            </div>
            <div className="flex-1 pr-16">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{template.name}</h3>
              <p className="text-xl sm:text-2xl font-black text-slate-700 dark:text-zinc-300 mt-2 font-mono">
                ${template.defaultAmount.toFixed(2)}
                {template.billingType === 'PER_CREDIT' && <span className="text-xs font-medium text-slate-400 tracking-normal ml-1">/ credit</span>}
              </p>
            </div>
            
            <div className="mt-5 sm:mt-6 flex gap-2">
              <button 
                onClick={() => {
                  setShowBulkForm(showBulkForm === template.id ? null : template.id);
                  setErrorMsg(null);
                  setBulkSuccessMsg(null);
                }}
                className="flex-1 px-3.5 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold rounded-xl transition text-xs sm:text-sm text-center"
              >
                Bulk Invoice
              </button>
              <button 
                onClick={() => handleDeleteTemplate(template.id)}
                disabled={isPending}
                className="px-3.5 py-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold rounded-xl transition text-xs sm:text-sm disabled:opacity-50"
              >
                Delete
              </button>
            </div>

            {/* Bulk Invoice Inline Form */}
            {showBulkForm === template.id && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <form onSubmit={(e) => handleBulkInvoice(e, template.id)} className="space-y-3 sm:space-y-4">
                  {errorMsg && (
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-medium">
                      {errorMsg}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase mb-1">Due Date</label>
                    <input required type="date" className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs sm:text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100" value={bulkData.dueDate} onChange={e => setBulkData({ dueDate: e.target.value })} />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase">Select Students</label>
                      <button type="button" onClick={selectAllStudents} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                        {selectedStudents.size === students.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-zinc-700 rounded-xl p-2 space-y-1 bg-slate-50 dark:bg-zinc-950/50 text-xs sm:text-sm">
                      {students.map(student => (
                        <label key={student.id} className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={selectedStudents.has(student.id)} 
                            onChange={() => toggleStudent(student.id)} 
                            className="rounded border-slate-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="truncate">{student.firstName} {student.lastName}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button disabled={isPending || selectedStudents.size === 0} type="submit" className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 text-xs sm:text-sm shadow-sm">
                    Create {selectedStudents.size} Invoices
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
