"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown, GraduationCap, Building, Baby, ArrowRight, ShieldCheck, Zap, Globe, Users } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
  const [isSolutionsOpen, setIsSolutionsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 font-sans selection:bg-blue-200 dark:selection:bg-blue-900 transition-colors duration-300">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Left: Logo */}
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-xl">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-800 dark:text-slate-100">
                Next-Gen School ERP
              </span>
            </div>

            {/* Center: Navigation Dropdown */}
            <nav className="hidden md:flex space-x-8">
              <div 
                className="relative"
                onMouseEnter={() => setIsSolutionsOpen(true)}
                onMouseLeave={() => setIsSolutionsOpen(false)}
              >
                <button className="flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors h-20">
                  Institutional Solutions <ChevronDown className="h-4 w-4" />
                </button>
                
                {isSolutionsOpen && (
                  <div className="absolute top-20 left-1/2 -translate-x-1/2 w-80 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2">
                      <Link href="#daycare" className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                        <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg text-orange-600 dark:text-orange-400">
                          <Baby className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Daycare & Nursery</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Early childhood management tailored for care</p>
                        </div>
                      </Link>
                      <Link href="#primary" className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                          <Building className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Primary Schools</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Complete lifecycle management for Nigerian primary schools.</p>
                        </div>
                      </Link>
                      <Link href="#secondary" className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                        <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-lg text-teal-600 dark:text-teal-400">
                          <Building className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Secondary Schools</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Streamlined academics for junior and senior secondary education.</p>
                        </div>
                      </Link>
                      <Link href="#higher-ed" className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400">
                          <Globe className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Higher Education</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Advanced ERP for colleges and universities</p>
                        </div>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              <Link href="#features" className="flex items-center text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors h-20">
                Platform Features
              </Link>
              <Link href="#pricing" className="flex items-center text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors h-20">
                Pricing
              </Link>
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-6">
              <Link href="/admin" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors hidden sm:block">
                Client Portal Login
              </Link>
              <ThemeToggle />
              <Link href="/register" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-all shadow-sm shadow-blue-200 dark:shadow-blue-900/50 hover:shadow-md hover:shadow-blue-300 dark:hover:shadow-blue-900 flex items-center gap-2">
                Onboard Institution <ArrowRight className="h-4 w-4" />
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
            The Unified Engine for <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Modern Education
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-200 font-semibold max-w-3xl mx-auto mb-12 leading-relaxed drop-shadow-md">
            A single, scalable ERP platform designed to drive operational excellence from Early Childhood Centers to Universities and Polytechnics. Manage admissions, finance, and academics in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/register" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
              Start Free Trial <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/admin" className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm px-8 py-4 rounded-full font-bold text-lg transition-all shadow-sm flex items-center justify-center gap-2">
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

      {/* Footer CTA */}
      <section className="py-24 bg-slate-900 dark:bg-black relative overflow-hidden transition-colors duration-300">
        <div className="absolute inset-0 bg-blue-600/10 mix-blend-overlay"></div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl font-extrabold text-white mb-6">Ready to Transform Your Institution?</h2>
          <p className="text-slate-300 text-lg mb-10">Join hundreds of schools globally that have upgraded to Next-Gen School ERP.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)]">
            Create Institutional Portal <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
