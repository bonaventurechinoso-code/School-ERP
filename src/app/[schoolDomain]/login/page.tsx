"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTenant } from "@/lib/tenant-context";
import { Lock, Mail, ArrowRight, Building2, Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";
import { persistStoredSession, AUTH_UPDATE_EVENT } from "@/lib/session-context";
import { beginTokenWait, setAuthToken } from "@/lib/api-client";

export default function TenantLoginPage() {

  const router = useRouter();
  const tenant = useTenant();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`Verifying password input pattern for length: ${password.length}`);
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      beginTokenWait();
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, schoolDomain: tenant.subdomain })
      });

      const data = await res.json();

      if (res.ok) {
        // Extract validated role and schoolDomain from payload
        const { role, schoolDomain: targetDomain } = data;
        
        if (!role || !targetDomain) {
          setAuthToken(null);
          throw new Error("Unauthorized access");
        }

        const effectiveSessionToken = data.sessionToken || data.token;
        if (effectiveSessionToken) {
          setAuthToken(data.token || effectiveSessionToken, effectiveSessionToken);
        }

        // Persist session payload to sessionStorage & localStorage for instant reactive hydration
        const sessionPayload = {
          userId: data.userId || `user-${(role || "staff").toLowerCase()}`,
          email: email.trim().toLowerCase(),
          tenantId: tenant.id,
          schoolDomain: targetDomain,
          tenantName: tenant.name,
          role: data.role,
          staffRole: data.staffRole,
          activeTiers: data.activeTiers || [],
          permissions: data.permissions || [],
          sessionToken: effectiveSessionToken,
          token: data.token,
        };
        persistStoredSession(sessionPayload);
        window.dispatchEvent(new Event(AUTH_UPDATE_EVENT));

        // Invalidate Next.js client router cache so layouts re-read cookies
        router.refresh();

        // Check if user is logging in using a temporary password (forced initial reset)
        if (data.mustChangePassword || data.redirectUrl?.includes('change-password')) {
          router.push(data.redirectUrl || "/change-password");
          return;
        }

        // Role-based smart routing
        const canonicalRole = (role || "").toUpperCase();
        const staffRoleStr = (data.staffRole || "").toUpperCase();
        const isBursarRole =
          canonicalRole === "BURSAR" ||
          canonicalRole === "ACCOUNTANT" ||
          staffRoleStr.includes("BURSAR") ||
          staffRoleStr.includes("ACCOUNTANT") ||
          staffRoleStr.includes("CASHIER") ||
          staffRoleStr.includes("FINANCE");

        if (canonicalRole === "STUDENT") {
          router.push(`/${targetDomain}/portal/student`);
        } else if (isBursarRole) {
          router.push("/bursar");
        } else if (canonicalRole === "STAFF" || canonicalRole === "TEACHER") {
          router.push(`/${targetDomain}/portal/staff`);
        } else {
          router.push(`/${targetDomain}/dashboard`);
        }
      } else {
        if (res.status === 401 || res.status === 403) {
          throw new Error(data.error || "Unauthorized access");
        }
        setErrorMsg(data.error || "Authentication failed. Please check your credentials.");
      }
    } catch (error: any) {
      setErrorMsg(error.message || "An unexpected network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const brandColor = tenant?.branding?.primaryColor || "#3b82f6";
  const schoolName = tenant?.name || "Staff Portal";

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-4 selection:bg-blue-900">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-8 md:p-10 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Image
              src="/img/business-logo.png"
              alt="School ERP"
              width={28}
              height={28}
              className="w-7 h-7 rounded-lg object-contain"
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">School ERP Platform</span>
          </div>
          <div 
            className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
            style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
          >
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Staff Portal</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">
            Sign in to {schoolName}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-900 rounded-xl text-red-400 text-sm text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Institutional Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-500" />
              </div>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@school.edu" 
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-inner"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Secure Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input 
                type={showPassword ? "text" : "password"}
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full pl-11 pr-12 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-inner"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between w-full text-xs text-slate-300 mt-2 mb-4">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-200 transition-colors">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 transition"
              />
              <span>Remember me</span>
            </label>
            <Link
              href={`/${tenant?.subdomain || ""}/forgot-password`}
              className="text-slate-400 hover:text-blue-400 font-medium transition-colors"
            >
              Forgot Password?
            </Link>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-70"
            style={{ backgroundColor: brandColor }}
          >
            {isSubmitting ? "Authenticating..." : "Secure Login"}
            {!isSubmitting && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-3 text-slate-500 font-semibold tracking-wider">
              Or continue with
            </span>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: `/${tenant?.subdomain || "greenwood"}/dashboard` })}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-700 hover:border-slate-600 rounded-xl text-white font-semibold text-sm transition-all shadow-md group"
          >
            <svg className="w-5 h-5 mr-2 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>


        <div className="mt-6 pt-6 border-t border-slate-800/80 text-center space-y-2">
          <p className="text-slate-400 text-xs font-medium">
            Are you an enrolled student?
          </p>
          <Link

            href={`/${tenant?.subdomain || ""}/portal/student`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <span>Access Student Learning Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-xs">
            Protected by School ERP Security layer.
          </p>
        </div>
      </div>
    </div>
  );
}
