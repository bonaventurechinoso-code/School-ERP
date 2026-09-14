"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Building, Baby, ArrowRight, ShieldCheck, Zap, Globe, Users } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
  const [isSolutionsOpen, setIsSolutionsOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 font-sans selection:bg-blue-200 dark:selection:bg-blue-900 transition-colors duration-300">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full h-20 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md border-b border-slate-200/40 dark:border-slate-800/40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full">
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
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <div className="flex items-center shrink-0">
                <ThemeToggle />
              </div>
              <Link 
                href="/register" 
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-500 hover:via-indigo-600 hover:to-blue-500 shadow-md shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/35 border border-indigo-400/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <span>Onboard Institution</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden bg-slate-900">
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
            <Link href="/api/trial/create-sandbox" prefetch={false} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
              Start Free Trial <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/api/auth/demo-session" prefetch={false} className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm px-8 py-4 rounded-full font-bold text-lg transition-all shadow-sm flex items-center justify-center gap-2">
              Explore Demo Environment
            </Link>
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
    </div>
  );
}
