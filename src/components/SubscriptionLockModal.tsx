"use client";

import React, { useState, useEffect } from "react";
import { useTenant } from "@/lib/tenant-context";
import { AlertTriangle, PhoneCall, RefreshCcw } from "lucide-react";
import { usePaystackPayment } from "react-paystack";

export function SubscriptionLockModal() {
  const tenant = useTenant();
  const [isLocked, setIsLocked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!tenant) return;

    // 1. Check strict model statuses
    if (tenant.subscriptionStatus === "EXPIRED" || tenant.subscriptionStatus === "PAST_DUE") {
      setIsLocked(true);
      return;
    }

    // 2. Check expiration date boundary crossover
    if (tenant.subscriptionExpiresAt) {
      const currentDate = new Date();
      const expiresAt = new Date(tenant.subscriptionExpiresAt);
      if (currentDate > expiresAt) {
        setIsLocked(true);
      }
    }
  }, [tenant]);

  const initializePayment = usePaystackPayment({
    reference: (new Date()).getTime().toString(),
    email: "admin@" + tenant.subdomain + ".com",
    amount: 50000 * 100, // Replace with dynamic calculation from your backend
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_KEY || "",
  });

  const handleRenew = async () => {
    try {
      setIsProcessing(true);
      
      // Hit backend checkout controller to get real initialized params
      const res = await fetch("/api/v1/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert("Failed to initialize payment: " + (data.error || "Unknown error"));
        setIsProcessing(false);
        return;
      }

      // Trigger Paystack modal with backend data
      initializePayment({
        onSuccess: (response: any) => {
           // Success callback - let webhook handle DB, just reload page
           window.location.reload();
        },
        onClose: () => {
           // Close callback
           setIsProcessing(false);
        }
      });
      
    } catch (err) {
      console.error(err);
      alert("An error occurred starting the renewal process.");
    } finally {
      setIsProcessing(false);
    }
  };

  // If the tenant is active, don't render anything
  if (!isLocked) return null;

  return (
    // Unclosable full-screen backdrop blurring the underlying admin panel layout
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white dark:bg-zinc-950 p-10 rounded-3xl shadow-2xl max-w-xl w-full mx-4 text-center border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-300">
        
        {/* Warning Icon Layer */}
        <div className="mx-auto w-20 h-20 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <AlertTriangle className="w-10 h-10" />
        </div>
        
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
          Access Paused for {tenant.name}
        </h2>
        
        <p className="text-slate-600 dark:text-slate-400 text-lg mb-10 leading-relaxed font-medium">
          Your institutional billing cycle has ended. Please renew your subscription to reactivate standard operations for your staff, educators, and student lifecycle portals immediately.
        </p>
        
        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={handleRenew}
            disabled={isProcessing}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 disabled:opacity-70 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2"
          >
            {isProcessing ? <RefreshCcw className="w-5 h-5 animate-spin" /> : "Renew Subscription"}
          </button>
          
          <button className="w-full sm:w-auto bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 px-8 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
            <PhoneCall className="w-4 h-4" />
            Contact Platform Support
          </button>
        </div>
      </div>
    </div>
  );
}
