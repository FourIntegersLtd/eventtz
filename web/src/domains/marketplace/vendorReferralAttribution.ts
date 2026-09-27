/**
 * Capture a vendor referral code from `?vref=` and keep it for this browser tab.
 * Ported from the baseline `vendorReferralAttribution.ts`. Codes are 1–6 digits.
 */

const STORAGE_PREFIX = "eventtz_vref_";

/** Client referral codes: numeric, 1–6 digits (matches the API). */
export const VENDOR_REFERRAL_CODE_MAX_LEN = 6;

/** Digits only, or null when empty or longer than six digits. */
export function normalizeVendorReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length > VENDOR_REFERRAL_CODE_MAX_LEN) return null;
  return digits;
}

/** Strip non-digits and cap the length while the person is typing. */
export function formatVendorReferralCodeInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, VENDOR_REFERRAL_CODE_MAX_LEN);
}

function storageKey(vendorUserId: string): string {
  return `${STORAGE_PREFIX}${vendorUserId}`;
}

/** Referral code on the current URL, if it is a valid code. */
export function readVendorReferralFromUrl(searchParams: URLSearchParams): string | null {
  return normalizeVendorReferralCode(searchParams.get("vref"));
}

/** Remember a code for this vendor in session storage. */
export function persistVendorReferralCode(vendorUserId: string, code: string): void {
  if (typeof sessionStorage === "undefined") return;
  const normalized = normalizeVendorReferralCode(code);
  if (!normalized || !vendorUserId.trim()) return;
  sessionStorage.setItem(storageKey(vendorUserId), normalized);
}

/** The code stored for this vendor, if it is still valid. */
export function getStoredVendorReferralCode(vendorUserId: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey(vendorUserId));
  return normalizeVendorReferralCode(raw);
}

/** Forget the stored code for this vendor. */
export function clearStoredVendorReferralCode(vendorUserId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(storageKey(vendorUserId));
}

/**
 * Prefer `?vref=` and store it. Otherwise return whatever this tab already stored.
 */
export function captureVendorReferralFromSearchParams(
  vendorUserId: string,
  searchParams: URLSearchParams,
): string | null {
  const fromUrl = readVendorReferralFromUrl(searchParams);
  if (fromUrl) {
    persistVendorReferralCode(vendorUserId, fromUrl);
    return fromUrl;
  }
  return getStoredVendorReferralCode(vendorUserId);
}
