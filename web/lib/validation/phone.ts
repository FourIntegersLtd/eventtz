import { z } from "zod";

const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 15;
const PHONE_MAX_LENGTH = 40;

/** Strip everything except digits (for counting / national formats). */
export function phoneDigitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** UK and international formats: +44…, 07…, or 10–15 digits. */
export function isValidPhoneNumber(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed || trimmed.length > PHONE_MAX_LENGTH) return false;

  if (trimmed.startsWith("+")) {
    const digits = phoneDigitsOnly(trimmed.slice(1));
    return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
  }

  const digits = phoneDigitsOnly(trimmed);
  if (trimmed.startsWith("0")) {
    return digits.length >= 10 && digits.length <= 11;
  }

  return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
}

export const phoneRequiredSchema = z
  .string()
  .trim()
  .min(1, "Enter your phone number.")
  .max(PHONE_MAX_LENGTH, "Phone number is too long.")
  .refine(
    isValidPhoneNumber,
    "Enter a valid phone number (e.g. 07xxx xxxxxx or +44 7xxx xxxxxx).",
  );

export const phoneOptionalSchema = z
  .string()
  .trim()
  .max(PHONE_MAX_LENGTH, "Phone number is too long.")
  .transform((v) => (v.length > 0 ? v : null))
  .pipe(
    z
      .string()
      .nullable()
      .refine((v) => v == null || isValidPhoneNumber(v), {
        message: "Enter a valid phone number (e.g. 07xxx xxxxxx or +44 7xxx xxxxxx).",
      }),
  );
