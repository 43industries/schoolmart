const KENYA_COUNTRY_CODE = "254";

/**
 * Normalize a Kenyan phone number to E.164 (+254XXXXXXXXX).
 * Accepts: 0712345678, +254712345678, 254712345678, 712345678
 */
export function normalizeKenyaPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  let normalized: string;
  if (digits.startsWith(KENYA_COUNTRY_CODE) && digits.length === 12) {
    normalized = digits;
  } else if (digits.startsWith("0") && digits.length === 10) {
    normalized = KENYA_COUNTRY_CODE + digits.slice(1);
  } else if (digits.length === 9 && /^[17]/.test(digits)) {
    normalized = KENYA_COUNTRY_CODE + digits;
  } else {
    return null;
  }

  return `+${normalized}`;
}

export function isValidKenyaPhone(input: string): boolean {
  return normalizeKenyaPhone(input) !== null;
}
