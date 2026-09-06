"use client";

import React, { useState, useTransition } from "react";
import { Student, AcademicTier } from "@prisma/client";
import { createStudent, updateStudent, deleteStudent, updateStudentStatus, bulkGraduateClass, bulkGraduateStudents } from "./actions";
import { useTenant } from "@/lib/tenant-context";
import StudentProfileDrawer from "./StudentProfileDrawer";

type StudentWithTier = Student & { tier?: AcademicTier | null, isLead?: boolean };

export default function StudentTable({ 
  students, 
  schoolId,
  tiers
}: { 
  students: StudentWithTier[], 
  schoolId: string,
  tiers: AcademicTier[]
}) {
  const [isPending, startTransition] = useTransition();
  const tenant = useTenant();

  const [showForm, setShowForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithTier | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [showBulkGraduate, setShowBulkGraduate] = useState(false);
  const [bulkClass, setBulkClass] = useState("");
  const [formData, setFormData] = useState({ 
    firstName: "", 
    lastName: "", 
    email: "", 
    status: "ENROLLED", 
    tierId: "", 
    parentName: "",
    parentPhone: "",
    dynamicFields: {} as Record<string, string> 
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<string>("ENROLLED");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const openCreateForm = () => {
    setEditingStudentId(null);
    setFormData({ 
      firstName: "", 
      lastName: "", 
      email: "", 
      status: "ENROLLED", 
      tierId: tiers.length > 0 ? tiers[0].id : "", 
      parentName: "",
      parentPhone: "",
      dynamicFields: {} 
    });
    setShowForm(true);
  };

  const openEditForm = (student: StudentWithTier) => {
    setEditingStudentId(student.id);
    let parsedFields = {};
    if (student.dynamicFields && typeof student.dynamicFields === "object") {
      parsedFields = student.dynamicFields;
    }
    setFormData({ 
      firstName: student.firstName, 
      lastName: student.lastName, 
      email: student.email || "", 
      status: student.status,
      tierId: student.tierId,
      parentName: student.parentName || "",
      parentPhone: student.parentPhone || "",
      dynamicFields: parsedFields
    });
    setShowForm(true);
  };

  const handleDynamicFieldChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      dynamicFields: { ...prev.dynamicFields, [key]: value }
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      const payload = {
        ...formData,
        dynamicFields: formData.dynamicFields
      };
      
      let res;
      if (editingStudentId) {
        res = await updateStudent(schoolId, editingStudentId, payload);
      } else {
        res = await createStudent(schoolId, payload);
      }
      
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setShowForm(false);
        setEditingStudentId(null);
      }
    });
  };

  const handleDelete = async (studentId: string) => {
    if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
      startTransition(async () => {
        const res = await deleteStudent(schoolId, studentId);
        if (res?.error) {
          alert(res.error);
        }
      });
    }
  };

  const handleUpdateStatus = (studentId: string, newStatus: string) => {
    startTransition(() => {
      updateStudentStatus(schoolId, studentId, newStatus);
    });
  };

  const filteredStudents = students.filter(s => {
    if (filterStatus !== "ALL" && s.status !== filterStatus) return false;
    if (filterStatus === "ALL" && s.status === "ALUMNI") return false;
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map(s => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkGraduate = async () => {
    if (selectedIds.length > 0) {
      if (confirm(`Are you sure you want to graduate ${selectedIds.length} selected students?`)) {
        startTransition(async () => {
          const res = await bulkGraduateStudents(schoolId, selectedIds);
          if (res?.error) alert(res.error);
          else {
            setShowBulkGraduate(false);
            setSelectedIds([]);
          }
        });
      }
    } else {
      if (!bulkClass) return;
      if (confirm(`Are you sure you want to graduate all students in ${bulkClass}?`)) {
        startTransition(async () => {
          const res = await bulkGraduateClass(schoolId, bulkClass);
          if (res?.error) alert(res.error);
          else setShowBulkGraduate(false);
        });
      }
    }
  };

  // Dynamic field definitions based on Tier keywords
  const getDynamicFieldsForTier = (tierId: string) => {
    const tier = tiers.find(t => t.id === tierId);
    if (!tier) return [];
    
    const name = tier.name.toLowerCase();
    if (name.includes("daycare") || name.includes("nursery")) {
      return [
        { key: "pottyTrained", label: "Potty Trained?", type: "select", options: ["Yes", "No", "In Progress"] },
        { key: "allergies", label: "Allergies", type: "text" }
      ];
    }
    if (name.includes("high") || name.includes("secondary")) {
      return [
        { key: "previousSchool", label: "Previous School", type: "text" },
        { key: "extracurricular", label: "Extracurricular Interests", type: "text" }
      ];
    }
    if (name.includes("higher") || name.includes("university") || name.includes("college")) {
      return [
        { key: "previousDegree", label: "Previous Degree", type: "text" },
        { key: "major", label: "Declared Major/Program", type: "text" }
      ];
    }
    // Default elementary/middle
    return [
      { key: "medicalNotes", label: "Medical Notes", type: "text" }
    ];
  };

  const currentDynamicFields = getDynamicFieldsForTier(formData.tierId);

  const selectedTier = tiers.find(t => t.id === formData.tierId);
  const isNursery = selectedTier && (selectedTier.name.toLowerCase().includes("daycare") || selectedTier.name.toLowerCase().includes("nursery") || selectedTier.name.toLowerCase().includes("early care"));

  let bulkActionLabel = "Graduate Selected";
  let bulkActionGlobalLabel = "Graduate Class";
  if (filterStatus === "PROSPECT" || filterStatus === "APPLICANT") {
    bulkActionLabel = "Approve Selected Applications";
    bulkActionGlobalLabel = "Approve Applications";
  } else if (filterStatus === "SUSPENDED") {
    bulkActionLabel = "Reinstate Selected Students";
    bulkActionGlobalLabel = "Reinstate Students";
  }

  const currentBulkLabel = selectedIds.length > 0 ? `${bulkActionLabel} (${selectedIds.length})` : bulkActionGlobalLabel;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Filter by Status:</label>
          <select 
            className="border border-slate-300 rounded-lg p-2 text-sm bg-white min-w-[200px]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ENROLLED">Enrolled</option>
            <option value="PROSPECT">Prospect</option>
            <option value="APPLICANT">Applicant</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ALUMNI">Alumni</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowBulkGraduate(true)}
            className="px-4 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg shadow-sm hover:bg-slate-300 transition"
          >
            {currentBulkLabel}
          </button>
          <button 
            onClick={showForm ? () => setShowForm(false) : openCreateForm}
            className="px-4 py-2 text-white font-medium rounded-lg shadow-sm transition"
            style={{ backgroundColor: tenant.branding.primaryColor }}
          >
            {showForm ? "Cancel" : "Add Student"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-slate-800">
              {editingStudentId ? "Edit Student" : "New Student"}
            </h3>
          </div>
          {errorMsg && (
            <div className="md:col-span-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
              {errorMsg}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Academic Tier *</label>
            <select 
              required
              className="w-full border border-slate-300 rounded-lg p-2" 
              value={formData.tierId} 
              onChange={e => {
                setFormData({...formData, tierId: e.target.value, dynamicFields: {}});
              }}
            >
              <option value="" disabled>Select a Tier</option>
              {tiers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {!editingStudentId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select className="w-full border border-slate-300 rounded-lg p-2" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="PROSPECT">Prospect</option>
                <option value="APPLICANT">Applicant</option>
                <option value="SCREENED">Screened</option>
                <option value="ENROLLED">Enrolled</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="EXPELLED">Expelled</option>
                <option value="ALUMNI">Alumni</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
            <input required type="text" className="w-full border border-slate-300 rounded-lg p-2" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
            <input required type="text" className="w-full border border-slate-300 rounded-lg p-2" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" className="w-full border border-slate-300 rounded-lg p-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          
          {/* Parent & Emergency Contact (Nursery Only) */}
          {isNursery && (
            <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">👪 Parent & Emergency Contact Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Guardian Full Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Ike Mmadu"
                    className="w-full border border-slate-300 rounded-lg p-2" 
                    value={formData.parentName} 
                    onChange={e => setFormData({...formData, parentName: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Relationship to Child</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.dynamicFields.relationship || ""}
                    onChange={e => handleDynamicFieldChange("relationship", e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Legal Guardian">Legal Guardian</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Emergency Phone Number</label>
                  <input 
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9+]*"
                    className="w-full border border-slate-300 rounded-lg p-2" 
                    value={formData.parentPhone} 
                    onChange={e => {
                      let val = e.target.value.replace(/[^0-9+]/g, '');
                      if (val.length > 14) val = val.slice(0, 14);
                      setFormData({...formData, parentPhone: val});
                    }} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Authorized Pick-Up Person</label>
                  <input 
                    type="text" 
                    placeholder="Name of person approved to collect the child"
                    className="w-full border border-slate-300 rounded-lg p-2" 
                    value={formData.dynamicFields.authorizedPickup || ""} 
                    onChange={e => handleDynamicFieldChange("authorizedPickup", e.target.value)} 
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Dynamic Tier Fields */}
          {currentDynamicFields.length > 0 && (
            <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Tier-Specific Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentDynamicFields.map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                    {field.type === "select" ? (
                      <select 
                        className="w-full border border-slate-300 rounded-lg p-2"
                        value={formData.dynamicFields[field.key] || ""}
                        onChange={(e) => handleDynamicFieldChange(field.key, e.target.value)}
                      >
                        <option value="">Select...</option>
                        {field.options?.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        className="w-full border border-slate-300 rounded-lg p-2"
                        value={formData.dynamicFields[field.key] || ""}
                        onChange={(e) => handleDynamicFieldChange(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="md:col-span-2 flex justify-end mt-2">
            <button disabled={isPending} type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50">
              {editingStudentId ? "Update Student" : "Save Student"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-6 py-4 w-12">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  checked={selectedIds.length === filteredStudents.length && filteredStudents.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-6 py-4 font-semibold">Student ID</th>
              <th className="px-6 py-4 font-semibold">Student Name</th>
              <th className="px-6 py-4 font-semibold">Current Class</th>
              <th className="px-6 py-4 font-semibold">Guardian Name</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500 text-lg">
                  No students found in the roster.
                </td>
              </tr>
            )}
            {filteredStudents.map((student) => (
              <tr 
                key={student.id} 
                className="hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setSelectedStudent(student)}
              >
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    checked={selectedIds.includes(student.id)}
                    onChange={() => toggleSelect(student.id)}
                  />
                </td>
                <td className="px-6 py-4 font-mono text-sm text-slate-600">
                  {student.admissionNumber || "N/A"}
                </td>
                <td className="px-6 py-4 font-medium text-slate-900">
                  {student.firstName} {student.lastName}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {student.currentClass || student.tier?.name || "—"}
                </td>
                <td className="px-6 py-4 text-slate-500">{student.parentName || "—"}</td>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <select 
                    disabled={isPending || student.isLead}
                    value={student.status}
                    onChange={(e) => handleUpdateStatus(student.id, e.target.value)}
                    className={`border border-slate-300 rounded-lg p-1.5 text-xs font-bold outline-none transition-colors
                      ${student.status === "ENROLLED" ? "bg-green-100 text-green-800 border-green-200" : ""}
                      ${["PROSPECT", "APPLICANT", "SCREENED"].includes(student.status) ? "bg-yellow-100 text-yellow-800 border-yellow-200" : ""}
                      ${["SUSPENDED", "EXPELLED"].includes(student.status) ? "bg-red-100 text-red-800 border-red-200" : ""}
                      ${student.status === "ALUMNI" ? "bg-blue-100 text-blue-800 border-blue-200" : ""}
                    `}
                  >
                    <option value="PROSPECT">Prospect</option>
                    <option value="APPLICANT">Applicant</option>
                    <option value="SCREENED">Screened</option>
                    <option value="ENROLLED">Enrolled</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="EXPELLED">Expelled</option>
                    <option value="ALUMNI">Alumni</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                  {student.isLead ? (
                    <span className="text-xs text-slate-400 italic">Manage in Admissions</span>
                  ) : (
                    <>
                      <button 
                        disabled={isPending}
                        onClick={() => openEditForm(student)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 transition"
                      >
                        Edit
                      </button>
                      <button 
                        disabled={isPending}
                        onClick={() => handleDelete(student.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-800 transition"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedStudent && (
        <StudentProfileDrawer 
          student={selectedStudent} 
          onClose={() => setSelectedStudent(null)} 
        />
      )}

      {showBulkGraduate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {selectedIds.length > 0 ? bulkActionLabel : bulkActionGlobalLabel}
            </h3>
            <p className="text-slate-500 text-sm mb-4">
              {selectedIds.length > 0 
                ? `You are about to process ${selectedIds.length} selected students.` 
                : `Process an entire class cohort of students.`}
            </p>
            
            {selectedIds.length === 0 && (
              <>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Class</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2 mb-4"
                  value={bulkClass}
                  onChange={e => setBulkClass(e.target.value)}
                >
                  <option value="" disabled>Select a Class</option>
                  {Array.from(new Set(students.map(s => s.currentClass).filter(Boolean))).map(c => (
                    <option key={c as string} value={c as string}>{c as string}</option>
                  ))}
                </select>
              </>
            )}
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowBulkGraduate(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                disabled={isPending || (selectedIds.length === 0 && !bulkClass)}
                onClick={handleBulkGraduate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? "Processing..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
