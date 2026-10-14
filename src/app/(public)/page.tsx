"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Building, Baby, ArrowRight, ShieldCheck, Zap, Globe, Users, Loader2, Menu, X, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SessionProvider, useSession } from "@/lib/session-context";

function MarketingNavbar() {
  const { session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [isSolutionsOpen, setIsSolutionsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthenticated = mounted && (status === "authenticated" || Boolean(session));

  return (
    <header className="sticky top-0 z-50 w-full max-w-full overflow-hidden bg-white/70 dark:bg-slate-950/70 backdrop-blur-md border-b border-slate-200/40 dark:border-slate-800/40 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="w-full max-w-full overflow-hidden px-4 sm:px-6 lg:px-8 flex justify-between items-center h-20">
          {/* Left: Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group focus:outline-none shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-950 dark:from-slate-950 dark:to-indigo-950 border border-slate-700/50 dark:border-slate-800 shadow-md flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
              <Image
                src="/img/business-logo.png"
                alt="School ERP Logo"
                width={36}
                height={36}
                className="w-full h-full object-contain p-1"
                priority
              />
            </div>
            <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
              School ERP
            </span>
          </Link>

          {/* Center: Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2 h-full">
            <div
              className="relative h-full flex items-center"
              onMouseEnter={() => setIsSolutionsOpen(true)}
              onMouseLeave={() => setIsSolutionsOpen(false)}
            >
              <button 
                type="button"
                onClick={() => setIsSolutionsOpen(!isSolutionsOpen)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs lg:text-sm font-semibold tracking-wide transition-colors duration-200 ${
                  isSolutionsOpen
                    ? "text-blue-600 dark:text-blue-400 bg-slate-100/90 dark:bg-slate-800/80 shadow-xs"
                    : "text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
                }`}
              >
                <span>Institutional Solutions</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isSolutionsOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
              </button>

              {isSolutionsOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1 w-80 z-50">
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 p-2 space-y-1">
                    <Link 
                      href="#daycare" 
                      onClick={() => setIsSolutionsOpen(false)}
                      className="flex items-start gap-3.5 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-xl transition-colors duration-200 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-orange-100/80 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Baby className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">Daycare & Nursery</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Early childhood management tailored for care</p>
                      </div>
                    </Link>

                    <Link 
                      href="#primary" 
                      onClick={() => setIsSolutionsOpen(false)}
                      className="flex items-start gap-3.5 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-xl transition-colors duration-200 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-blue-100/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Building className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">Primary Schools</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Complete lifecycle management for primary schools</p>
                      </div>
                    </Link>

                    <Link 
                      href="#secondary" 
                      onClick={() => setIsSolutionsOpen(false)}
                      className="flex items-start gap-3.5 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-xl transition-colors duration-200 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Building className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">Secondary Schools</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Streamlined academics for junior and senior secondary</p>
                      </div>
                    </Link>

                    <Link 
                      href="#higher-ed" 
                      onClick={() => setIsSolutionsOpen(false)}
                      className="flex items-start gap-3.5 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-xl transition-colors duration-200 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-purple-100/80 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Globe className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">Higher Education</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Advanced ERP for collegiate faculties and universities</p>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link 
              href="#features" 
              className="px-3.5 py-2 rounded-xl text-xs lg:text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200"
            >
              Platform Features
            </Link>

            <Link 
              href="#pricing" 
              className="px-3.5 py-2 rounded-xl text-xs lg:text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200"
            >
              Pricing
            </Link>
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center shrink-0">
              <ThemeToggle />
            </div>

            {/* Desktop: Conditional Sign In / Dashboard text link immediately left of [Onboard Institution] */}
            {isAuthenticated ? (
              <Link 
                href="/admin" 
                className="hidden md:inline-flex items-center px-3.5 py-2 rounded-xl text-xs lg:text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200"
              >
                Dashboard
              </Link>
            ) : (
              <Link 
                href="/login" 
                className="hidden md:inline-flex items-center px-3.5 py-2 rounded-xl text-xs lg:text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200"
              >
                Sign In
              </Link>
            )}

            <Link 
              href="/register" 
              className="group relative hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-500 hover:via-indigo-600 hover:to-blue-500 shadow-md shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/35 border border-indigo-400/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              <span>Onboard Institution</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>

            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200 focus:outline-none"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/50 dark:border-slate-800/50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-4 pt-3 pb-6 space-y-3">
          {/* Top: Sign In / Dashboard */}
          <div className="pb-2 border-b border-slate-200/40 dark:border-slate-800/40">
            {isAuthenticated ? (
              <Link 
                href="/admin" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl font-semibold text-sm text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200"
              >
                <span>Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link 
                href="/login" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl font-semibold text-sm text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200"
              >
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            <Link 
              href="#daycare" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200"
            >
              Institutional Solutions
            </Link>
            <Link 
              href="#features" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200"
            >
              Platform Features
            </Link>
            <Link 
              href="#pricing" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200"
            >
              Pricing
            </Link>
          </div>

          {/* Mobile Menu: Onboard Button */}
          <div className="pt-2">
            <Link 
              href="/register" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="group relative flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-500 hover:via-indigo-600 hover:to-blue-500 shadow-md shadow-indigo-600/25 transition-all duration-200"
            >
              <span>Onboard Institution</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export default function LandingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingGateway, setLoadingGateway] = useState<"trial" | "demo" | null>(null);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [isTrialSubmitting, setIsTrialSubmitting] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [trialForm, setTrialForm] = useState({
    schoolName: "",
    adminName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedTiers, setSelectedTiers] = useState<string[]>(["primary"]);
  const [tierSearch, setTierSearch] = useState("");
  const [showTierDropdown, setShowTierDropdown] = useState(false);
  const [step, setStep] = useState(1);

  const institutionTiers = [
    { id: "creche", name: "Creche / Daycare", group: "Early Childhood" },
    { id: "kindergarten", name: "Kindergarten", group: "Early Childhood" },
    { id: "nursery", name: "Nursery School", group: "Early Childhood" },
    { id: "primary", name: "Primary School", group: "Basic Education" },
    { id: "jss", name: "Junior Secondary School (JSS)", group: "Basic Education" },
    { id: "sss", name: "Senior Secondary School (SSS)", group: "Post-Basic" },
    { id: "combined", name: "Combined Nursery/Primary/Secondary", group: "Basic Education" },
    { id: "technical", name: "Technical College", group: "TVET" },
    { id: "vocational", name: "Vocational / Skills Acquisition Centre", group: "TVET" },
    { id: "vei", name: "Vocational Enterprise Institution (VEI)", group: "TVET" },
    { id: "iei", name: "Innovation Enterprise Institution (IEI)", group: "TVET" },
    { id: "islamiyya", name: "Islamiyya / Quranic / Almajiri", group: "Alternative" },
    { id: "adult", name: "Adult / Nomadic Education", group: "Alternative" },
    { id: "special", name: "Special Needs / Inclusive School", group: "Alternative" },
    { id: "coe", name: "College of Education", group: "Tertiary" },
    { id: "monotechnic", name: "Monotechnic", group: "Tertiary" },
    { id: "polytechnic", name: "Polytechnic", group: "Tertiary" },
    { id: "college_health", name: "College of Health / Nursing / Midwifery", group: "Tertiary" },
    { id: "college_agric", name: "College of Agriculture", group: "Tertiary" },
    { id: "university", name: "University", group: "Tertiary" },
    { id: "open_university", name: "Open University / Distance Learning", group: "Tertiary" },
    { id: "seminary", name: "Seminary / Bible College / Theology", group: "Religious" },
    { id: "professional", name: "Professional Institute / Academy", group: "Professional" },
  ];

  const handleTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrialError(null);
    if (selectedTiers.length === 0) {
      setTrialError("Please select at least one institution type.");
      return;
    }
    if (trialForm.password !== trialForm.confirmPassword) {
      setTrialError("Passwords do not match. Please re-enter.");
      return;
    }
    if (trialForm.password.length < 8) {
      setTrialError("Password must be at least 8 characters.");
      return;
    }
    setIsTrialSubmitting(true);
    try {
      const response = await fetch("/api/trials/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...trialForm,
          tier: selectedTiers[0],
          institutionTypes: selectedTiers,
          institutionTypeLabels: selectedTiers.map((id) => institutionTiers.find((x) => x.id === id)?.name),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error || "Failed to create free trial.");
      }

      if (data?.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }
      window.location.assign(`/onboarding?tenant=${data.tenant?.subdomain || "trial"}`);
    } catch (err: any) {
      setTrialError(err?.message || "An unexpected error occurred. Please try again.");
      setIsTrialSubmitting(false);
    }
  };

  const handleGatewayNavigation = async (type: "trial" | "demo", endpoint: string) => {
    // Prevent duplicate firing if a request is already in-flight
    if (loadingGateway) return;
    setLoadingGateway(type);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Gateway returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data?.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }
      window.location.assign(endpoint);
    } catch (err) {
      console.error(`[GATEWAY_INITIALIZATION_ERROR] Failed to navigate to ${type}:`, err);
      // Fallback navigation directly to endpoint GET route
      window.location.assign(endpoint);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 font-sans selection:bg-blue-200 dark:selection:bg-blue-900 transition-colors duration-300">
      {/* Navigation Header */}
      <SessionProvider session={null}>
        <MarketingNavbar />
      </SessionProvider>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 w-full max-w-full overflow-x-hidden px-4 sm:px-6 bg-slate-900">
        {/* Background Image Integration */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src="/assets/images/hero-graduation.jpg"
            alt="Students graduating and celebrating"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Dark overlay layer */}
        <div className="absolute inset-0 bg-slate-950/70 z-10 pointer-events-none"></div>

        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-100/10 dark:bg-blue-900/10 blur-3xl mix-blend-overlay z-10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-purple-100/10 dark:bg-purple-900/10 blur-3xl mix-blend-overlay z-10 pointer-events-none"></div>

        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/50 border border-blue-400/50 text-blue-300 text-xs font-bold uppercase tracking-wider mb-8 backdrop-blur-sm shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-blue-400"></span>
            Version 2.0 Now Live
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-8 leading-tight drop-shadow-lg">
            The Unified Engine for <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Modern Education
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-200 font-semibold max-w-3xl mx-auto mb-12 leading-relaxed drop-shadow-md">
            A single, scalable ERP platform designed to drive operational excellence from Early Childhood Centers to Universities and Polytechnics. Manage admissions, finance, and academics in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              type="button"
              id="start-free-trial-btn"
              onClick={() => setIsTrialModalOpen(true)}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 disabled:opacity-75 disabled:cursor-not-allowed disabled:pointer-events-none text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              type="button"
              id="explore-demo-btn"
              disabled={loadingGateway !== null}
              onClick={() => handleGatewayNavigation("demo", "/api/auth/demo-session")}
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 disabled:opacity-75 disabled:cursor-not-allowed disabled:pointer-events-none text-white border border-white/20 backdrop-blur-sm px-8 py-4 rounded-full font-bold text-lg transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {loadingGateway === "demo" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                  <span>Explore Demo Environment</span>
                </>
              ) : (
                <>
                  <span>Explore Demo Environment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white dark:bg-zinc-950 border-y border-slate-100 dark:border-zinc-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Built for Scale and Security</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-2xl mx-auto">Our multi-tenant architecture ensures complete data isolation while providing a powerful administrative platform.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 hover:-translate-y-2 hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-300 group">
              <div className="bg-blue-100 dark:bg-blue-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <ShieldCheck className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Multi-Tenant Security</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">Isolated database schemas for every institution. Absolute data privacy and compliance with global education standards.</p>
            </div>
            <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 hover:-translate-y-2 hover:shadow-xl hover:shadow-purple-900/10 transition-all duration-300 group">
              <div className="bg-purple-100 dark:bg-purple-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-7 w-7 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Unified Lifecycle</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">Track prospects from the initial admission stage all the way to alumni status seamlessly within a single intuitive dashboard.</p>
            </div>
            <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 hover:-translate-y-2 hover:shadow-xl hover:shadow-orange-900/10 transition-all duration-300 group">
              <div className="bg-orange-100 dark:bg-orange-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Zap className="h-7 w-7 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Automated Finance</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">Generate fee templates, process invoices automatically, and accept payments with zero manual reconciliation required.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white dark:bg-zinc-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Transparent, Tiered Pricing</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-2xl mx-auto">Select the perfect infrastructure tier tailored to your institution&apos;s specific operational needs and academic level.</p>

            {/* Billing Toggle Tabs */}
            <div className="flex items-center justify-center mt-8 p-1.5 bg-slate-100 dark:bg-zinc-800/60 rounded-xl inline-flex mx-auto border border-slate-200 dark:border-zinc-700/50">
              <button
                onClick={() => setIsAnnual(false)}
                className={`relative px-8 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${!isAnnual
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`relative flex items-center gap-2 px-8 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${isAnnual
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
              >
                Annually
                <span className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${isAnnual
                    ? 'bg-white/20 text-white'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  }`}>
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Card 1 */}
            <div className="bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 flex flex-col hover:border-blue-300 dark:hover:border-blue-800 transition-all">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Basic Education Setup</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 min-h-[40px]">Targeted at Daycares, Nursery, and Primary schools.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">{isAnnual ? '₦20,000' : '₦25,000'}</span>
                <span className="text-slate-500 dark:text-slate-400">{isAnnual ? '/yr' : '/mo'}</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" /><span className="text-sm text-slate-700 dark:text-slate-300">Student & Staff Profiles</span></li>
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" /><span className="text-sm text-slate-700 dark:text-slate-300">Basic Report Card Generation</span></li>
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" /><span className="text-sm text-slate-700 dark:text-slate-300">Basic Parent Communication Tools</span></li>
              </ul>
              <Link href="/register?tier=PRIMARY" className="w-full text-center bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-semibold py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors">
                Onboard Institution
              </Link>
            </div>

            {/* Card 2 */}
            <div className="bg-blue-600 dark:bg-blue-900 text-white border border-blue-500 dark:border-blue-800 rounded-3xl p-8 flex flex-col relative transform lg:-translate-y-4 shadow-2xl shadow-blue-900/20">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 dark:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest py-1 px-3 rounded-full">Most Popular</div>
              <h3 className="text-2xl font-bold mb-2">Secondary Excellence Plan</h3>
              <p className="text-blue-100 dark:text-blue-200 text-sm mb-6 min-h-[40px]">Targeted at Junior & Senior Secondary schools.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold">{isAnnual ? '₦40,000' : '₦50,000'}</span>
                <span className="text-blue-200">{isAnnual ? '/yr' : '/mo'}</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-300 shrink-0" /><span className="text-sm text-white">All Basic Features</span></li>
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-300 shrink-0" /><span className="text-sm text-white">Continuous Assessment Tracking</span></li>
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-300 shrink-0" /><span className="text-sm text-white">Complex Exam Processing</span></li>
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-300 shrink-0" /><span className="text-sm text-white">Behavior Monitoring</span></li>
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-300 shrink-0" /><span className="text-sm text-white">Class Portal Management</span></li>
              </ul>
              <Link href="/register?tier=SECONDARY" className="w-full text-center bg-white text-blue-600 font-bold py-3 rounded-xl hover:bg-slate-50 transition-colors shadow-lg">
                Onboard Institution
              </Link>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 flex flex-col hover:border-blue-300 dark:hover:border-blue-800 transition-all">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Enterprise Higher Ed</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 min-h-[40px]">Targeted at Universities, Polytechnics, and Colleges of Education.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">{isAnnual ? '₦120,000' : '₦150,000'}</span>
                <span className="text-slate-500 dark:text-slate-400">{isAnnual ? '/yr' : '/mo'}</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" /><span className="text-sm text-slate-700 dark:text-slate-300">All Secondary Features</span></li>
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" /><span className="text-sm text-slate-700 dark:text-slate-300">Multi-Departmental Faculty Controls</span></li>
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" /><span className="text-sm text-slate-700 dark:text-slate-300">Dynamic Semester Course Registration</span></li>
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" /><span className="text-sm text-slate-700 dark:text-slate-300">Transcript Management</span></li>
                <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" /><span className="text-sm text-slate-700 dark:text-slate-300">Multi-Tenant Split Billing Integration</span></li>
              </ul>
              <Link href="/register?tier=UNIVERSITY" className="w-full text-center bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-semibold py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors">
                Onboard Institution
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 bg-slate-900 dark:bg-black relative overflow-hidden transition-colors duration-300">
        <div className="absolute inset-0 bg-blue-600/10 mix-blend-overlay"></div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl font-extrabold text-white mb-6">Ready to Transform Your Institution?</h2>
          <p className="text-slate-300 text-lg mb-10">Join hundreds of schools globally that have upgraded to School ERP.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)]">
            Create Institutional Portal <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Main Public Page Footer Layout */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Column 1: Brand & Tagline */}
            <div className="md:col-span-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                  <Image
                    src="/img/business-logo.png"
                    alt="School ERP Logo"
                    width={36}
                    height={36}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-extrabold text-xl tracking-tight text-white">
                  School ERP
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                The enterprise-grade, multi-tenant operating system powering nurseries, primary schools, secondary colleges, and universities with database-isolated architecture.
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>All System Services Operational</span>
              </div>
            </div>

            {/* Column 2: Solutions */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Tier Solutions</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#daycare" className="hover:text-blue-400 transition-colors">Daycare & Nursery</Link></li>
                <li><Link href="#primary" className="hover:text-blue-400 transition-colors">Primary Education</Link></li>
                <li><Link href="#secondary" className="hover:text-blue-400 transition-colors">Secondary & High Schools</Link></li>
                <li><Link href="#higher-ed" className="hover:text-blue-400 transition-colors">Universities & Colleges</Link></li>
                <li><Link href="/register" className="hover:text-blue-400 transition-colors">Multi-Tier Integration</Link></li>
              </ul>
            </div>

            {/* Column 3: Platform Portals */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Platform Gateways</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/demo/login" className="hover:text-blue-400 transition-colors">Demo School Environment</Link></li>
                <li><Link href="/portal/student" className="hover:text-blue-400 transition-colors">Student Learning Portal</Link></li>
                <li><Link href="/portal/staff" className="hover:text-blue-400 transition-colors">Staff & Faculty Portal</Link></li>
                <li><Link href="/admin" className="hover:text-blue-400 transition-colors">Super-Admin Console</Link></li>
                <li><Link href="/register" className="hover:text-blue-400 transition-colors">Institutional Onboarding</Link></li>
              </ul>
            </div>

            {/* Column 4: Architecture & Trust */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Security & Trust</h4>
              <ul className="space-y-2 text-sm">
                <li className="text-slate-400">Database-per-Tenant Isolation</li>
                <li className="text-slate-400">Dual-Key RBAC Enforcement</li>
                <li className="text-slate-400">Redis L1/L2 Caching Pipeline</li>
                <li className="text-slate-400">Automated Sandbox Cleanup</li>
                <li className="text-slate-400">Automated Term-End Promotions</li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                <Image
                  src="/img/business-logo.png"
                  alt="School ERP Logo"
                  width={20}
                  height={20}
                  className="w-full h-full object-contain"
                />
              </div>
              <p>© {new Date().getFullYear()} School ERP. All rights reserved.</p>
            </div>
            <p>Unified Enterprise Academic Infrastructure</p>
          </div>
        </div>
      </footer>
      {/* Free Trial Modal */}
      {isTrialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => { setIsTrialModalOpen(false); setStep(1); }}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 mb-2">
                14-Day Free Trial
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Start Your Institution Cloud
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Zero setup charge. Creates a dedicated, isolated tenant database.
              </p>
            </div>

            <form onSubmit={handleTrialSubmit} className="space-y-4">

              {/* Step Indicator */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`flex-1 h-2 rounded-full transition-colors duration-300 ${step >= 1 ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`} />
                <div className={`flex-1 h-2 rounded-full transition-colors duration-300 ${step >= 2 ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`} />
              </div>
              <div className="flex justify-between text-xs mb-4">
                <span className={step === 1 ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-400 dark:text-slate-500"}>1. Institution Details</span>
                <span className={step === 2 ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-400 dark:text-slate-500"}>2. Security</span>
              </div>

              {/* ── PHASE 1 ── */}
              {step === 1 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      School / Institution Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Grace Hills Academy"
                      value={trialForm.schoolName}
                      onChange={(e) => setTrialForm({ ...trialForm, schoolName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Administrator Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Sarah Ade"
                      value={trialForm.adminName}
                      onChange={(e) => setTrialForm({ ...trialForm, adminName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Work Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="admin@school.edu.ng"
                        value={trialForm.email}
                        onChange={(e) => setTrialForm({ ...trialForm, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Contact Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+234 800 123 4567"
                        value={trialForm.phone}
                        onChange={(e) => setTrialForm({ ...trialForm, phone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Institution Type Multi-Select */}
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Select Institution Types <span className="text-rose-500">*</span>
                      <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">(You can select multiple)</span>
                    </label>
                    <div
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer flex items-center justify-between select-none"
                      onClick={() => { setShowTierDropdown((v) => !v); setTierSearch(""); }}
                      role="combobox"
                      aria-expanded={showTierDropdown}
                      aria-controls="tier-listbox"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setShowTierDropdown((v) => !v); setTierSearch(""); } }}
                    >
                      <span className={selectedTiers.length > 0 ? "" : "text-slate-400 dark:text-slate-500"}>
                        {selectedTiers.length > 0
                          ? `${selectedTiers.length} type${selectedTiers.length > 1 ? "s" : ""} selected`
                          : "Search and select... e.g Primary, Polytechnic"}
                      </span>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showTierDropdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>

                    {showTierDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Search and select... e.g Primary, Polytechnic"
                            value={tierSearch}
                            onChange={(e) => setTierSearch(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <ul id="tier-listbox" role="listbox" className="max-h-52 overflow-y-auto">
                          {institutionTiers
                            .filter((t) => t.name.toLowerCase().includes(tierSearch.toLowerCase()) || t.group.toLowerCase().includes(tierSearch.toLowerCase()))
                            .map((tier) => {
                              const isSelected = selectedTiers.includes(tier.id);
                              return (
                                <li
                                  key={tier.id}
                                  role="option"
                                  aria-selected={isSelected}
                                  onClick={() => {
                                    setSelectedTiers((prev) =>
                                      isSelected ? prev.filter((x) => x !== tier.id) : [...prev, tier.id]
                                    );
                                  }}
                                  className={`flex items-center justify-between px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                                    isSelected
                                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  <div>
                                    <p className="font-semibold">{tier.name}</p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{tier.group}</p>
                                  </div>
                                  {isSelected && (
                                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  )}
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    )}

                    {/* Selected chips */}
                    {selectedTiers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedTiers.map((id) => {
                          const t = institutionTiers.find((x) => x.id === id);
                          return (
                            <span
                              key={id}
                              className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full text-xs flex items-center gap-1 font-medium"
                            >
                              {t?.name}
                              <button
                                type="button"
                                onClick={() => setSelectedTiers((prev) => prev.filter((x) => x !== id))}
                                className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-100 transition-colors leading-none"
                                aria-label={`Remove ${t?.name}`}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!trialForm.schoolName || !trialForm.adminName || !trialForm.email || !trialForm.phone) {
                        alert("Fill all fields in this step before continuing.");
                        return;
                      }
                      if (selectedTiers.length === 0) {
                        alert("Select at least one institution type before continuing.");
                        return;
                      }
                      setStep(2);
                    }}
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continue to Security</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* ── PHASE 2 ── */}
              {step === 2 && (
                <>
                  {/* Summary box */}
                  <div className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <div><span className="font-semibold text-slate-800 dark:text-slate-100">School:</span> {trialForm.schoolName || <span className="italic text-slate-400">—</span>}</div>
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">Types:</span>
                      {selectedTiers.map((id) => {
                        const t = institutionTiers.find((x) => x.id === id);
                        return <span key={id} className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-[10px] font-medium">{t?.name}</span>;
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Admin Account Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="Minimum 8 characters"
                        value={trialForm.password}
                        onChange={(e) => setTrialForm({ ...trialForm, password: e.target.value })}
                        className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        placeholder="Re-enter your password"
                        value={trialForm.confirmPassword}
                        onChange={(e) => setTrialForm({ ...trialForm, confirmPassword: e.target.value })}
                        className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {trialForm.confirmPassword && trialForm.password !== trialForm.confirmPassword && (
                      <p className="text-xs text-rose-500 font-semibold mt-1">Passwords do not match.</p>
                    )}
                  </div>

                  {trialError && (
                    <p className="text-xs text-rose-500 font-semibold">{trialError}</p>
                  )}

                  <div className="flex gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-3.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={isTrialSubmitting || (trialForm.confirmPassword.length > 0 && trialForm.password !== trialForm.confirmPassword)}
                      className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-75 text-white font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isTrialSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Provisioning Trial...</span>
                        </>
                      ) : (
                        <>
                          <span>Create 14-Day Free Trial</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
