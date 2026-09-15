"use client";

import React, { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Lock, Mail, ArrowRight, ShieldCheck, Eye, EyeOff, Globe } from "lucide-react";

function UniversalLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
  const urlError = searchParams.get("error");


  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolDomain, setSchoolDomain] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(
    urlError === "CredentialsSignin"
      ? "Invalid email or password. Please check your credentials."
      : urlError
      ? `Authentication error: ${urlError}`
      : ""
  );

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        schoolDomain: schoolDomain.trim() || undefined,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        setErrorMsg("Invalid credentials. Please verify your email and password.");
      } else if (res?.ok) {
        // If domain specified or platform admin
        if (email.includes("superadmin") || email.includes("admin@schoolerp.com")) {
          router.push("/admin");
        } else if (schoolDomain) {
          router.push(`/${schoolDomain.trim().toLowerCase()}/dashboard`);
        } else {
          router.push(res.url || "/admin");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl: schoolDomain ? `/${schoolDomain.trim().toLowerCase()}/dashboard` : "/admin" });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-blue-900">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image
              src="/img/business-logo.png"
              alt="School ERP"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg object-contain"
            />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">School ERP Platform</span>
          </div>

          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-extrabold text-white tracking-tight">Enterprise Login</h1>
          <p className="text-slate-400 text-xs mt-1 font-medium">
            Sign in via Google OAuth or institutional credentials
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3.5 bg-red-950/60 border border-red-900/80 rounded-xl text-red-300 text-xs text-center font-medium leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* Google OAuth Provider Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-white font-semibold text-sm transition-all shadow-md group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-3 text-slate-500 font-semibold tracking-wider">
              Or sign in with password
            </span>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleCredentialsLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@school.edu or name@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">School Domain (Optional for Admins)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Globe className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="text"
                value={schoolDomain}
                onChange={(e) => setSchoolDomain(e.target.value)}
                placeholder="e.g. greenwood (leave blank for Super-Admin)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-70"
          >
            {isSubmitting ? "Authenticating..." : "Sign In to ERP"}
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800/80 text-center space-y-2">
          <p className="text-slate-400 text-xs">
            Need to register a new school institution?
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span>Start 14-Day Free School Trial</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function UniversalLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading portal...</div>}>
      <UniversalLoginPageContent />
    </Suspense>
  );
}

