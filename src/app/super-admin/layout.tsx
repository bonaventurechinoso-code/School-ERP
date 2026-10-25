import React from "react";
import SuperAdminSidebar from "@/app/super-admin/SuperAdminSidebar";

export const dynamic = "force-dynamic";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SuperAdminSidebar />
      <main className="flex-1 bg-slate-50">{children}</main>
    </div>
  );
}

