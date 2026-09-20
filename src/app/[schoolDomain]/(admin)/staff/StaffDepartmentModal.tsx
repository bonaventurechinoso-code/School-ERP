"use client";

import React, { useState, useTransition } from "react";
import { X, Building2, Plus, Trash2, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { createStaffDepartmentAction, deleteStaffDepartmentAction } from "./actions";

export interface StaffDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: any[];
  schoolDomain: string;
  schoolId: string;
  onDepartmentChanged?: () => void;
}

export default function StaffDepartmentModal({
  isOpen,
  onClose,
  departments,
  schoolDomain,
  schoolId,
  onDepartmentChanged,
}: StaffDepartmentModalProps) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setAlertMsg(null);
    startTransition(async () => {
      const res = await createStaffDepartmentAction(schoolDomain, name.trim());
      if (res.success) {
        setAlertMsg({ type: "success", text: `Department "${name}" created successfully.` });
        setName("");
        if (onDepartmentChanged) onDepartmentChanged();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to create department." });
      }
    });
  };

  const handleDelete = (deptId: string, deptName: string) => {
    if (!confirm(`Are you sure you want to delete department "${deptName}"?`)) return;

    setAlertMsg(null);
    startTransition(async () => {
      const res = await deleteStaffDepartmentAction(schoolDomain, deptId);
      if (res.success) {
        setAlertMsg({ type: "success", text: `Department "${deptName}" removed.` });
        if (onDepartmentChanged) onDepartmentChanged();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to delete department." });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black">Staff Units & Academic Departments</h3>
              <p className="text-xs text-slate-400">Group teaching and non-teaching staff into academic units.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ALERT MSG */}
        {alertMsg && (
          <div className={`p-3 text-xs font-semibold flex items-center gap-2 ${
            alertMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200" : "bg-red-50 text-red-800 border-b border-red-200"
          }`}>
            {alertMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{alertMsg.text}</span>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* CREATE FORM */}
          <form onSubmit={handleCreate} className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Create New Unit / Department
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Science & Technology, Humanities, Administration"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-slate-300 rounded-xl p-2.5 text-xs flex-1 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                required
              />
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>{isPending ? "Adding..." : "Add"}</span>
              </button>
            </div>
          </form>

          {/* DEPARTMENTS ROSTER */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Departments ({departments.length})
            </h4>
            {departments.length > 0 ? (
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
                {departments.map((dept) => {
                  const staffCount = dept._count?.staff ?? dept.staff?.length ?? 0;
                  return (
                    <div key={dept.id} className="p-3 flex items-center justify-between hover:bg-white transition text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{dept.name}</p>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>{staffCount} staff assigned</span>
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(dept.id, dept.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete Department"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                No academic departments configured yet. Add your first department above.
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
