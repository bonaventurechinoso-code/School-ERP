"use client";

import { useState } from "react";
import { updateBankDetails } from "./actions";

export default function BankDetailsForm({ 
  staff, 
  schoolDomain 
}: { 
  staff: any, 
  schoolDomain: string 
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Mask account number helper
  const maskedAccount = staff.bankAccountNumber 
    ? `**${staff.bankAccountNumber.slice(-4)}` 
    : "";

  return (
    <div>
      {staff.bankName && staff.accountName && staff.bankAccountNumber ? (
        <div className="group relative">
          <div className="font-semibold">{staff.bankName} - {maskedAccount}</div>
          <div className="text-slate-500">{staff.accountName}</div>
          <button 
            onClick={() => setIsOpen(true)}
            className="text-blue-600 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Edit Details
          </button>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)} 
          className="text-blue-600 hover:underline hover:text-blue-800 font-medium cursor-pointer"
        >
          Setup Required
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Update Bank Details</h3>
            <form action={async (formData) => {
              await updateBankDetails(schoolDomain, staff.id, formData);
              setIsOpen(false);
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Bank Name</label>
                <input type="text" name="bankName" defaultValue={staff.bankName || ""} required className="w-full border p-2 rounded" placeholder="e.g. GTBank" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account Name</label>
                <input type="text" name="accountName" defaultValue={staff.accountName || ""} required className="w-full border p-2 rounded" placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account Number</label>
                <input type="text" name="bankAccountNumber" defaultValue={staff.bankAccountNumber || ""} required className="w-full border p-2 rounded" placeholder="e.g. 0123456789" />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
