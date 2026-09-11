"use client";

import { useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { Menu, X, Home, Users, CreditCard, Settings, UserPlus, Briefcase, Calendar, GraduationCap, FileSpreadsheet, BookOpen, MessageSquare, Building2 } from "lucide-react";
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
  const pathname = usePathname();
  const schoolDomain = params.schoolDomain as string;

  // Use tenant context for dynamic nomenclature resolving
  const tenant = useTenant();
  const isHigherEd = tenant.institutionType === "HIGHER_ED";

  const isPrimary = tenant.preciseTier === "PRIMARY";

  const allLinks = [
    { label: "Dashboard", href: `/${schoolDomain}/dashboard`, icon: Home },
    { label: "Public Portal Settings", href: `/${schoolDomain}/portal-settings`, icon: Settings },
    { label: "Enrollment", href: `/${schoolDomain}/admissions`, icon: UserPlus },
    { label: "Students", href: `/${schoolDomain}/students`, icon: Users },
    { label: "Staff", href: `/${schoolDomain}/staff`, icon: Briefcase },
    { label: "Timetable", href: `/${schoolDomain}/scheduling`, icon: Calendar },
    { label: "Assessments & Terms", href: `/${schoolDomain}/exams`, icon: GraduationCap },
    { label: "Report Cards", href: `/${schoolDomain}/report-cards`, icon: FileSpreadsheet },
    { label: "Academic Records", href: `/${schoolDomain}/transcripts`, icon: BookOpen },
    { label: "Communications", href: `/${schoolDomain}/communications`, icon: MessageSquare },
    { label: "Finance", href: `/${schoolDomain}/finance`, icon: CreditCard },
    { label: "Management & Payroll", href: `/${schoolDomain}/hr`, icon: Building2 },
  ];

  const userRole = (tenant.userRole || "ADMIN").toUpperCase();

  const links = (() => {
    switch (userRole) {
      case "TEACHER":
        return allLinks.filter(link =>
          ["Dashboard", "Students", "Timetable", "Assessments & Terms", "Report Cards", "Academic Records"].includes(link.label)
        );
      case "BURSAR":
        return allLinks.filter(link =>
          ["Dashboard", "Students", "Finance", "Communications"].includes(link.label)
        );
      case "STUDENT":
        return allLinks.filter(link =>
          ["Dashboard", "Timetable", "Academic Records"].includes(link.label)
        );
      case "ADMIN":
      default:
        return allLinks;
    }
  })();

  const mobileNavLinks = [
    { label: "Home", href: `/${schoolDomain}/dashboard`, icon: Home },
    { label: "Students", href: `/${schoolDomain}/students`, icon: Users },
    { label: "Enrollment", href: `/${schoolDomain}/admissions`, icon: UserPlus },
    { label: "Staff", href: `/${schoolDomain}/staff`, icon: Briefcase },
    { label: "Finance", href: `/${schoolDomain}/finance`, icon: CreditCard },
  ].filter(nav => links.some(link => link.href === nav.href));

  return (
    <div className="flex flex-1 h-full w-full overflow-hidden bg-slate-50 transition-colors duration-200 dark:bg-zinc-950">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900/95 dark:bg-zinc-950/95 backdrop-blur-xl border-r border-slate-800/50 text-white flex flex-col transition-transform duration-300 ease-in-out md:relative md:w-64 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      >
        <div className="p-6 font-bold text-lg tracking-wide border-b border-slate-800/50 flex justify-between items-center bg-slate-900/50 dark:bg-zinc-950/50">
          <span className="truncate bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{schoolName.toUpperCase()}</span>
          <button className="md:hidden p-2 -mr-2 rounded-lg hover:bg-slate-800 active:scale-95 transition-all" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-6 flex flex-col gap-1 overflow-y-auto">
          {links.map((link) => {
            const isActive = pathname?.startsWith(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-95 ${isActive ? 'bg-indigo-600/10 text-indigo-400 font-medium' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                {link.icon && <link.icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />}
                <span>{link.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto pb-20 md:pb-0 relative">
        <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-zinc-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 w-full p-4 md:p-6 shadow-sm flex-shrink-0 sticky top-0 z-10 transition-colors duration-200">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-2 -ml-2 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl active:scale-95 transition-all"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-xs uppercase tracking-widest text-slate-500 dark:text-zinc-400 font-bold break-words">Administrative Desk</h1>
            </div>
            {/* Theme Toggle mobile inline */}
            <div className="md:hidden flex items-center">
              <ThemeToggle />
            </div>
          </div>
          {/* Upper top-right navigation navbar utility bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
            <div className="w-full sm:w-auto mt-2 sm:mt-0">
              {headerContent}
            </div>
            <div className="hidden md:flex border-l border-slate-200 dark:border-zinc-700 pl-4 items-center">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="p-4 md:p-8 flex-1 text-slate-900 dark:text-zinc-50 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {mobileNavLinks.length > 0 && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-zinc-800/50 flex overflow-x-auto overflow-y-hidden hide-scrollbar p-2 z-40 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.05)]">
          {mobileNavLinks.map((link) => {
            const isActive = pathname?.startsWith(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                className={`flex flex-col flex-1 items-center justify-center p-2 rounded-xl min-w-[72px] transition-all active:scale-95 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {link.icon && <link.icon className={`w-6 h-6 mb-1 flex-shrink-0 ${isActive ? 'fill-indigo-600/20 dark:fill-indigo-400/20' : ''}`} />}
                <span className="text-[10px] font-semibold tracking-wide truncate max-w-full">{link.label}</span>
              </a>
            );
          })}
        </nav>
      )}

      <AIChatWidget />
    </div>
  );
}
