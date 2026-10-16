"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton({
  className = "",
  label = "Logout",
  showIcon = true,
}: {
  className?: string;
  label?: string;
  showIcon?: boolean;
}) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      // 1. Call server-side logout - revokes session/refresh token, clears httpOnly cookies
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Continue even if server call fails
    }

    // 2. Wipe all client-side storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    // 3. Expire every accessible cookie (non-httpOnly ones)
    try {
      const cookieNames = [
        "schoolerp_tenant",
        "schoolDomain",
        "tenantId",
        "schoolerp_user_role",
        "schoolerp_assigned_tier",
        "auth_token",
        "auth_guard_status",
      ];
      for (const name of cookieNames) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Strict`;
      }
    } catch {}

    // 4. Hard navigate to /login - replaces history entry so Back won't return to dashboard
    router.push("/login");
    router.refresh();
    // 5. Force a full navigation so any cached React state is flushed and history is cleared
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    }, 50);
  };

  return (
    <button
      type="button"
      id="logout-button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      aria-label="Log out of your account"
      className={
        className ||
        "flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition-colors duration-150 px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      }
    >
      {showIcon && (
        <LogOut className={`w-4 h-4 shrink-0 ${isLoggingOut ? "animate-pulse" : ""}`} />
      )}
      <span>{isLoggingOut ? "Signing out..." : label}</span>
    </button>
  );
}
