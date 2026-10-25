import React from "react";
import SuperAdminSidebar from "@/app/super-admin/SuperAdminSidebar";

export const dynamic = "force-dynamic";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <aside className="w-[280px] shrink-0 sticky top-0 h-screen overflow-y-auto bg-[#0f172a]">
        <SuperAdminSidebar />
      </aside>
      <main className="flex-1 min-w-0 overflow-x-auto bg-[#f8fafc]">
        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}


