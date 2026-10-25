import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { basePrisma } from "@/lib/tenant-prisma";
import { ShieldCheck, Mail, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Platform Users & Roles | Super Admin",
  description: "Platform-level user governance and role access control.",
};

export default async function SuperAdminUsersPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const rawRole = (user?.role || user?.userRole || "").toUpperCase();
  const isSuperAdmin = rawRole === "SUPER_ADMIN" || Boolean(user?.isSuperAdmin);

  if (!session || !isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 p-8 rounded-3xl shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto font-black text-2xl border border-rose-200 dark:border-rose-800">
            403
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Access Denied (403 Forbidden)
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Platform Users &amp; Roles is strictly restricted to Central Platform Super-Administrators.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch platform administrators
  const superAdminUsers = await basePrisma.user.findMany({
    where: {
      role: "SUPER_ADMIN",
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      createdAt: true,
    },
    take: 50,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700">
              Module 4
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Identity & Access Management
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Platform Users &amp; Roles
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Platform-level user governance, privileged identity directory, and super-admin credentials
          </p>
        </div>
      </div>

      {/* Users List Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Super-Administrator Accounts ({superAdminUsers.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">ROOT_LEVEL_PRIVILEGES</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
          {superAdminUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No additional super-administrators registered in database. Root access active via session.
            </div>
          ) : (
            superAdminUsers.map((u) => {
              const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || "Super Admin";
              const initials = fullName
                .split(" ")
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase() || "SA";

              return (
                <div key={u.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                      {initials}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {fullName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {u.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {u.role}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      {u.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
