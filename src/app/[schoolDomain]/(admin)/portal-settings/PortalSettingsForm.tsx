"use client";

import React, { useState, useTransition } from "react";
import { updatePortalSettings } from "./actions";

export default function PortalSettingsForm({
  schoolId,
  subdomain,
  initialName,
  initialPhone,
  initialIsPublic,
  initialGreeting,
}: {
  schoolId: string;
  subdomain: string;
  initialName: string;
  initialPhone: string;
  initialIsPublic: boolean;
  initialGreeting: string;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [greeting, setGreeting] = useState(initialGreeting || "");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const [origin, setOrigin] = useState("");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(`${window.location.protocol}//${window.location.host}`);
    }
  }, []);

  const publicPortalUrl = `${origin}/${subdomain}`;
  const publicApplyUrl = `${origin}/${subdomain}/apply`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updatePortalSettings(schoolId, {
        name,
        contactPhone: phone,
        isPublicPortalEnabled: isPublic,
        welcomeGreeting: greeting,
      });

      if (res.success) {
        setMsg({ type: "success", text: "Portal settings updated and published successfully!" });
      } else {
        setMsg({ type: "error", text: res.error || "Failed to update portal settings." });
      }
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {msg && (
        <div className={`p-4 rounded-xl font-medium text-sm border ${msg.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {/* PUBLIC LINKS QUICK ACCESS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Public Portal URLs</h2>
        <p className="text-sm text-slate-500">Share these official URLs with prospective parents, students, and stakeholders.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">School Public Landing</span>
              <div className="font-mono text-xs text-slate-700 truncate mt-1">{publicPortalUrl}</div>
            </div>
            <div className="flex gap-2">
              <a 
                href={publicPortalUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
              >
                Open Landing
              </a>
              <button
                type="button"
                onClick={() => handleCopy(publicPortalUrl, "portal")}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 transition"
              >
                {copiedLink === "portal" ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>

          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Online Application Form</span>
              <div className="font-mono text-xs text-indigo-900 truncate mt-1">{publicApplyUrl}</div>
            </div>
            <div className="flex gap-2">
              <a 
                href={publicApplyUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
              >
                Open Application
              </a>
              <button
                type="button"
                onClick={() => handleCopy(publicApplyUrl, "apply")}
                className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-50 transition"
              >
                {copiedLink === "apply" ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* INSTITUTION SETTINGS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <h2 className="text-lg font-bold text-slate-800">Institution Identity & Contact</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Official School Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Greenwood Academy"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Admissions Helpline / Contact Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +234 800 123 4567"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* STATUS TOGGLE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 pt-6 gap-4">
          <div>
            <h3 className="font-semibold text-slate-800">Public Online Application Portal</h3>
            <p className="text-sm text-slate-500">When enabled, prospective parents and students can submit online admission applications.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={isPublic} 
              onChange={(e) => setIsPublic(e.target.checked)} 
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            <span className="ml-3 text-sm font-bold text-slate-700">
              {isPublic ? "ENABLED" : "DISABLED"}
            </span>
          </label>
        </div>

        {/* WELCOME HEADLINE */}
        <div className="border-t border-slate-100 pt-6">
          <label className="block text-sm font-semibold text-slate-800 mb-1">Welcome Headline & Announcement</label>
          <p className="text-xs text-slate-500 mb-2">Displayed in high prominence on the portal landing page and application header.</p>
          <textarea
            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            rows={3}
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder="Welcome to our institution!"
          />
        </div>

        {/* LIVE PREVIEW BANNER */}
        <div className="border-t border-slate-100 pt-6">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Live Public Header Preview</span>
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 rounded-xl shadow-inner flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h4 className="text-lg font-bold">{name || "School Name"}</h4>
              <p className="text-indigo-200 text-sm mt-1">{greeting || "Welcome to our institution!"}</p>
            </div>
            {phone && (
              <div className="text-xs bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">
                Helpline: {phone}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button 
            type="submit" 
            disabled={isPending}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition disabled:opacity-50 shadow-sm"
          >
            {isPending ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </form>
  );
}
