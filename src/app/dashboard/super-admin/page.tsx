"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Download,
  Plus,
  Building2,
  Users,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Database,
  Activity,
  HardDrive,
  X,
} from "lucide-react";

interface SchoolRecord {
  id: string;
  name: string;
  code: string;
  plan: "Basic" | "Premium" | "Enterprise";
  students: number;
  status: "Active" | "Pending";
}

const INITIAL_SCHOOLS: SchoolRecord[] = [
  {
    id: "1",
    name: "Greenfield Academy",
    code: "GFA001",
    plan: "Premium",
    students: 450,
    status: "Active",
  },
  {
    id: "2",
    name: "Sunrise High School",
    code: "SHS002",
    plan: "Basic",
    students: 320,
    status: "Active",
  },
  {
    id: "3",
    name: "Royal Crown School",
    code: "RCS003",
    plan: "Premium",
    students: 580,
    status: "Pending",
  },
  {
    id: "4",
    name: "Divine Grace College",
    code: "DGC004",
    plan: "Enterprise",
    students: 820,
    status: "Active",
  },
];

export default function SuperAdminDashboardPage() {
  const [schools, setSchools] = useState<SchoolRecord[]>(INITIAL_SCHOOLS);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Form state for adding new school mock
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolCode, setNewSchoolCode] = useState("");
  const [newSchoolPlan, setNewSchoolPlan] = useState<"Basic" | "Premium" | "Enterprise">("Basic");
  const [newSchoolStudents, setNewSchoolStudents] = useState("");

  const showToast = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const handleExportReport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["School,Code,Plan,Students,Status"]
        .concat(
          schools.map(
            (s) => `"${s.name}","${s.code}","${s.plan}",${s.students},"${s.status}"`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "super_admin_schools_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Report exported successfully!");
  };

  const handleAddSchoolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim() || !newSchoolCode.trim()) {
      showToast("Please provide both school name and code.");
      return;
    }

    const newRecord: SchoolRecord = {
      id: Date.now().toString(),
      name: newSchoolName.trim(),
      code: newSchoolCode.trim().toUpperCase(),
      plan: newSchoolPlan,
      students: parseInt(newSchoolStudents, 10) || 0,
      status: "Active",
    };

    setSchools([newRecord, ...schools]);
    setNewSchoolName("");
    setNewSchoolCode("");
    setNewSchoolStudents("");
    setNewSchoolPlan("Basic");
    setIsAddModalOpen(false);
    showToast(`School "${newRecord.name}" added successfully!`);
  };

  const filteredSchools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return schools;
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query) ||
        s.plan.toLowerCase().includes(query) ||
        s.status.toLowerCase().includes(query)
    );
  }, [schools, searchQuery]);

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-black text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Super Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Welcome back, Super Admin • School ERP Control Center
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportReport}
            className="flex-1 sm:flex-none border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm inline-flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Export Report</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-none bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add School</span>
          </button>
        </div>
      </header>

      {/* Stats Section */}
      <section className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Schools */}
          <div className="bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Total Schools</span>
              <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                +2 new
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-gray-900 tracking-tight">24</span>
              <Building2 className="w-5 h-5 text-gray-300" />
            </div>
          </div>

          {/* Card 2: Total Students */}
          <div className="bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Total Students</span>
              <span className="bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                +12%
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-gray-900 tracking-tight">5,430</span>
              <Users className="w-5 h-5 text-gray-300" />
            </div>
          </div>

          {/* Card 3: Total Revenue */}
          <div className="bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Total Revenue</span>
              <span className="bg-purple-50 text-purple-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                MTD
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-gray-900 tracking-tight">₦4.2M</span>
              <Wallet className="w-5 h-5 text-gray-300" />
            </div>
          </div>

          {/* Card 4: Pending Approvals */}
          <div className="bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Pending Approvals</span>
              <span className="bg-orange-50 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                Action
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-gray-900 tracking-tight">3</span>
              <Clock className="w-5 h-5 text-gray-300" />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="px-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 cols: Recent Schools Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Recent Schools</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Overview of registered institutions across all tiers
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search schools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-gray-50/50"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">School</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Students</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSchools.length > 0 ? (
                    filteredSchools.map((school) => (
                      <tr
                        key={school.id}
                        className="hover:bg-gray-50/70 transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-medium text-gray-900">
                          {school.name}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-gray-600">
                          {school.code}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-md ${
                              school.plan === "Enterprise"
                                ? "bg-purple-100 text-purple-700"
                                : school.plan === "Premium"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {school.plan}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">
                          {school.students.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                              school.status === "Active"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {school.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                        No schools found matching &quot;{searchQuery}&quot;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right 1 col: Quick Actions & System Health */}
          <div className="lg:col-span-1 space-y-6 flex flex-col">
            {/* Quick Actions Card */}
            <div className="bg-white rounded-2xl p-6 border shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 text-center transition-all flex flex-col items-center justify-center gap-1.5 border border-transparent hover:border-gray-200 cursor-pointer"
                >
                  <span className="text-2xl" role="img" aria-label="School">
                    🏫
                  </span>
                  <span className="text-xs font-semibold text-gray-800">Add School</span>
                </button>
                <button
                  type="button"
                  onClick={() => showToast("Manage Users portal opened")}
                  className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 text-center transition-all flex flex-col items-center justify-center gap-1.5 border border-transparent hover:border-gray-200 cursor-pointer"
                >
                  <span className="text-2xl" role="img" aria-label="Users">
                    👥
                  </span>
                  <span className="text-xs font-semibold text-gray-800">Manage Users</span>
                </button>
                <button
                  type="button"
                  onClick={() => showToast("Subscriptions manager opened")}
                  className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 text-center transition-all flex flex-col items-center justify-center gap-1.5 border border-transparent hover:border-gray-200 cursor-pointer"
                >
                  <span className="text-2xl" role="img" aria-label="Subscriptions">
                    💳
                  </span>
                  <span className="text-xs font-semibold text-gray-800">Subscriptions</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportReport}
                  className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 text-center transition-all flex flex-col items-center justify-center gap-1.5 border border-transparent hover:border-gray-200 cursor-pointer"
                >
                  <span className="text-2xl" role="img" aria-label="Reports">
                    📊
                  </span>
                  <span className="text-xs font-semibold text-gray-800">Reports</span>
                </button>
              </div>
            </div>

            {/* System Health Card */}
            <div className="bg-black text-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <h2 className="text-base font-bold text-white tracking-wide">System Health</h2>
                </div>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
                </span>
              </div>

              <div className="space-y-4">
                {/* Database Online */}
                <div className="flex items-center justify-between py-2 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">Database</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                    Online
                  </span>
                </div>

                {/* API 99.9% */}
                <div className="py-1 border-b border-gray-800 pb-3">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-gray-300">API</span>
                    <span className="text-xs font-semibold text-gray-200">99.9%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-green-400 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: "99.9%" }}
                    ></div>
                  </div>
                </div>

                {/* Storage 72% */}
                <div className="pt-1">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-300">Storage</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-200">72%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-400 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: "72%" }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add School Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add New School</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddSchoolSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  School Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex International School"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  School Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AIS005"
                  value={newSchoolCode}
                  onChange={(e) => setNewSchoolCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Plan
                  </label>
                  <select
                    value={newSchoolPlan}
                    onChange={(e) =>
                      setNewSchoolPlan(e.target.value as "Basic" | "Premium" | "Enterprise")
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Premium">Premium</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Estimated Students
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={newSchoolStudents}
                    onChange={(e) => setNewSchoolStudents(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Create School
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
