import React from "react";
import { getSchoolBankDetails } from "./actions";
import BankSettingsClient from "./BankSettingsClient";
import { notFound } from "next/navigation";

export default async function SchoolBankSettingsPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const params = await paramsPromise;
  const schoolDomain = params.schoolDomain;

  const school = await getSchoolBankDetails(schoolDomain);

  if (!school) {
    notFound();
  }

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
          Direct Bank Collection Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Setup and manage the official commercial bank account where parents transfer tuition fees directly.
        </p>
      </div>

      <BankSettingsClient
        schoolDomain={schoolDomain}
        initialData={{
          name: school.name,
          settlementBankName: school.settlementBankName,
          settlementBankCode: school.settlementBankCode,
          settlementAccountNumber: school.settlementAccountNumber,
          settlementAccountName: school.settlementAccountName,
          paymentInstruction: school.paymentInstruction,
          collectionMode: school.collectionMode,
        }}
      />
    </div>
  );
}
