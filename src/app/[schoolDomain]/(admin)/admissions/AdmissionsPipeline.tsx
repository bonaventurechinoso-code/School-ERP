"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdmissionLead, AcademicTier } from "@prisma/client";
import { X, Mail, Phone, User, Users, CheckCircle, GraduationCap } from "lucide-react";
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

  return (
    <div className="flex-1 overflow-hidden relative flex">
      {/* Pipeline Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max h-full min-h-[500px] p-4">
          {STAGES.map((stage) => {
            const stageLeads = localLeads.filter((l) => (l.status || "").toUpperCase() === stage);
            
            return (
              <div 
                key={stage} 
                className="w-80 flex flex-col bg-slate-100 rounded-xl border border-slate-200"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                  <h3 className="font-bold text-slate-700">{stage}</h3>
                  <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-semibold">
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
                      className={`bg-white p-4 rounded-lg shadow-sm border border-slate-200 transition-shadow ${stage !== "ENROLLED" ? "cursor-grab active:cursor-grabbing hover:shadow-md" : "opacity-70 cursor-pointer hover:shadow"}`}
                    >
                      <h4 className="font-bold text-slate-800">{lead.applicantName}</h4>
                      <p className="text-sm text-slate-500 mt-1">Grade: {lead.targetGrade}</p>
                      <p className="text-sm text-slate-500">Tier: {lead.tier?.name || "Tier"}</p>
                      
                      {stage !== "ENROLLED" && (
                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                          <select 
                            className="text-xs border border-slate-300 rounded p-1 bg-white"
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
                          {isUpdating === lead.id && <span className="text-xs text-blue-500 animate-pulse">Updating...</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {stageLeads.length === 0 && (
                    <div className="text-center p-4 text-sm text-slate-400">
                      No applications in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Drawer Overlay */}
      {selectedLead && (
        <div className="absolute inset-0 z-10 flex justify-end bg-slate-900/20 backdrop-blur-sm" onClick={() => setSelectedLead(null)}>
          <div 
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{selectedLead.applicantName}</h2>
                <p className="text-sm text-slate-500 mt-1">Applying for {selectedLead.targetGrade} • {selectedLead.tier?.name || "Tier"}</p>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Contact Details Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Student */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold mb-3">
                    <User className="w-4 h-4 text-blue-600" />
                    <h3>{(selectedLead.tier?.name || "").toUpperCase().includes("UNIVERSITY") || (selectedLead.tier?.name || "").toUpperCase().includes("POLYTECHNIC") || (selectedLead.tier?.name || "").toUpperCase().includes("COLLEGE") || (selectedLead.tier?.name || "").toUpperCase().includes("HIGHER ED") ? "Applicant Details" : "Student Details"}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{selectedLead.studentEmail || "No email"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{selectedLead.studentPhone || "No phone"}</span>
                    </div>
                  </div>
                </div>

                {/* Parent / Sponsor */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold mb-3">
                    <Users className="w-4 h-4 text-purple-600" />
                    <h3>{(selectedLead.tier?.name || "").toUpperCase().includes("UNIVERSITY") || (selectedLead.tier?.name || "").toUpperCase().includes("POLYTECHNIC") || (selectedLead.tier?.name || "").toUpperCase().includes("COLLEGE") || (selectedLead.tier?.name || "").toUpperCase().includes("HIGHER ED") ? "Sponsor / Next of Kin" : "Parent / Guardian"}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <User className="w-3.5 h-3.5" />
                      <span className="truncate">{selectedLead.parentName || "Unknown"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{selectedLead.parentEmail || "No email"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{selectedLead.parentContact || selectedLead.parentPhone || "No phone"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logs / Notes Section */}
              <div>
                <h3 className="font-semibold text-slate-800 mb-4">Activity & Logs</h3>
                
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-2 mb-4">
                  <textarea 
                    placeholder="Add a timestamped note..."
                    className="w-full text-sm p-2 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    rows={3}
                    value={newLog}
                    onChange={(e) => setNewLog(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleAddLog}
                      disabled={isAddingLog || !newLog.trim()}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded font-medium disabled:opacity-50 transition-colors"
                    >
                      {isAddingLog ? "Adding..." : "Add Note"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {(() => {
                    const notes = Array.isArray(selectedLead.notes) ? selectedLead.notes : [];
                    if (notes.length === 0) return <p className="text-sm text-slate-400 italic">No activity notes yet.</p>;
                    
                    return [...notes].reverse().map((note: any) => (
                      <div key={note.id} className="bg-white border border-slate-100 p-3 rounded-lg shadow-sm text-sm">
                        <p className="text-slate-700">{note.content}</p>
                        <div className="flex justify-between items-center mt-2">
                          <p className="text-xs text-slate-400 font-medium">
                            {new Date(note.createdAt).toLocaleString()}
                          </p>
                          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">{note.authorName}</span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setSelectedLead(null)}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              
              {selectedLead.status !== "ENROLLED" ? (
                <button 
                  onClick={() => handleFinalizeEnrollment(selectedLead.id)}
                  disabled={isEnrolling}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex justify-center items-center gap-2 transition-colors disabled:opacity-70"
                >
                  <GraduationCap className="w-5 h-5" />
                  {isEnrolling ? "Enrolling..." : "Finalize Enrollment"}
                </button>
              ) : (
                <div className="flex-1 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-lg font-semibold flex justify-center items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
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
