import { DEFAULT_CURRENCY } from "./enums.js";

/** Format minor units (cents) as KSh display string */
export function formatKES(amountMinor: number): string {
  const major = amountMinor / 100;
  return `KSh ${major.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Convert major units to minor (cents) */
export function toMinorUnits(major: number): number {
  return Math.round(major * 100);
}

/** Convert minor units to major */
export function toMajorUnits(minor: number): number {
  return minor / 100;
}

export function formatCurrency(amountMinor: number, currency = DEFAULT_CURRENCY): string {
  if (currency === "KES") return formatKES(amountMinor);
  const major = amountMinor / 100;
  return `${currency} ${major.toFixed(2)}`;
}
