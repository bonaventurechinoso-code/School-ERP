"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getStoredSession } from "@/lib/session-context";

export default function LogoutButton({
  className = "",
  label = "Log out",
  showIcon = true,
  schoolName = "",
}: {
  className?: string;
  label?: string;
  showIcon?: boolean;
  schoolName?: string;
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [targetSchoolName, setTargetSchoolName] = useState(schoolName || "Egede Primary School");

  useEffect(() => {
    if (schoolName) {
      setTargetSchoolName(schoolName);
      return;
    }
    if (typeof window !== "undefined") {
      try {
        const stored = getStoredSession();
        if (stored?.role === "SUPER_ADMIN" || window.location.pathname.includes("super-admin")) {
          setTargetSchoolName("the Platform Super Admin Console");
        } else if (stored?.tenantName) {
          setTargetSchoolName(stored.tenantName);
        } else if (stored?.schoolDomain === "egede") {
          setTargetSchoolName("Egede Primary School");
        } else if (stored?.schoolDomain) {
          setTargetSchoolName(`${stored.schoolDomain.charAt(0).toUpperCase() + stored.schoolDomain.slice(1)} School`);
        }
      } catch {}
    }
  }, [schoolName]);

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    localStorage.clear();
    sessionStorage.clear();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        id="logout-button"
        onClick={() => setShowModal(true)}
        disabled={isLoggingOut}
        aria-label="Log out of your account"
        className={
          className ||
          "h-10 w-10 md:w-auto md:px-3.5 md:py-2 rounded-full md:rounded-[10px] bg-[#FFF1F1] hover:bg-[#FFE4E6] dark:bg-red-500/10 dark:hover:bg-red-500/20 text-[#C81E1E] dark:text-red-400 font-semibold text-sm flex items-center justify-center md:gap-2 transition-all duration-150 cursor-pointer shadow-none border-0 focus:outline-none focus:ring-2 focus:ring-red-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        }
      >
        {showIcon && (
          <LogOut className={`w-4 h-4 shrink-0 ${isLoggingOut ? "animate-pulse" : ""}`} />
        )}
        <span className="hidden md:inline font-semibold text-sm leading-none">
          {isLoggingOut ? "Signing out..." : label}
        </span>
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-modal-title"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <LogOut className="w-5 h-5" />
            </div>

            <h3 id="logout-modal-title" className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Log out?
            </h3>

            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
              Are you sure you want to log out from {targetSchoolName}?
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={isLoggingOut}
                className="px-3.5 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-logout-button"
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isLoggingOut ? "Signing out..." : "Yes, Log out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
