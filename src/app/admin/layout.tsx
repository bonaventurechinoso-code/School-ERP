import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { ThemeToggle } from "@/components/ThemeToggle";
import AccessDeniedFallback from "@/components/AccessDeniedFallback";

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

  // 1. ISOLATE STUDENTS AND STAFF FROM SUPER ADMIN LAYOUT
  if (userRole === "STUDENT") {
    redirect("/portal/student?denied=true");
  }

  if (userRole === "STAFF") {
    redirect("/portal/staff?denied=true");
  }

  // If role is strictly non-admin, render fallback
  const isSuperAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userRole);
  if (sessionToken && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex flex-col transition-colors duration-200">
        <header className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-md">
          <h1 className="text-xl font-bold tracking-wide">Platform Super-Admin</h1>
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
