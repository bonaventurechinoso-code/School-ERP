"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

export interface DocumentViewerProps {
  url?: string;
  path?: string;
  name?: string;
  className?: string;
}

export function DocumentViewer({ url, path, name, className }: DocumentViewerProps) {
  const rawHref = (url || path || "").trim();
  if (!rawHref) return null;

  // Route /uploads/... through /api/uploads/... to cleanly bypass tenant slug checks
  const fileUrl = rawHref.startsWith("/uploads/") ? `/api${rawHref}` : rawHref;

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`View ${name || "document"}`}
      className={
        className ||
        "px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 font-bold text-xs flex items-center gap-1 transition shrink-0 ml-2"
      }
    >
      <ExternalLink className="w-3 h-3" />
      <span>View</span>
    </a>
  );
}

export default DocumentViewer;
