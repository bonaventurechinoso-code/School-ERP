"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/lib/tenant-context";

export default function WalletTopUp({ 
  schoolId, 
  walletBalance 
}: { 
  schoolId: string, 
  walletBalance: number 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const tenant = useTenant();

  const planMap: Record<string, string> = {
    BASIC: "Basic Education Setup",
    EXCELLENCE: "Secondary Excellence Plan",
    ENTERPRISE: "Enterprise Higher Ed",
  };
  const planName = planMap[tenant?.subscriptionPlan || "BASIC"] || "Basic Education Setup";

  if (tenant?.userRole !== "ADMIN" && tenant?.userRole !== "BURSAR") {
    return null;
  }

  async function handleTopUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsProcessing(true);
    
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get("amount") as string);
    
    try {
      // Simulate live payment gateway hitting our webhook
      await fetch('/api/wallet/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: "charge.success",
          data: {
            amount: amount,
            metadata: { schoolId }
          }
        })
      });
      
      setIsOpen(false);
      router.refresh(); // Refresh the page layout to fetch the updated walletBalance
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Wallet Balance</h3>
        <p className="text-3xl font-bold text-slate-800">
          ₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold border border-green-200">
          <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></div>
          Portal Status: ACTIVE ({planName})
        </div>
      </div>
      <button 
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
      >
        Top Up Wallet
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Top Up Wallet</h3>
            <form onSubmit={handleTopUp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount ($)</label>
                <input 
                  type="number" 
                  name="amount" 
                  min="1" 
                  step="0.01" 
                  required 
                  className="w-full border p-2 rounded" 
                  placeholder="e.g. 1000.00" 
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)} 
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  disabled={isProcessing}
                >
                  {isProcessing ? "Processing..." : "Top Up (Simulate API)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
