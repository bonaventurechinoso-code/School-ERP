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
        <form onSubmit={handleCreateTemplate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          {errorMsg && (
            <div className="md:col-span-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
              {errorMsg}
            </div>
          )}
          {hasHigherEd && (
            <div className="md:col-span-2 flex items-center space-x-4 mb-2">
              <label className="text-sm font-medium text-slate-700">Billing Type:</label>
              <label className="flex items-center space-x-2 text-sm cursor-pointer">
                <input type="radio" name="billingType" checked={formData.billingType === "FLAT"} onChange={() => setFormData({...formData, billingType: "FLAT"})} className="text-blue-600 focus:ring-blue-500" />
                <span>Flat Fee</span>
              </label>
              <label className="flex items-center space-x-2 text-sm cursor-pointer">
                <input type="radio" name="billingType" checked={formData.billingType === "PER_CREDIT"} onChange={() => setFormData({...formData, billingType: "PER_CREDIT"})} className="text-blue-600 focus:ring-blue-500" />
                <span>Per Credit Unit</span>
              </label>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fee Name</label>
            <input required type="text" placeholder="e.g. Annual Tuition" className="w-full border border-slate-300 rounded-lg p-2" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {formData.billingType === "PER_CREDIT" ? "Amount Per Credit Unit ($)" : "Fixed Fee Amount ($)"}
            </label>
            <input required type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-2" value={formData.defaultAmount || ""} onChange={e => setFormData({ ...formData, defaultAmount: parseFloat(e.target.value) })} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button disabled={isPending} type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50">
              Save Template
            </button>
          </div>
        </form>
      )}

      {bulkSuccessMsg && (
        <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-2xl shadow-sm font-medium">
          {bulkSuccessMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {feeTemplates.length === 0 && (
          <div className="col-span-full p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
            No fee templates found. Create one to easily generate invoices.
          </div>
        )}
        
        {feeTemplates.map(template => (
          <div key={template.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col relative">
            <div className="absolute top-6 right-6">
              <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider ${template.billingType === 'PER_CREDIT' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                {template.billingType === 'PER_CREDIT' ? 'Per Credit' : 'Flat Fee'}
              </span>
            </div>
            <div className="flex-1 pr-20">
              <h3 className="text-xl font-bold text-slate-800">{template.name}</h3>
              <p className="text-2xl font-black text-slate-500 mt-2">
                ${template.defaultAmount.toFixed(2)}
                {template.billingType === 'PER_CREDIT' && <span className="text-sm font-medium text-slate-400 tracking-normal ml-1">/ credit</span>}
              </p>
            </div>
            
            <div className="mt-6 flex gap-2">
              <button 
                onClick={() => {
                  setShowBulkForm(showBulkForm === template.id ? null : template.id);
                  setErrorMsg(null);
                  setBulkSuccessMsg(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition text-sm text-center"
              >
                Bulk Invoice
              </button>
              <button 
                onClick={() => handleDeleteTemplate(template.id)}
                disabled={isPending}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg transition text-sm disabled:opacity-50"
              >
                Delete
              </button>
            </div>

            {/* Bulk Invoice Inline Form */}
            {showBulkForm === template.id && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <form onSubmit={(e) => handleBulkInvoice(e, template.id)} className="space-y-4">
                  {errorMsg && (
                    <div className="p-2 bg-red-50 text-red-700 rounded text-xs font-medium">
                      {errorMsg}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Due Date</label>
                    <input required type="date" className="w-full border border-slate-300 rounded p-2 text-sm" value={bulkData.dueDate} onChange={e => setBulkData({ dueDate: e.target.value })} />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase">Select Students</label>
                      <button type="button" onClick={selectAllStudents} className="text-xs text-blue-600 hover:underline">
                        {selectedStudents.size === students.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-2 space-y-1 bg-slate-50">
                      {students.map(student => (
                        <label key={student.id} className="flex items-center gap-2 text-sm text-slate-700 p-1 hover:bg-slate-100 rounded cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={selectedStudents.has(student.id)} 
                            onChange={() => toggleStudent(student.id)} 
                            className="rounded text-blue-600"
                          />
                          {student.firstName} {student.lastName}
                        </label>
                      ))}
                    </div>
                  </div>

                  <button disabled={isPending || selectedStudents.size === 0} type="submit" className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition disabled:opacity-50 text-sm">
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
