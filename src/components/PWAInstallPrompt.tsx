"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Download, Share, X, Smartphone, PlusSquare, Sparkles } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isMinimised, setIsMinimised] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Detect if app is already running in standalone PWA mode
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (standaloneMode) {
      setIsStandalone(true);
      return;
    }

    // 2. Detect iOS device
    const userAgent = window.navigator.userAgent || "";
    const isIOSDevice =
      /iphone|ipad|ipod/i.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 3. Listen for Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);
      setIsInstallable(true);

      // Check if user dismissed recently
      const dismissedUntil = localStorage.getItem("pwa_install_dismissed_until");
      if (!dismissedUntil || Date.now() > Number(dismissedUntil)) {
        // Show after brief initial page load delay
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 2000);
        return () => clearTimeout(timer);
      } else {
        // Keep in minimized pill mode
        setIsMinimised(true);
      }
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowPrompt(false);
      setShowIOSGuide(false);
      setIsInstallable(false);
      setDeferredPrompt(null);
      localStorage.removeItem("pwa_install_dismissed_until");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Allow any button on the page to trigger the prompt via custom event
    const handleTriggerEvent = () => {
      if (isIOSDevice) {
        setShowIOSGuide(true);
      } else if (deferredPrompt) {
        setShowPrompt(true);
        setIsMinimised(false);
      } else {
        // If beforeinstallprompt hasn't fired yet or already installed
        setShowPrompt(true);
        setIsMinimised(false);
      }
    };
    window.addEventListener("trigger-pwa-install", handleTriggerEvent);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("trigger-pwa-install", handleTriggerEvent);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If prompt isn't natively captured, show browser-specific guidance
      if (isIOS) {
        setShowIOSGuide(true);
        setShowPrompt(false);
      } else {
        alert(
          "To install this app on your device:\n\n1. Tap the three dots menu (⋮) in your browser address bar.\n2. Tap 'Install app' or 'Add to Home screen'."
        );
      }
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setShowPrompt(false);
        setIsMinimised(false);
      }
    } catch (err) {
      console.error("[PWA] Installation prompt failed:", err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSGuide(false);
    setIsMinimised(true);
    // Dismiss for 24 hours
    localStorage.setItem(
      "pwa_install_dismissed_until",
      String(Date.now() + 24 * 60 * 60 * 1000)
    );
  };

  // If already running inside standalone PWA, never render
  if (isStandalone) return null;

  return (
    <>
      {/* 1. Minimized Floating Install Pill (Always available when installable & dismissed) */}
      {(isInstallable || isIOS) && isMinimised && !showPrompt && !showIOSGuide && (
        <button
          onClick={() => {
            setIsMinimised(false);
            if (isIOS) {
              setShowIOSGuide(true);
            } else {
              setShowPrompt(true);
            }
          }}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 animate-in fade-in slide-in-from-bottom-2 duration-300 cursor-pointer border border-indigo-400/30"
          title="Install App on your device"
        >
          <Download className="w-4 h-4 animate-bounce" />
          <span>Install App</span>
        </button>
      )}

      {/* 2. Full Android / Desktop / Standard Install Banner */}
      {showPrompt && !isStandalone && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-indigo-950/20 pointer-events-auto flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0 overflow-hidden border border-indigo-500/20">
                  <Image
                    src="/icon-192.png"
                    alt="App Icon"
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      Install School ERP App
                    </h3>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                      <Sparkles className="w-2.5 h-2.5" />
                      App
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                    Get instant access, fast offline portal speeds, and push notifications.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                aria-label="Close install prompt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>Install Application</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="py-2.5 px-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. iOS Safari Add to Home Screen Instructions Modal */}
      {showIOSGuide && !isStandalone && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-indigo-950/20 pointer-events-auto flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    Install on your iPhone / iPad
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Install this app to your Home Screen for the full app experience:
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-3 text-xs text-slate-700 dark:text-zinc-300 space-y-2 border border-slate-200/60 dark:border-zinc-700/60">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
                  1
                </span>
                <span>
                  Tap the <strong className="text-indigo-600 dark:text-indigo-400">Share</strong> button{" "}
                  <Share className="inline w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 align-middle mb-0.5" /> in Safari&apos;s bottom toolbar.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
                  2
                </span>
                <span>
                  Scroll down and tap <strong className="text-indigo-600 dark:text-indigo-400">Add to Home Screen</strong>{" "}
                  <PlusSquare className="inline w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 align-middle mb-0.5" />.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
                  3
                </span>
                <span>
                  Tap <strong className="text-indigo-600 dark:text-indigo-400">Add</strong> in the top-right corner.
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleDismiss}
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
