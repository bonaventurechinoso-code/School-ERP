"use client";

import React, { useState, useTransition } from "react";
import { updatePortalSettings } from "./actions";

export default function PortalSettingsForm({
  schoolId,
  subdomain,
  initialIsPublic,
  initialGreeting,
}: {
  schoolId: string;
  subdomain: string;
  initialIsPublic: boolean;
  initialGreeting: string;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [greeting, setGreeting] = useState(initialGreeting);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Note: the prompt suggests "Your Public Web Portal Link: https://schoolerp.com"
  // Let's use the window.location or a mock domain
  const publicLink = typeof window !== "undefined" 
    ? `${window.location.protocol}//${window.location.host}/${subdomain}`
    : `https://schoolerp.local/${subdomain}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updatePortalSettings(schoolId, {
        isPublicPortalEnabled: isPublic,
        welcomeGreeting: greeting,
      });

      if (res.success) {
        setMsg({ type: "success", text: "Portal settings updated successfully!" });
      } else {
        setMsg({ type: "error", text: res.error || "Failed to update." });
      }
    });
  };

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
      
      {msg && (
        <div className={`p-4 rounded-lg font-medium text-sm ${msg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Live Public Link</h2>
        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-slate-600 font-mono text-sm flex-1 truncate">{publicLink}</span>
          <a 
            href={`/${subdomain}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded transition"
          >
            Visit Portal
          </a>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Public Portal Status</h2>
          <p className="text-sm text-slate-500">Allow prospective students to apply from your public domain.</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={isPublic} 
            onChange={(e) => setIsPublic(e.target.checked)} 
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          <span className="ml-3 text-sm font-medium text-slate-700">
            {isPublic ? "ON" : "OFF"}
          </span>
        </label>
      </div>

      <div className="border-t border-slate-100 pt-6">
        <label className="block text-lg font-semibold text-slate-800 mb-2">Welcome Greeting</label>
        <p className="text-sm text-slate-500 mb-3">Customize the main headline displayed to parents and students on your portal.</p>
        <textarea
          className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          rows={3}
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder="e.g. Welcome to Riverside High School"
        />
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-6">
        <button 
          type="submit" 
          disabled={isPending}
          className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
