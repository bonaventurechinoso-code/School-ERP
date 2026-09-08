"use client";

import React from "react";
import { Transaction } from "@prisma/client";

export default function LedgerTable({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="bg-white p-6 sm:p-12 text-center rounded-2xl border border-slate-200">
        <h3 className="text-lg font-medium text-slate-800">No Transactions Yet</h3>
        <p className="text-slate-500 mt-2">Any income, expenses, and top-ups will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2">
        <h3 className="text-lg font-semibold text-slate-800">Ledger & Expenses</h3>
        <span className="text-sm text-slate-500">{transactions.length} Records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="p-4 font-semibold">Date</th>
              <th className="p-4 font-semibold">Type</th>
              <th className="p-4 font-semibold">Category</th>
              <th className="p-4 font-semibold">Description</th>
              <th className="p-4 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(txn => (
              <tr key={txn.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="p-4">
                  <div>{new Date(txn.createdAt).toLocaleDateString()}</div>
                  <div className="text-xs text-slate-400">{new Date(txn.createdAt).toLocaleTimeString()}</div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    txn.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {txn.type}
                  </span>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                    {txn.category}
                  </span>
                </td>
                <td className="p-4">{txn.description}</td>
                <td className={`p-4 font-bold text-right ${txn.type === 'INCOME' ? 'text-green-600' : 'text-slate-800'}`}>
                  {txn.type === 'INCOME' ? '+' : '-'}${txn.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
