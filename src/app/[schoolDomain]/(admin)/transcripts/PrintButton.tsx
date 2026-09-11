"use client";

import React from "react";
import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button 
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 bg-slate-800 text-white px-6 py-2 rounded shadow hover:bg-slate-900 transition font-medium text-sm"
    >
      <Printer className="w-4 h-4" />
      <span>Print Transcript</span>
    </button>
  );
}
