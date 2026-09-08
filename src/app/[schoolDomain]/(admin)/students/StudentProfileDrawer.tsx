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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xl border-2 border-white shadow-sm overflow-hidden">
               {/* Placeholder for Passport Photograph */}
               <User className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{student.firstName} {student.lastName}</h2>
              <p className="text-sm font-medium text-slate-500 mt-1">
                {student.currentClass || student.tier?.name || "Unassigned"} • {student.admissionNumber || "No ID"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto whitespace-nowrap border-b border-slate-200 px-6 pt-2 bg-slate-50 hide-scrollbar">
          <button
            onClick={() => setActiveTab("BIO")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === "BIO" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Bio-Data
          </button>
          <button
            onClick={() => setActiveTab("GUARDIAN")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === "GUARDIAN" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Guardian Profile
          </button>
          <button
            onClick={() => setActiveTab("ACADEMICS")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === "ACADEMICS" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Academic Tracker
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {activeTab === "BIO" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                  <p className="font-medium text-slate-800">{student.firstName} {student.lastName}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Admission Number</label>
                  <p className="font-mono text-slate-800">{student.admissionNumber || "Not Assigned"}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date of Birth</label>
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "Not Provided"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">State of Origin</label>
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {student.stateOfOrigin || "Not Provided"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Student Email</label>
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {student.email || "Not Provided"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "GUARDIAN" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Guardian Name</label>
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <User className="w-4 h-4 text-purple-500" />
                      {student.parentName || "Not Provided"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Occupation</label>
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <Briefcase className="w-4 h-4 text-purple-500" />
                      {student.parentOccupation || "Not Provided"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Primary Phone</label>
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <Phone className="w-4 h-4 text-purple-500" />
                      {student.parentPhone || "Not Provided"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">WhatsApp Details</label>
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <Phone className="w-4 h-4 text-green-500" />
                      {student.parentWhatsApp || "Not Provided"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <Mail className="w-4 h-4 text-purple-500" />
                      {student.parentEmail || "Not Provided"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ACADEMICS" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100 flex items-start gap-4">
                <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Academic Tracking</h3>
                  <p className="text-sm text-slate-600 mt-1">This module is connected to the Examinations framework. Terminal assessments, term registration, and assigned class teachers will appear here.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/50">
                  <h4 className="text-sm font-semibold text-slate-700">Current Term Status</h4>
                  <p className="text-2xl font-bold text-green-600 mt-2">Registered</p>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/50">
                  <h4 className="text-sm font-semibold text-slate-700">Class Teacher</h4>
                  <p className="font-medium text-slate-800 mt-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" /> Unassigned
                  </p>
                </div>
              </div>
              
              <div className="p-4 border border-slate-200 rounded-lg text-center text-slate-500 italic">
                Terminal examination assessments have not been published for this term yet.
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
