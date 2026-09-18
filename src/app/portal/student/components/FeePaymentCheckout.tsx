"use client";

import React, { useState } from "react";
import { InvoiceItem, StudentProfileData } from "../types";
import { Lock, ShieldCheck, X, Loader2, CreditCard, Building2, CheckCircle2 } from "lucide-react";

interface FeePaymentCheckoutProps {
  invoice: InvoiceItem;
  student?: StudentProfileData;
  subdomain: string;
  onClose: () => void;
  onPaymentSuccess?: (invoiceId: string, amountPaid: number, reference: string) => void;
}

export default function FeePaymentCheckout({
  invoice,
  student,
  subdomain,
  onClose,
  onPaymentSuccess,
}: FeePaymentCheckoutProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settledSuccess, setSettledSuccess] = useState(false);

  const amountToPay = Math.max(0, invoice.amountDue - invoice.amountPaid);

  const handlePaystackHostedCheckout = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/${subdomain}/fees/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          studentId: student?.id || student?.admissionNumber,
          amount: amountToPay,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Unable to initialize Paystack checkout session.");
      }

      // Model A Compliant: Redirect directly to Paystack-hosted checkout.
      // Zero card inputs are held or processed by our server.
      if (data.authorization_url) {
        // If the URL returned is the callback URL (in dev test mode or direct return)
        if (data.authorization_url.includes("payment=success")) {
          setSettledSuccess(true);
          if (onPaymentSuccess) {
            onPaymentSuccess(invoice.id, amountToPay, data.reference || `PAY-${Date.now()}`);
          }
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          window.location.href = data.authorization_url;
        }
      }
    } catch (err: any) {
      console.error("[PAYSTACK_CHECKOUT_ERROR]", err);
      setErrorMsg(err.message || "Checkout initialization failed. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-5 relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                Fee Payment Checkout
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                CBN Model A Direct Split Settlement
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {settledSuccess ? (
          <div className="p-6 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              Payment Settled Successfully
            </h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Invoice has been marked PAID IN FULL. Your ledger balance has been updated.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Invoice Breakdown Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500">
                    Target Billing Item
                  </span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {invoice.description}
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold border border-indigo-200/60 dark:border-indigo-800/60">
                  {invoice.invoiceNumber || "ACTIVE INVOICE"}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-3 border-t border-slate-200/60 dark:border-zinc-700/60">
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                  Total Payable Now:
                </span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                  ₦{amountToPay.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Regulatory & Security Notice */}
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
                <Building2 className="w-3.5 h-3.5" />
                <span>CBN Model A Compliant - Funds route directly to school account via Paystack</span>
              </div>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 leading-relaxed font-medium">
                Funds route directly into the school Dedicated Virtual Account (DVA) via Paystack Split Settlement. The ERP never pools or holds third-party funds.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-900">
                {errorMsg}
              </div>
            )}

            {/* Single Primary Pay Button */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={isProcessing || amountToPay <= 0}
                onClick={handlePaystackHostedCheckout}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-zinc-800 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting Paystack Gateway...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-emerald-200" />
                    <span>Pay ₦{amountToPay.toLocaleString()} Securely</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-500 dark:text-zinc-400">
                Cards, Bank Transfer, USSD supported by Paystack
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
