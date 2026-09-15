"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdmissionLead, AcademicTier } from "@prisma/client";
import { X, Mail, Phone, User, Users, CheckCircle, GraduationCap, FileCheck, FileText, Image as ImageIcon, Copy, ExternalLink } from "lucide-react";
import { enrollApplicantAction, updateLeadStatusAction } from "./actions";

const STAGES = ["INQUIRY", "APPLIED", "INTERVIEW", "APPROVED", "ENROLLED"];

type LeadWithTier = AdmissionLead & { tier?: AcademicTier | null; notes?: any[] };

export default function AdmissionsPipeline({
  leads,
  schoolId,
  schoolDomain,
  tiers,
}: {
  leads: LeadWithTier[];
  schoolId: string;
  schoolDomain?: string;
  tiers: AcademicTier[];
}) {
  const router = useRouter();
  const [localLeads, setLocalLeads] = useState<LeadWithTier[]>(leads);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    setLocalLeads(leads);
  }, [leads]);
  
  // Drawer state
  const [selectedLead, setSelectedLead] = useState<LeadWithTier | null>(null);
  const [newLog, setNewLog] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isAddingLog, setIsAddingLog] = useState(false);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    setIsUpdating(leadId);
    
    // Optimistic UI update
    setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

    try {
      if (newStatus === "ENROLLED") {
        const res = await enrollApplicantAction({
          leadId,
          schoolId,
          schoolDomain: schoolDomain || "",
        });
        
        if (!res.success) {
          setLocalLeads(leads); // revert
          alert(`Enrollment failed: ${res.error}`);
        } else {
          router.refresh();
          if (selectedLead && selectedLead.id === leadId) {
            setSelectedLead({ ...selectedLead, status: newStatus });
          }
        }
      } else {
        const res = await updateLeadStatusAction({
          leadId,
          status: newStatus,
          schoolId,
          schoolDomain: schoolDomain || "",
        });

        if (!res.success) {
          setLocalLeads(leads); // revert
          alert(`Failed to update status: ${res.error || "Unknown error"}`);
        } else {
          router.refresh();
          if (selectedLead && selectedLead.id === leadId) {
            setSelectedLead({ ...selectedLead, status: newStatus });
          }
        }
      }
    } catch (e: any) {
      setLocalLeads(leads); // revert
      alert(`Error updating lead: ${e.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleFinalizeEnrollment = async (leadId: string) => {
    setIsEnrolling(true);
    try {
      const res = await enrollApplicantAction({
        leadId,
        schoolId,
        schoolDomain: schoolDomain || "",
      });
      if (!res.success) {
        alert(`Enrollment failed: ${res.error}`);
      } else {
        alert(`Applicant enrolled successfully into ${res.tierName || "designated tier"} database!`);
        router.refresh();
        setSelectedLead(null);
      }
    } catch (e: any) {
      alert(`Error finalizing enrollment: ${e.message}`);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleAddLog = async () => {
    if (!selectedLead || !newLog.trim()) {
      alert("Please enter a note before submitting.");
      return;
    }
    setIsAddingLog(true);
    try {
      const res = await fetch(`/api/v1/leads/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentLeadId: selectedLead.id, content: newLog, authorName: "Admin User", schoolId }),
      });
      
      if (res.ok) {
        const { data } = await res.json();
        const existingNotes = selectedLead.notes || [];
        setSelectedLead({ ...selectedLead, notes: [...existingNotes, data] });
        setNewLog("");
        router.refresh();
      } else {
        alert("Failed to add note");
      }
    } catch (e: any) {
      alert(`Error adding note: ${e.message}`);
    } finally {
      setIsAddingLog(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    if (leadId) {
      const lead = localLeads.find(l => l.id === leadId);
      if (lead && lead.status !== newStage) {
        handleStatusChange(leadId, newStage);
      }
    }
  };

  // Mobile Active Stage State
  const [mobileStage, setMobileStage] = useState<string>("INQUIRY");

  return (
    <div className="flex-1 overflow-hidden relative flex flex-col">
      {/* Mobile Stage Selector Tabs (lg:hidden) */}
      <div className="lg:hidden p-3 bg-slate-100/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {STAGES.map((stage) => {
            const count = localLeads.filter((l) => (l.status || "").toUpperCase() === stage).length;
            const isActive = mobileStage === stage;
            return (
              <button
                key={stage}
                onClick={() => setMobileStage(stage)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 border ${
                  isActive
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm"
                    : "bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700"
                }`}
              >
                <span>{stage}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isActive 
                    ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900" 
                    : "bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MOBILE SINGLE STAGE VIEW (< lg) */}
      <div className="lg:hidden flex-1 overflow-y-auto p-4 space-y-3">
        {(() => {
          const stageLeads = localLeads.filter((l) => (l.status || "").toUpperCase() === mobileStage);
          if (stageLeads.length === 0) {
            return (
              <div className="p-8 text-center text-slate-400 dark:text-zinc-500 italic bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                No applications currently in the <strong className="text-slate-600 dark:text-zinc-300 font-semibold">{mobileStage}</strong> stage.
              </div>
            );
          }
          return stageLeads.map((lead) => (
            <div 
              key={lead.id} 
              onClick={() => setSelectedLead(lead)}
              className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 transition-shadow hover:shadow-md cursor-pointer space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">{lead.applicantName}</h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Target Grade: <span className="font-semibold text-slate-700 dark:text-zinc-300">{lead.targetGrade}</span></p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                  {lead.tier?.name || "Tier"}
                </span>
              </div>

              {mobileStage !== "ENROLLED" ? (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Stage:</span>
                  <div className="flex items-center gap-2">
                    <select 
                      className="text-xs border border-slate-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-medium cursor-pointer"
                      value={mobileStage}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(lead.id, e.target.value);
                      }}
                      disabled={isUpdating === lead.id}
                    >
                      {STAGES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {isUpdating === lead.id && <span className="text-xs text-indigo-500 animate-pulse">Updating...</span>}
                  </div>
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" /> Enrolled in Institutional Database
                </div>
              )}
            </div>
          ));
        })()}
      </div>

      {/* DESKTOP PIPELINE BOARD (lg+) */}
      <div className="hidden lg:block flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max h-full min-h-[500px] p-4">
          {STAGES.map((stage) => {
            const stageLeads = localLeads.filter((l) => (l.status || "").toUpperCase() === stage);
            
            return (
              <div 
                key={stage} 
                className="w-80 flex flex-col bg-slate-100/70 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950 rounded-t-xl">
                  <h3 className="font-bold text-slate-700 dark:text-zinc-200 text-sm">{stage}</h3>
                  <span className="bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {stageLeads.length}
                  </span>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto space-y-3">
                  {stageLeads.map((lead) => (
                    <div 
                      key={lead.id} 
                      draggable={stage !== "ENROLLED"}
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onClick={() => setSelectedLead(lead)}
                      className={`bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 transition-shadow ${stage !== "ENROLLED" ? "cursor-grab active:cursor-grabbing hover:shadow-md" : "opacity-75 cursor-pointer hover:shadow"}`}
                    >
                      <h4 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">{lead.applicantName}</h4>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Grade: {lead.targetGrade}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">Tier: {lead.tier?.name || "Tier"}</p>
                      
                      {stage !== "ENROLLED" ? (
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                          <select 
                            className="text-xs border border-slate-300 dark:border-zinc-700 rounded-lg p-1 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 cursor-pointer"
                            value={stage}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleStatusChange(lead.id, e.target.value);
                            }}
                            disabled={isUpdating === lead.id}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {STAGES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          {isUpdating === lead.id && <span className="text-xs text-indigo-500 animate-pulse">Updating...</span>}
                        </div>
                      ) : (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Enrolled in Institutional Database
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {stageLeads.length === 0 && (
                    <div className="text-center p-4 text-xs text-slate-400 dark:text-zinc-500 italic">
                      No applications in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Drawer Overlay (Fixed Modal on Mobile, Slide-in on Desktop) */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm" onClick={() => setSelectedLead(null)}>
          <div 
            className="w-full max-w-lg bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">{selectedLead.applicantName}</h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5 truncate">Applying for {selectedLead.targetGrade} • {selectedLead.tier?.name || "Tier"}</p>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full text-slate-500 dark:text-zinc-400 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 bg-white dark:bg-zinc-900">
              
              {/* Contact Details Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Student */}
                <div className="bg-slate-50 dark:bg-zinc-950/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 font-semibold mb-3 text-sm">
                    <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="truncate">{(selectedLead.tier?.name || "").toUpperCase().includes("UNIVERSITY") || (selectedLead.tier?.name || "").toUpperCase().includes("POLYTECHNIC") || (selectedLead.tier?.name || "").toUpperCase().includes("COLLEGE") || (selectedLead.tier?.name || "").toUpperCase().includes("HIGHER ED") ? "Applicant Details" : "Student Details"}</h3>
                  </div>
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300 min-w-0">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{selectedLead.studentEmail || "No email"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300 min-w-0">
                      <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span>{selectedLead.studentPhone || "No phone"}</span>
                    </div>
                  </div>
                </div>

                {/* Parent / Sponsor */}
                <div className="bg-slate-50 dark:bg-zinc-950/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 font-semibold mb-3 text-sm">
                    <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="truncate">{(selectedLead.tier?.name || "").toUpperCase().includes("UNIVERSITY") || (selectedLead.tier?.name || "").toUpperCase().includes("POLYTECHNIC") || (selectedLead.tier?.name || "").toUpperCase().includes("COLLEGE") || (selectedLead.tier?.name || "").toUpperCase().includes("HIGHER ED") ? "Sponsor / Next of Kin" : "Parent / Guardian"}</h3>
                  </div>
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300 min-w-0">
                      <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{selectedLead.parentName || "Unknown"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300 min-w-0">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{selectedLead.parentEmail || "No email"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300 min-w-0">
                      <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span>{selectedLead.parentContact || selectedLead.parentPhone || "No phone"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Uploaded Credential Documents Section */}
              <div className="bg-slate-50 dark:bg-zinc-950/60 p-4 rounded-xl border border-slate-150 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-zinc-200 font-semibold text-sm">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>Uploaded Credential Documents</span>
                  </div>
                  {(selectedLead as any).uploadToken && (
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/${schoolDomain || "udoka"}/admissions/upload/${selectedLead.id}?token=${(selectedLead as any).uploadToken}`;
                        navigator.clipboard.writeText(link);
                        alert("Secure upload portal link copied to clipboard!");
                      }}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Upload Link</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* 1. Passport Photo */}
                  <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {(selectedLead as any).passportPhotoUrl ? (
                        <img
                          src={(selectedLead as any).passportPhotoUrl}
                          alt="Passport"
                          className="w-8 h-8 rounded-md object-cover border border-slate-200"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                      <div className="truncate">
                        <p className="font-bold text-slate-800 dark:text-zinc-200 truncate">Passport Photo</p>
                        <span className={`text-[10px] font-bold ${
                          (selectedLead as any).passportPhotoUrl ? "text-emerald-600" : "text-amber-600"
                        }`}>
                          {(selectedLead as any).passportPhotoUrl ? "Uploaded" : "Pending"}
                        </span>
                      </div>
                    </div>
                    {(selectedLead as any).passportPhotoUrl && (
                      <a
                        href={(selectedLead as any).passportPhotoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-indigo-600 hover:underline shrink-0 ml-2"
                      >
                        View
                      </a>
                    )}
                  </div>

                  {/* 2. Academic Results */}
                  <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                      <div className="truncate">
                        <p className="font-bold text-slate-800 dark:text-zinc-200 truncate">Academic Results</p>
                        <span className={`text-[10px] font-bold ${
                          (selectedLead as any).academicResultsUrl ? "text-emerald-600" : "text-amber-600"
                        }`}>
                          {(selectedLead as any).academicResultsUrl ? "Uploaded" : "Pending"}
                        </span>
                      </div>
                    </div>
                    {(selectedLead as any).academicResultsUrl && (
                      <a
                        href={(selectedLead as any).academicResultsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-indigo-600 hover:underline shrink-0 ml-2"
                      >
                        View
                      </a>
                    )}
                  </div>

                  {/* 3. Birth Certificate */}
                  <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                      <div className="truncate">
                        <p className="font-bold text-slate-800 dark:text-zinc-200 truncate">Birth Certificate</p>
                        <span className={`text-[10px] font-bold ${
                          (selectedLead as any).birthCertificateUrl ? "text-emerald-600" : "text-amber-600"
                        }`}>
                          {(selectedLead as any).birthCertificateUrl ? "Uploaded" : "Pending"}
                        </span>
                      </div>
                    </div>
                    {(selectedLead as any).birthCertificateUrl && (
                      <a
                        href={(selectedLead as any).birthCertificateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-indigo-600 hover:underline shrink-0 ml-2"
                      >
                        View
                      </a>
                    )}
                  </div>

                  {/* 4. Medical Records */}
                  <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-5 h-5 text-purple-500 shrink-0" />
                      <div className="truncate">
                        <p className="font-bold text-slate-800 dark:text-zinc-200 truncate">Medical Records</p>
                        <span className={`text-[10px] font-bold ${
                          (selectedLead as any).medicalRecordsUrl ? "text-emerald-600" : "text-slate-400"
                        }`}>
                          {(selectedLead as any).medicalRecordsUrl ? "Uploaded" : "Not Provided"}
                        </span>
                      </div>
                    </div>
                    {(selectedLead as any).medicalRecordsUrl && (
                      <a
                        href={(selectedLead as any).medicalRecordsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-indigo-600 hover:underline shrink-0 ml-2"
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Logs / Notes Section */}
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-zinc-200 mb-3 text-sm">Activity & Logs</h3>
                
                <div className="bg-slate-50 dark:bg-zinc-950/60 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-col gap-2 mb-4">
                  <textarea 
                    placeholder="Add a timestamped note..."
                    className="w-full text-xs sm:text-sm p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={3}
                    value={newLog}
                    onChange={(e) => setNewLog(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleAddLog}
                      disabled={isAddingLog || !newLog.trim()}
                      className="text-xs bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-3.5 py-2 rounded-lg font-bold disabled:opacity-50 transition-colors"
                    >
                      {isAddingLog ? "Adding..." : "Add Note"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {(() => {
                    const notes = Array.isArray(selectedLead.notes) ? selectedLead.notes : [];
                    if (notes.length === 0) return <p className="text-xs sm:text-sm text-slate-400 dark:text-zinc-500 italic">No activity notes yet.</p>;
                    
                    return [...notes].reverse().map((note: any) => (
                      <div key={note.id} className="bg-white dark:bg-zinc-950/80 border border-slate-150 dark:border-zinc-800 p-3.5 rounded-xl shadow-sm text-xs sm:text-sm">
                        <p className="text-slate-700 dark:text-zinc-300">{note.content}</p>
                        <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/60">
                          <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                            {new Date(note.createdAt).toLocaleString()}
                          </p>
                          <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-slate-600 dark:text-zinc-400 font-medium">{note.authorName}</span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setSelectedLead(null)}
                className="flex-1 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-sm"
              >
                Close
              </button>
              
              {selectedLead.status !== "ENROLLED" ? (
                <button 
                  onClick={() => handleFinalizeEnrollment(selectedLead.id)}
                  disabled={isEnrolling}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex justify-center items-center gap-2 transition-colors disabled:opacity-70 text-sm shadow-sm"
                >
                  <GraduationCap className="w-4 sm:w-5 h-4 sm:h-5" />
                  {isEnrolling ? "Enrolling..." : "Finalize Enrollment"}
                </button>
              ) : (
                <div className="flex-1 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl font-semibold flex justify-center items-center gap-2 text-sm">
                  <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5" />
                  Enrolled
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
