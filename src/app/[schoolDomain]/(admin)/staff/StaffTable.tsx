"use client";

import React, { useState, useTransition } from "react";
import { Staff } from "@prisma/client";
import { createStaff, updateStaff, deleteStaff, updateStaffStatus, fetchStaffPaginated } from "./actions";
import { useTenant } from "@/lib/tenant-context";

export default function StaffTable({ 
  staffList, 
  initialNextCursor,
  initialHasMore,
  schoolId 
}: { 
  staffList: Staff[];
  initialNextCursor?: string | null;
  initialHasMore?: boolean;
  schoolId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const tenant = useTenant();

  const [currentStaff, setCurrentStaff] = useState<Staff[]>(staffList);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore ?? false);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const [showForm, setShowForm] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", role: "TEACHER", status: "ONBOARDING" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openCreateForm = () => {
    setEditingStaffId(null);
    setFormData({ firstName: "", lastName: "", email: "", role: "TEACHER", status: "ONBOARDING" });
    setShowForm(true);
  };

  const openEditForm = (staff: Staff) => {
    setEditingStaffId(staff.id);
    setFormData({ 
      firstName: staff.firstName, 
      lastName: staff.lastName, 
      email: staff.email, 
      role: staff.role, 
      status: staff.status 
    });
    setShowForm(true);
  };

  const handleNextPage = () => {
    if (!nextCursor || isPending) return;
    const currentCursor = nextCursor;
    startTransition(async () => {
      const res = await fetchStaffPaginated(schoolId, {
        cursor: currentCursor,
        limit: 25,
      });
      setCursorHistory(prev => [...prev, currentCursor]);
      setCurrentStaff(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setPageIndex(prev => prev + 1);
    });
  };

  const handlePrevPage = () => {
    if (pageIndex === 0 || isPending) return;
    const newHistory = [...cursorHistory];
    newHistory.pop();
    const targetCursor = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
    startTransition(async () => {
      const res = await fetchStaffPaginated(schoolId, {
        cursor: targetCursor,
        limit: 25,
      });
      setCursorHistory(newHistory);
      setCurrentStaff(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setPageIndex(prev => Math.max(0, prev - 1));
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      let res;
      if (editingStaffId) {
        res = await updateStaff(schoolId, editingStaffId, formData);
      } else {
        res = await createStaff(schoolId, formData);
      }
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setShowForm(false);
        setEditingStaffId(null);
        setFormData({ firstName: "", lastName: "", email: "", role: "TEACHER", status: "ONBOARDING" });
      }
    });
  };

  const handleDelete = async (staffId: string) => {
    if (confirm("Are you sure you want to remove this staff member?")) {
      startTransition(async () => {
        const res = await deleteStaff(schoolId, staffId);
        if (res?.error) {
          alert(res.error);
        }
      });
    }
  };

  const handleUpdateStatus = (staffId: string, newStatus: string) => {
    startTransition(() => {
      updateStaffStatus(schoolId, staffId, newStatus);
    });
  };

  const renderRole = (role: string) => {
    const roleMap: Record<string, string> = {
      TEACHER: tenant.institutionType === "HIGHER_ED" ? "Faculty / Lecturer" : "Teacher",
      ADMIN: "Administrator",
    };
    return roleMap[role] || role;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">All Staff Members</h3>
        <button 
          onClick={openCreateForm}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition shadow-sm"
        >
          Add Staff Member
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in duration-300">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">First Name</label>
            <input 
              type="text" 
              required
              className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-indigo-500"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Last Name</label>
            <input 
              type="text" 
              required
              className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-indigo-500"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-indigo-500"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Role</label>
            <select 
              className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-indigo-500 bg-white"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="TEACHER">{tenant.institutionType === "HIGHER_ED" ? "Faculty / Lecturer" : "Teacher"}</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          {errorMsg && <p className="col-span-full text-red-500 text-sm font-medium">{errorMsg}</p>}
          <div className="col-span-full flex justify-end space-x-2">
            <button 
              type="button" 
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
            >
              {isPending ? "Saving..." : (editingStaffId ? "Update Staff" : "Save Staff")}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold text-xs uppercase tracking-wider">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentStaff.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                  No staff members found.
                </td>
              </tr>
            ) : (
              currentStaff.map((staff) => (
                <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {staff.firstName} {staff.lastName}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{staff.email}</td>
                  <td className="px-6 py-4">{renderRole(staff.role)}</td>
                  <td className="px-6 py-4">
                    <select 
                      disabled={isPending}
                      value={staff.status}
                      onChange={(e) => handleUpdateStatus(staff.id, e.target.value)}
                      className={`border border-slate-300 rounded-lg p-1.5 text-xs font-bold outline-none transition-colors
                        ${staff.status === "ACTIVE" ? "bg-green-100 text-green-700 border-green-200" : ""}
                        ${staff.status === "ONBOARDING" ? "bg-yellow-100 text-yellow-700 border-yellow-200" : ""}
                        ${staff.status === "LEAVE" ? "bg-blue-100 text-blue-700 border-blue-200" : ""}
                        ${staff.status === "OFFBOARDED" ? "bg-gray-100 text-gray-700 border-gray-200" : ""}
                      `}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="ONBOARDING">Onboarding</option>
                      <option value="LEAVE">On Leave</option>
                      <option value="OFFBOARDED">Offboarded</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      disabled={isPending}
                      onClick={() => openEditForm(staff)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 transition"
                    >
                      Edit
                    </button>
                    <button 
                      disabled={isPending}
                      onClick={() => handleDelete(staff.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-800 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cursor Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 border-t border-slate-100 text-sm">
        <div className="text-slate-500 dark:text-zinc-400 font-medium">
          Showing <span className="font-bold text-slate-800 dark:text-zinc-200">{currentStaff.length}</span> staff members on Page {pageIndex + 1}
          {isPending && <span className="ml-2 text-xs text-indigo-600 font-bold animate-pulse">Scanning indexed cursor...</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pageIndex === 0 || isPending}
            onClick={handlePrevPage}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
          >
            &larr; Previous Page
          </button>
          <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-600">
            Page {pageIndex + 1}
          </span>
          <button
            type="button"
            disabled={!hasMore || isPending}
            onClick={handleNextPage}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
          >
            Next Page &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
