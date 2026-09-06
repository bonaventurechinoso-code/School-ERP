import { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex flex-col transition-colors duration-200">
      <header className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-md">
        <h1 className="text-xl font-bold tracking-wide">Platform Super-Admin</h1>
        {/* Upper top-right navigation navbar utility bar Theme Toggle */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-800 rounded-full border border-slate-700">
            <ThemeToggle />
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
