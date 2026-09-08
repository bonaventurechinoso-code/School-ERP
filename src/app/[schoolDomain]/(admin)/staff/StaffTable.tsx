"use client";

import React, { useState, useTransition } from "react";
import { Staff } from "@prisma/client";
import { createStaff, updateStaff, deleteStaff, updateStaffStatus } from "./actions";
import { useTenant } from "@/lib/tenant-context";

export default function StaffTable({ 
  staffList, 
  schoolId 
}: { 
  staffList: Staff[], 
  schoolId: string 
}) {
  const [isPending, startTransition] = useTransition();
  const tenant = useTenant();

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
    if (confirm("Are you sure you want to delete this staff member? This action cannot be undone.")) {
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
    switch (role) {
      case "TEACHER":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">TEACHER</span>;
      case "ADMIN":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">ADMIN</span>;
      case "SUPPORT":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">SUPPORT</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800">{role}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button 
          onClick={showForm ? () => setShowForm(false) : openCreateForm}
          className="px-4 py-2 text-white font-medium rounded-lg shadow-sm transition"
          style={{ backgroundColor: tenant.branding.primaryColor }}
        >
          {showForm ? "Cancel" : "Add Staff Member"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-slate-800">
              {editingStaffId ? "Edit Staff Member" : "New Staff Member"}
            </h3>
          </div>
          {errorMsg && (
            <div className="md:col-span-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
            <input required type="text" className="w-full border border-slate-300 rounded-lg p-2" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
            <input required type="text" className="w-full border border-slate-300 rounded-lg p-2" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input required type="email" className="w-full border border-slate-300 rounded-lg p-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select className="w-full border border-slate-300 rounded-lg p-2" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Administrator</option>
              <option value="SUPPORT">Support Staff</option>
            </select>
          </div>
          {!editingStaffId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select className="w-full border border-slate-300 rounded-lg p-2" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="ONBOARDING">Onboarding</option>
                <option value="ACTIVE">Active</option>
              </select>
            </div>
          )}
          <div className="md:col-span-2 flex justify-end mt-2">
            <button disabled={isPending} type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50">
              {editingStaffId ? "Update Staff" : "Save Staff"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-6 py-4 font-semibold">Staff Name</th>
              <th className="px-6 py-4 font-semibold">Email</th>
              <th className="px-6 py-4 font-semibold">Role</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staffList.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-lg">
                  No staff members found in the directory.
                </td>
              </tr>
            )}
            {staffList.map((staff) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
