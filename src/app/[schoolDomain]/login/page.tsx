"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTenant } from "@/lib/tenant-context";
import { Lock, Mail, ArrowRight, Building2, Eye, EyeOff } from "lucide-react";

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
          throw new Error("Unauthorized access");
        }

        // Role-based smart routing
        const canonicalRole = (role || "").toUpperCase();
        if (canonicalRole === "STUDENT") {
          router.push(`/${targetDomain}/portal/student`);
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
            Protected by Next-Gen ERP Security layer.
          </p>
        </div>
      </div>
    </div>
  );
}
