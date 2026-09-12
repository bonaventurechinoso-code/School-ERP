"use client";

import React from "react";
import { Transaction } from "@prisma/client";

export default function LedgerTable({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-12 text-center rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">No Transactions Yet</h3>
        <p className="text-slate-500 dark:text-zinc-400 mt-2 text-sm">Any income, expenses, and top-ups will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center gap-2">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Ledger & Expenses</h3>
        <span className="text-xs sm:text-sm font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
          {transactions.length} Records
        </span>
      </div>

      {/* DESKTOP TABLE VIEW (md+) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-300 whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-700 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4 font-semibold">Date</th>
              <th className="p-4 font-semibold">Type</th>
              <th className="p-4 font-semibold">Category</th>
              <th className="p-4 font-semibold">Description</th>
              <th className="p-4 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {transactions.map(txn => (
              <tr key={txn.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                <td className="p-4">
                  <div className="text-slate-900 dark:text-white font-medium">{new Date(txn.createdAt).toLocaleDateString()}</div>
                  <div className="text-xs text-slate-400 dark:text-zinc-500">{new Date(txn.createdAt).toLocaleTimeString()}</div>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                    txn.type === 'INCOME' 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' 
                      : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                  }`}>
                    {txn.type}
                  </span>
                </td>
                <td className="p-4">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-md text-xs font-medium border border-slate-200 dark:border-zinc-700">
                    {txn.category}
                  </span>
                </td>
                <td className="p-4 text-slate-800 dark:text-zinc-200">{txn.description}</td>
                <td className={`p-4 font-bold text-right font-mono ${txn.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-zinc-100'}`}>
                  {txn.type === 'INCOME' ? '+' : '-'}${txn.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARDS VIEW (< md) - Zero Features Dropped */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
        {transactions.map(txn => (
          <div key={txn.id} className="p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                  {txn.description}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
                    {new Date(txn.createdAt).toLocaleDateString()} {new Date(txn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded text-[10px] font-semibold uppercase">
                    {txn.category}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={`text-base font-bold font-mono block ${txn.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {txn.type === 'INCOME' ? '+' : '-'}${txn.amount.toFixed(2)}
                </span>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                  txn.type === 'INCOME' 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' 
                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                }`}>
                  {txn.type}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
