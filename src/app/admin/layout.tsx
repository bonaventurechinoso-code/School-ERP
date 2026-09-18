import { ReactNode } from "react";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { ThemeToggle } from "@/components/ThemeToggle";
import AccessDeniedFallback from "@/components/AccessDeniedFallback";
import SuperAdminSidebar from "./SuperAdminSidebar";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  let userRole = "";
  if (sessionToken) {
    try {
      const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(sessionToken, secret);
      userRole = ((payload.role as string) || "").toUpperCase();
    } catch (err) {
      console.error("[SuperAdminLayout] Session verification error:", err);
    }
  }

  const isDev = process.env.NODE_ENV === "development";

  // 1. ISOLATE STUDENTS AND STAFF FROM SUPER ADMIN LAYOUT (Skipped in development testing)
  if (!isDev) {
    if (userRole === "STUDENT") {
      redirect("/portal/student?denied=true");
    }

    if (userRole === "STAFF") {
      redirect("/portal/staff?denied=true");
    }
  }

  // Allow SUPER_ADMIN, ADMIN, and SCHOOL_ADMIN for local testing across the entire system
  const isSuperAdmin = isDev || ["SUPER_ADMIN", "ADMIN", "SCHOOL_ADMIN"].includes(userRole);
  if (sessionToken && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex flex-col transition-colors duration-200">
        <header className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <Image
              src="/img/business-logo.png"
              alt="School ERP"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg object-contain"
            />
            <h1 className="text-xl font-bold tracking-wide">Platform Super-Admin</h1>
          </div>
          <div className="bg-slate-800 rounded-full border border-slate-700">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <AccessDeniedFallback 
            role={userRole} 
            title="Platform Super-Admin Access Denied"
            message="This console is exclusively accessible by Platform Super-Administrators. Your role does not have permission to manage global tenants."
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex flex-col lg:flex-row transition-colors duration-200">
      <SuperAdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header Bar */}
        <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800/80 px-4 py-3 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Platform Administration
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 dark:bg-zinc-800 rounded-full border border-slate-200 dark:border-zinc-700">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Admin Platform Footer */}
        <footer className="mt-auto border-t border-slate-200 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xs py-4 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <Image
                src="/img/business-logo.png"
                alt="School ERP"
                width={20}
                height={20}
                className="w-5 h-5 rounded-md object-contain"
              />
              <span className="font-semibold text-slate-800 dark:text-zinc-200">School ERP Master Console</span>
              <span>•</span>
              <span>Powered by <strong className="text-slate-800 dark:text-zinc-100 font-semibold">BonaVee ICT</strong></span>
            </div>
            <div>
              <span>© {new Date().getFullYear()} BonaVee ICT. All rights reserved.</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

