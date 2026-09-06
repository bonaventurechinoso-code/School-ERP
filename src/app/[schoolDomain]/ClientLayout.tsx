"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import AIChatWidget from "@/components/AIChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTenant } from "@/lib/tenant-context";

export default function ClientLayout({
  schoolName,
  headerContent,
  children,
}: {
  schoolName: string;
  headerContent: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const params = useParams();
  const schoolDomain = params.schoolDomain as string;
  
  // Use tenant context for dynamic nomenclature resolving
  const tenant = useTenant();
  const isHigherEd = tenant.institutionType === "HIGHER_ED";

  const links = [
    { label: "Dashboard", href: `/${schoolDomain}/dashboard` },
    { label: "Public Portal Settings", href: `/${schoolDomain}/portal-settings` },
    { label: "Admissions", href: `/${schoolDomain}/admissions` },
    { label: "Students", href: `/${schoolDomain}/students` },
    { label: isHigherEd ? "Faculty & Staff" : "Staff", href: `/${schoolDomain}/staff` },
    { label: "Scheduling", href: `/${schoolDomain}/scheduling` },
    { label: isHigherEd ? "Assessments" : "Exams", href: `/${schoolDomain}/exams` },
    { label: "Transcripts", href: `/${schoolDomain}/transcripts` },
    { label: "Communications", href: `/${schoolDomain}/communications` },
    { label: "Finance", href: `/${schoolDomain}/finance` },
    { label: "HR & Payroll", href: `/${schoolDomain}/hr` },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex overflow-hidden transition-colors duration-200">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 font-bold text-lg tracking-wide border-b border-slate-800 flex justify-between items-center">
          <span className="truncate">{schoolName.toUpperCase()}</span>
          <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
          {links.map((link) => (
            <a 
              key={link.href} 
              href={link.href} 
              className="px-4 py-2 rounded hover:bg-slate-800 transition-colors"
              onClick={() => setIsSidebarOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-6 w-full p-6 shadow-sm flex-shrink-0 sticky top-0 z-10 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg md:text-xl font-semibold text-slate-800 dark:text-zinc-100 break-words">Tenant Workspace</h1>
          </div>
          {/* Upper top-right navigation navbar utility bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
            <div className="w-full sm:w-auto mt-2 sm:mt-0">
              {headerContent}
            </div>
            <div className="border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-zinc-700 pt-4 sm:pt-0 pl-0 sm:pl-4 flex items-center w-full sm:w-auto mt-2 sm:mt-0">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="p-4 md:p-8 flex-1 text-slate-900 dark:text-zinc-50">
          {children}
        </div>
      </main>
      <AIChatWidget />
    </div>
  );
}
