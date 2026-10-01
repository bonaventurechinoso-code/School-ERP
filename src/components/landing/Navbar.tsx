"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Building, Baby, ArrowRight, Globe, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSession } from "@/lib/session-context";

export default function Navbar() {
  const { session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [isSolutionsOpen, setIsSolutionsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthenticated = mounted && (status === "authenticated" || Boolean(session));

  const handleInstitutionalClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    const target =
      document.getElementById("institutional") ||
      document.getElementById("solutions") ||
      document.getElementById("features") ||
      document.getElementById("pricing");
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

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
              <a
                href="#institutional"
                onClick={handleInstitutionalClick}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs lg:text-sm font-semibold tracking-wide transition-colors duration-200 ${
                  isSolutionsOpen
                    ? "text-blue-600 dark:text-blue-400 bg-slate-100/90 dark:bg-slate-800/80 shadow-xs"
                    : "text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
                }`}
              >
                <span>Institutional Solutions</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    isSolutionsOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : "text-slate-400"
                  }`}
                />
              </a>

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
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                          Daycare &amp; Nursery
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          Early childhood management tailored for care
                        </p>
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
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                          Primary Schools
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          Complete lifecycle management for primary schools
                        </p>
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
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                          Secondary Schools
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          Streamlined academics for junior and senior secondary
                        </p>
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
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                          Higher Education
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          Advanced ERP for collegiate faculties and universities
                        </p>
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

            {/* Desktop: Conditional Sign In / Dashboard */}
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
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
            <a
              href="#institutional"
              onClick={(e) => {
                setIsMobileMenuOpen(false);
                handleInstitutionalClick(e);
              }}
              className="block px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200"
            >
              Institutional Solutions
            </a>
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
