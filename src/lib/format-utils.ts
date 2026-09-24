/**
 * Dynamic currency formatting helper using the standard Nigerian Naira (₦) symbol.
 * Defaults to ₦0.00 fallback if amount is missing, null, or undefined.
 */
export function formatCurrency(
  amount?: number | string | { toString(): string } | null,
  options?: {
    fallback?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  const fallback = options?.fallback ?? "₦0.00";
  if (amount === undefined || amount === null || amount === "") {
    return fallback;
  }

  const numeric =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
      ? Number(amount)
      : Number(amount.toString());
  if (isNaN(numeric)) {
    return fallback;
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(numeric);
}

export const formatNgn = formatCurrency;
