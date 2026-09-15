"use client";

import React, { useState, useTransition, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Staff } from "@prisma/client";
import { createStaff, updateStaff, deleteStaff, updateStaffStatus, fetchStaffPaginated } from "./actions";
import { useTenant } from "@/lib/tenant-context";
import {
  StaffTierCategory,
  resolveStaffTierCategory,
  getRolesForTier,
  getDefaultRoleForTier,
  getStaffTierBadgeLabel,
  TERTIARY_ACADEMIC_STAFF_ROLES,
  TERTIARY_NON_ACADEMIC_STAFF_ROLES,
} from "@/lib/staff-roles-config";

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
  const searchParams = useSearchParams();
  const paramTier = searchParams.get("tier");

  // Dynamically resolve active tier category from URL query param, tenant context, or institution type
  const tierCategory: StaffTierCategory = useMemo(() => {
    return resolveStaffTierCategory(
      paramTier || (tenant as any)?.activeTier || tenant.preciseTier || (tenant.institutionType === "HIGHER_ED" ? "TERTIARY" : "PRIMARY")
    );
  }, [paramTier, (tenant as any)?.activeTier, tenant.preciseTier, tenant.institutionType]);

  const activeRolesList = useMemo(() => getRolesForTier(tierCategory), [tierCategory]);
  const defaultRole = useMemo(() => getDefaultRoleForTier(tierCategory), [tierCategory]);
  const tierBadgeLabel = useMemo(() => getStaffTierBadgeLabel(tierCategory), [tierCategory]);
  const isTertiary = tierCategory === "TERTIARY";

  const [currentStaff, setCurrentStaff] = useState<Staff[]>(staffList);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore ?? false);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [showForm, setShowForm] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    firstName: "", 
    lastName: "", 
    email: "", 
    role: defaultRole, 
    status: "ONBOARDING" 
  });
  const [customRole, setCustomRole] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // CRITICAL UX FIX:
  // When changing the active Academic Tier on the sidebar, wipe clean and recalculate Role dropdown states.
  // This prevents assigning a 'Professor' role while inside the Primary School tier interface.
  const prevTierRef = useRef<StaffTierCategory>(tierCategory);

  useEffect(() => {
    if (prevTierRef.current !== tierCategory) {
      prevTierRef.current = tierCategory;
      const newDefault = getDefaultRoleForTier(tierCategory);
      // 1. Wipe clean the Filter Role selection
      setFilterRole("ALL");
      // 2. Wipe clean and recalculate the form role to the active tier's valid default
      setFormData((prev) => ({
        ...prev,
        role: newDefault,
      }));
      setCustomRole("");
      // 3. Reset form states so invalid roles from previous tier are never committed
      setShowForm(false);
      setEditingStaffId(null);
      setErrorMsg(null);
      // 4. Reset pagination and re-fetch roster for the active tier
      setPageIndex(0);
      setCursorHistory([]);
      startTransition(async () => {
        const res = await fetchStaffPaginated(schoolId, { limit: 25 });
        if (res?.items) {
          setCurrentStaff(res.items);
          setNextCursor(res.nextCursor);
          setHasMore(res.hasMore);
        }
      });
    }
  }, [tierCategory, schoolId]);

  const openCreateForm = () => {
    setEditingStaffId(null);
    setFormData({ 
      firstName: "", 
      lastName: "", 
      email: "", 
      role: defaultRole, 
      status: "ONBOARDING" 
    });
    setCustomRole("");
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEditForm = (staff: Staff) => {
    setEditingStaffId(staff.id);
    const isStandardRole = staff.role && activeRolesList.includes(staff.role as any);
    if (isStandardRole) {
      setFormData({ 
        firstName: staff.firstName, 
        lastName: staff.lastName, 
        email: staff.email, 
        role: staff.role, 
        status: staff.status 
      });
      setCustomRole("");
    } else {
      setFormData({ 
        firstName: staff.firstName, 
        lastName: staff.lastName, 
        email: staff.email, 
        role: "Other (Type Custom Role...)", 
        status: staff.status 
      });
      setCustomRole(staff.role || "");
    }
    setErrorMsg(null);
    setShowForm(true);
  };

  const handleFilterRoleChange = (newRole: string) => {
    setFilterRole(newRole);
    setPageIndex(0);
    setCursorHistory([]);
    startTransition(async () => {
      const res = await fetchStaffPaginated(schoolId, {
        role: newRole !== "ALL" ? newRole : undefined,
        limit: 25,
      });
      if (res?.items) {
        setCurrentStaff(res.items);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      }
    });
  };

  const handleNextPage = () => {
    if (!nextCursor || isPending) return;
    const currentCursor = nextCursor;
    startTransition(async () => {
      const res = await fetchStaffPaginated(schoolId, {
        cursor: currentCursor,
        limit: 25,
        role: filterRole !== "ALL" ? filterRole : undefined,
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
        role: filterRole !== "ALL" ? filterRole : undefined,
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

    // Resolve the final role: if 'Other (Type Custom Role...)' was chosen, use the manual text input
    let finalRole = formData.role;
    if (formData.role === "Other (Type Custom Role...)") {
      const trimmedCustom = customRole.trim();
      if (!trimmedCustom) {
        setErrorMsg("Please enter a custom staff role.");
        return;
      }
      finalRole = trimmedCustom;
    }

    const payload = {
      ...formData,
      role: finalRole,
    };

    startTransition(async () => {
      let res;
      if (editingStaffId) {
        res = await updateStaff(schoolId, editingStaffId, payload);
      } else {
        res = await createStaff(schoolId, payload);
      }
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setShowForm(false);
        setEditingStaffId(null);
        setCustomRole("");
        setFormData({ 
          firstName: "", 
          lastName: "", 
          email: "", 
          role: defaultRole, 
          status: "ONBOARDING" 
        });
        const refreshed = await fetchStaffPaginated(schoolId, {
          role: filterRole !== "ALL" ? filterRole : undefined,
          limit: 25,
        });
        if (refreshed?.items) {
          setCurrentStaff(refreshed.items);
          setNextCursor(refreshed.nextCursor);
          setHasMore(refreshed.hasMore);
        }
      }
    });
  };

  const handleDelete = async (staffId: string) => {
    if (confirm("Are you sure you want to remove this staff member?")) {
      startTransition(async () => {
        const res = await deleteStaff(schoolId, staffId);
        if (res?.error) {
          alert(res.error);
        } else {
          setCurrentStaff(prev => prev.filter(s => s.id !== staffId));
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
    if (!role) return "Staff Member";
    const legacyMap: Record<string, string> = {
      TEACHER: isTertiary ? "Lecturer" : "Class Teacher",
      ADMIN: "Administrator",
    };
    return legacyMap[role] || role;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-800">All Staff Members</h3>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            {tierBadgeLabel}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Dynamic Filter / Edit Role List */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Filter by Role:
            </label>
            <select
              value={filterRole}
              onChange={(e) => handleFilterRoleChange(e.target.value)}
              disabled={isPending}
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-indigo-500 bg-white shadow-xs"
            >
              <option value="ALL">All Roles ({activeRolesList.length})</option>
              {isTertiary ? (
                <>
                  <optgroup label="Academic Staff Roles">
                    {TERTIARY_ACADEMIC_STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Non-Academic Staff Roles">
                    {TERTIARY_NON_ACADEMIC_STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                </>
              ) : (
                activeRolesList.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))
              )}
            </select>
          </div>

          <button 
            onClick={openCreateForm}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition shadow-sm"
          >
            Add Staff Member
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in duration-300">
          <div className="col-span-full flex items-center justify-between pb-2 border-b border-slate-200">
            <h4 className="text-sm font-bold text-slate-800">
              {editingStaffId ? "Edit Staff Member Role & Profile" : "Add Staff Member"}
            </h4>
            <span className="text-xs font-medium text-slate-500">
              Active Tier: <strong className="text-indigo-600">{tierBadgeLabel}</strong>
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">First Name</label>
            <input 
              type="text" 
              required
              className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-indigo-500 bg-white"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Last Name</label>
            <input 
              type="text" 
              required
              className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-indigo-500 bg-white"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-indigo-500 bg-white"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Role
            </label>
            <select 
              className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-indigo-500 bg-white font-medium"
              value={formData.role}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ ...formData, role: val });
                if (val !== "Other (Type Custom Role...)") {
                  setCustomRole("");
                }
              }}
              required
            >
              <option value="" disabled>-- Select Role --</option>
              {isTertiary ? (
                <>
                  <optgroup label="Academic Staff Roles">
                    {TERTIARY_ACADEMIC_STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Non-Academic Staff Roles">
                    {TERTIARY_NON_ACADEMIC_STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                </>
              ) : (
                activeRolesList.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))
              )}
              {/* Option at very bottom to specify custom role */}
              <option value="Other (Type Custom Role...)" className="font-semibold text-indigo-600">
                Other (Type Custom Role...)
              </option>
            </select>

            {/* Conditional Manual Text Input for Custom Role */}
            {formData.role === "Other (Type Custom Role...)" && (
              <div className="mt-2">
                <input
                  type="text"
                  id="custom-staff-role-input"
                  name="customStaffRole"
                  required
                  autoFocus
                  placeholder="Enter custom staff role..."
                  value={customRole || ""}
                  onChange={(e) => setCustomRole(e.target.value)}
                  className="w-full border border-indigo-300 focus:border-indigo-500 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium placeholder:text-slate-400 text-slate-800 cursor-text"
                />
              </div>
            )}
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
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition font-semibold"
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
                  No staff members found for the active filter.
                </td>
              </tr>
            ) : (
              currentStaff.map((staff) => (
                <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {staff.firstName} {staff.lastName}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{staff.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                      {renderRole(staff.role)}
                    </span>
                  </td>
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
          {isPending && <span className="ml-2 text-xs text-indigo-600 font-bold animate-pulse">Updating roster...</span>}
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
