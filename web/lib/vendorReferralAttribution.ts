const STORAGE_PREFIX = "eventtz_vref_";

/** Client referral codes: numeric, 1–6 digits (matches backend). */
export const VENDOR_REFERRAL_CODE_MAX_LEN = 6;

export function normalizeVendorReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length > VENDOR_REFERRAL_CODE_MAX_LEN) return null;
  return digits;
}

export function formatVendorReferralCodeInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, VENDOR_REFERRAL_CODE_MAX_LEN);
}

function storageKey(vendorUserId: string): string {
  return `${STORAGE_PREFIX}${vendorUserId}`;
}

export function readVendorReferralFromUrl(searchParams: URLSearchParams): string | null {
  return normalizeVendorReferralCode(searchParams.get("vref"));
}

export function persistVendorReferralCode(vendorUserId: string, code: string): void {
  if (typeof sessionStorage === "undefined") return;
  const normalized = normalizeVendorReferralCode(code);
  if (!normalized || !vendorUserId.trim()) return;
  sessionStorage.setItem(storageKey(vendorUserId), normalized);
}

export function getStoredVendorReferralCode(vendorUserId: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey(vendorUserId));
  return normalizeVendorReferralCode(raw);
}

export function clearStoredVendorReferralCode(vendorUserId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(storageKey(vendorUserId));
}

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
