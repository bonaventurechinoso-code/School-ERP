"use client";

import React, { useState, useMemo } from "react";
import { 
  Users, 
  Search, 
  Mail, 
  Phone, 
  GraduationCap, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  ShieldCheck
} from "lucide-react";

export interface ParentChildInfo {
  id: string;
  name: string;
  admissionNumber: string;
  grade: string;
  status: string;
}

export interface ParentRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  relationship: string | null;
  isActive: boolean;
  createdAt: string;
  childrenCount: number;
  children: ParentChildInfo[];
}

interface ParentsTableClientProps {
  initialParents: ParentRecord[];
  schoolDomain: string;
  schoolName: string;
}

export default function ParentsTableClient({
  initialParents,
  schoolDomain,
  schoolName,
}: ParentsTableClientProps) {
  const [search, setSearch] = useState("");
  const [selectedParent, setSelectedParent] = useState<ParentRecord | null>(null);

  const filteredParents = useMemo(() => {
    if (!search.trim()) return initialParents;
    const q = search.toLowerCase();
    return initialParents.filter((p) => {
      const matchParent =
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        (p.relationship && p.relationship.toLowerCase().includes(q));
      const matchChild = p.children.some(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.admissionNumber.toLowerCase().includes(q) ||
          c.grade.toLowerCase().includes(q)
      );
      return matchParent || matchChild;
    });
  }, [initialParents, search]);

  return (
    <div className="space-y-4">
      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by parent name, email, phone, child..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Total Parents: <strong className="text-slate-900 dark:text-white">{initialParents.length}</strong></span>
          <span>&bull;</span>
          <span>Active Accounts: <strong className="text-emerald-600 dark:text-emerald-400">{initialParents.filter(p => p.isActive).length}</strong></span>
        </div>
      </div>

      {/* Parents Table */}
      <div className="overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider">
                <th className="py-3.5 px-4">Parent / Guardian</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Phone Number</th>
                <th className="py-3.5 px-4">Relationship</th>
                <th className="py-3.5 px-4 text-center">Linked Children</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredParents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <p className="text-base font-semibold">No parents registered yet</p>
                      <p className="text-xs text-slate-400">
                        When you enroll students with parent details, their accounts are automatically created here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredParents.map((parent) => (
                  <tr 
                    key={parent.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm shrink-0">
                          {parent.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {parent.name}
                          </div>
                          <div className="text-xs text-slate-400">
                            Registered {new Date(parent.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-xs sm:text-sm">{parent.email}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-xs sm:text-sm">{parent.phone}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {parent.relationship || "Guardian"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <GraduationCap className="w-3.5 h-3.5" />
                        {parent.childrenCount} {parent.childrenCount === 1 ? "child" : "children"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {parent.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <XCircle className="w-3.5 h-3.5" />
                          Suspended
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedParent(parent)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 transition-colors"
                      >
                        View Children
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Children Modal */}
      {selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                  {selectedParent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedParent.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedParent.email} &bull; {selectedParent.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedParent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Linked Children ({selectedParent.children.length})
              </h4>

              {selectedParent.children.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No linked children found.</p>
              ) : (
                <div className="space-y-2">
                  {selectedParent.children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {child.name}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {child.admissionNumber} &bull; {child.grade}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {child.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex justify-end">
              <button
                onClick={() => setSelectedParent(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
