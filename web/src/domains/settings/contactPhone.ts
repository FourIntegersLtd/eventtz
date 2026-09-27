/** Validation for the optional contact phone number the client can add to their contact-sharing settings. */

const PHONE_MAX_LENGTH = 40;

/** A successful parse carries the value to send (trimmed, or `null` when blanked out); a failure carries an error message. */
export type ContactPhoneParse =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/** UK and international formats: `07…`, `+44…`, or 10–15 digits. Mirrors `frontend/lib/validation/phone.ts`. */
function isValidPhoneNumber(trimmed: string): boolean {
  if (!trimmed || trimmed.length > PHONE_MAX_LENGTH) return false;

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("0")) {
    return digits.length >= 10 && digits.length <= 11;
  }
  return digits.length >= 10 && digits.length <= 15;
}

/** Trim, then validate. An empty value is allowed and parses to `null` (clears the number). */
export function parseContactPhone(raw: string): ContactPhoneParse {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > PHONE_MAX_LENGTH) return { ok: false, error: "Phone number is too long." };
  if (!isValidPhoneNumber(trimmed)) {
    return { ok: false, error: "Enter a valid phone number (e.g. 07xxx xxxxxx or +44 7xxx xxxxxx)." };
  }
  return { ok: true, value: trimmed };
}
