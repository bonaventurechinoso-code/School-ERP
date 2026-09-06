"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, GraduationCap } from "lucide-react";
import { acceptOfferAction, declineOfferAction } from "./actions";

export default function AcceptOfferPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  
  const schoolDomain = params.schoolDomain as string;
  const token = searchParams.get("token");

  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800">Invalid Link</h2>
          <p className="text-slate-500 mt-2">No secure token found in the URL.</p>
        </div>
      </div>
    );
  }

  const handleAccept = () => {
    startTransition(async () => {
      const res = await acceptOfferAction(token, schoolDomain);
      if (res.error) {
        setStatusMessage(res.error);
      } else {
        setStatusMessage("SUCCESS");
      }
    });
  };

  const handleDecline = () => {
    if (confirm("Are you sure you want to decline this offer? This action cannot be undone.")) {
      startTransition(async () => {
        const res = await declineOfferAction(token, schoolDomain);
        if (res.error) {
          setStatusMessage(res.error);
        } else {
          setStatusMessage("DECLINED");
        }
      });
    }
  };

  if (statusMessage === "SUCCESS") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-green-200 p-12 text-center animate-in fade-in zoom-in-95">
          <div className="mx-auto w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Offer Accepted!</h1>
          <p className="mt-4 text-lg text-slate-600">
            Welcome aboard! Your admission has been finalized and a student profile has been created.
            You will receive further onboarding instructions shortly.
          </p>
        </div>
      </div>
    );
  }

  if (statusMessage === "DECLINED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-red-200 p-12 text-center animate-in fade-in zoom-in-95">
          <div className="mx-auto w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
            <XCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Offer Declined</h1>
          <p className="mt-4 text-lg text-slate-600">
            You have successfully declined the admission offer. We wish you the best in your future endeavors!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full bg-white rounded-3xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-slate-900 px-8 py-10 text-center text-white">
          <div className="mx-auto w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Congratulations!
          </h1>
          <p className="mt-4 text-slate-300 text-lg max-w-xl mx-auto">
            You have been officially offered admission. Please review the details below to secure your placement.
          </p>
        </div>

        <div className="p-8 md:p-12">
          {statusMessage && statusMessage !== "SUCCESS" && statusMessage !== "DECLINED" && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-center font-medium">
              {statusMessage}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-10">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Admission Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-slate-500 mb-1">Status</p>
                <p className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block"></span>
                  Approved & Offered
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Action Required</p>
                <p className="font-semibold text-slate-800 text-lg">Respond to Offer</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={handleDecline}
              disabled={isPending}
              className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 rounded-xl font-bold text-lg transition-all disabled:opacity-50"
            >
              Decline Offer
            </button>
            <button 
              onClick={handleAccept}
              disabled={isPending}
              className="w-full sm:w-auto px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isPending ? "Processing..." : "Accept Offer & Enroll"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
