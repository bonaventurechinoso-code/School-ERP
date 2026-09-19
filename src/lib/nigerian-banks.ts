export interface NigerianBank {
  name: string;
  code: string;
}

export const NIGERIAN_BANKS: NigerianBank[] = [
  { name: "Access Bank", code: "044" },
  { name: "Access Bank (Diamond)", code: "063" },
  { name: "ALAT by Wema", code: "035A" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "Opay Digital Services", code: "999992" },
  { name: "Palmpay", code: "999991" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Guaranty Trust Bank (GTB)", code: "058" },
  { name: "Zenith Bank", code: "057" },
  { name: "United Bank for Africa (UBA)", code: "033" },
  { name: "Sterling Bank", code: "030" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "Wema Bank", code: "035" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "Stanbic IBTC Bank", code: "215" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "FCMB", code: "214" },
  { name: "Keystone Bank", code: "082" },
  { name: "Polaris Bank", code: "076" },
  { name: "Providus Bank", code: "101" },
  { name: "Titan Trust Bank", code: "102" },
  { name: "Globus Bank", code: "103" },
  { name: "TAJ Bank", code: "302" },
  { name: "Jaiz Bank", code: "301" },
  { name: "VFD Microfinance Bank", code: "566" },
];

export interface SettlementBankDetails {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName?: string;
  updatedAt?: string;
}

/**
 * Strict 10-digit NUBAN account number validation
 */
export function isValidNubanAccountNumber(acc: string): boolean {
  if (!acc) return false;
  const clean = acc.trim();
  return /^\d{10}$/.test(clean);
}

/**
 * Look up a bank name from its code
 */
export function getBankByCode(code: string): NigerianBank | undefined {
  if (!code) return undefined;
  return NIGERIAN_BANKS.find(
    (b) => b.code.toLowerCase() === code.trim().toLowerCase()
  );
}
