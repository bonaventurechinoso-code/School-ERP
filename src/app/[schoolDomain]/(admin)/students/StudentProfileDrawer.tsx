"use client";

import React, { useState } from "react";
import { Student, AcademicTier } from "@prisma/client";
import { X, User, Phone, Mail, MapPin, GraduationCap, Briefcase, Calendar } from "lucide-react";

type StudentWithTier = Student & { tier?: AcademicTier | null };

export default function StudentProfileDrawer({
  student,
  onClose,
}: {
  student: StudentWithTier;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"BIO" | "GUARDIAN" | "ACADEMICS">("BIO");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 h-full shadow-2xl flex flex-col animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 sm:w-16 h-12 sm:h-16 shrink-0 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 font-bold text-xl border-2 border-white dark:border-zinc-700 shadow-sm overflow-hidden">
               {/* Placeholder for Passport Photograph */}
               <User className="w-6 sm:w-8 h-6 sm:h-8 text-slate-400 dark:text-zinc-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                {student.firstName} {student.lastName}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                {student.currentClass || student.tier?.name || "Unassigned"} • {student.admissionNumber || "No ID"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full text-slate-500 dark:text-zinc-400 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto whitespace-nowrap border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 pt-2 bg-slate-50 dark:bg-zinc-950 hide-scrollbar">
          <button
            onClick={() => setActiveTab("BIO")}
            className={`py-3 px-3 sm:px-4 font-semibold text-xs sm:text-sm border-b-2 transition-colors ${
              activeTab === "BIO" ? "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
            }`}
          >
            Bio-Data
          </button>
          <button
            onClick={() => setActiveTab("GUARDIAN")}
            className={`py-3 px-3 sm:px-4 font-semibold text-xs sm:text-sm border-b-2 transition-colors ${
              activeTab === "GUARDIAN" ? "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
            }`}
          >
            Guardian Profile
          </button>
          <button
            onClick={() => setActiveTab("ACADEMICS")}
            className={`py-3 px-3 sm:px-4 font-semibold text-xs sm:text-sm border-b-2 transition-colors ${
              activeTab === "ACADEMICS" ? "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
            }`}
          >
            Academic Tracker
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white dark:bg-zinc-900">
          {activeTab === "BIO" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Full Name</label>
                  <p className="font-medium text-slate-800 dark:text-zinc-200">{student.firstName} {student.lastName}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Admission Number</label>
                  <p className="font-mono text-slate-800 dark:text-zinc-200">{student.admissionNumber || "Not Assigned"}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Date of Birth</label>
                  <div className="flex items-center gap-2 text-slate-800 dark:text-zinc-200 font-medium">
                    <Calendar className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                    {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "Not Provided"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">State of Origin</label>
                  <div className="flex items-center gap-2 text-slate-800 dark:text-zinc-200 font-medium">
                    <MapPin className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                    {student.stateOfOrigin || "Not Provided"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Student Email</label>
                  <div className="flex items-center gap-2 text-slate-800 dark:text-zinc-200 font-medium">
                    <Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                    {student.email || "Not Provided"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "GUARDIAN" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-slate-50 dark:bg-zinc-950/60 rounded-xl p-4 sm:p-5 border border-slate-100 dark:border-zinc-800">
                <div className="grid grid-cols-1 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Guardian Name</label>
                    <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-zinc-200">
                      <User className="w-4 h-4 text-indigo-500" />
                      {student.parentName || "Not Provided"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Occupation</label>
                    <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-zinc-200">
                      <Briefcase className="w-4 h-4 text-indigo-500" />
                      {student.parentOccupation || "Not Provided"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Primary Phone</label>
                    <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-zinc-200">
                      <Phone className="w-4 h-4 text-indigo-500" />
                      {student.parentPhone || "Not Provided"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">WhatsApp Details</label>
                    <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-zinc-200">
                      <Phone className="w-4 h-4 text-emerald-500" />
                      {student.parentWhatsApp || "Not Provided"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Email Address</label>
                    <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-zinc-200">
                      <Mail className="w-4 h-4 text-indigo-500" />
                      {student.parentEmail || "Not Provided"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ACADEMICS" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl p-4 sm:p-6 border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
                  <GraduationCap className="w-5 sm:w-6 h-5 sm:h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">Academic Tracking</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 mt-1">This module is connected to the Examinations framework. Termly assessments, term registration, and assigned class teachers will appear here.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-4 border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50/50 dark:bg-zinc-950/50">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300">Current Term Status</h4>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">Registered</p>
                </div>
                <div className="p-4 border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50/50 dark:bg-zinc-950/50">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300">Class Teacher</h4>
                  <p className="font-medium text-slate-800 dark:text-zinc-200 mt-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400 dark:text-zinc-500" /> Unassigned
                  </p>
                </div>
              </div>
              
              <div className="p-4 border border-slate-200 dark:border-zinc-800 rounded-xl text-center text-slate-500 dark:text-zinc-500 text-xs sm:text-sm italic bg-slate-50/30 dark:bg-zinc-950/30">
                Termly examination assessments have not been published for this term yet.
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
