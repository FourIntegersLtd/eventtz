import axios from "axios";

export function isHttpStatus(error: unknown, status: number): boolean {
  return axios.isAxiosError(error) && error.response?.status === status;
}

export function isAxiosTimeout(error: unknown): boolean {
  return axios.isAxiosError(error) && error.code === "ECONNABORTED";
}

export function isAxiosNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

export type MediaUploadKind = "photo" | "video" | "document";

const MEDIA_UPLOAD_TIMEOUT_COPY: Record<MediaUploadKind, string> = {
  photo:
    "Photo upload timed out. Large images can take a while on slower connections — try Wi‑Fi, wait until the upload finishes, or use a smaller photo.",
  video:
    "Video upload timed out. Large videos can take several minutes on slower connections — try Wi‑Fi, wait until the upload finishes, or use a shorter or smaller video.",
  document:
    "Document upload timed out. Large files can take a while on slower connections — try Wi‑Fi, wait until the upload finishes, or use a smaller file.",
};

/** User-facing message for failed media uploads (photos, videos, PDFs). */
export function mediaUploadErrorMessage(
  error: unknown,
  kind: MediaUploadKind = "photo",
): string {
  const apiDetail = getApiErrorDetail(error);
  if (apiDetail) return apiDetail;

  if (isAxiosTimeout(error)) {
    return MEDIA_UPLOAD_TIMEOUT_COPY[kind];
  }

  if (isAxiosNetworkError(error)) {
    return "Couldn't reach our servers. Check your internet connection and try again.";
  }

  const label = kind === "video" ? "video" : kind === "document" ? "document" : "photo";
  return `Couldn't upload your ${label}. Please try again.`;
}

export function getApiErrorDetail(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  const d = error.response?.data;
  if (d && typeof d === "object" && "detail" in d) {
    const det = (d as { detail?: unknown }).detail;
    if (typeof det === "string") return det;
  }
  return null;
}

/** AppError `code` from the API body when present (e.g. `simple_intent`). */
export function getApiErrorCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  const d = error.response?.data;
  if (d && typeof d === "object" && "code" in d) {
    const code = (d as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code.trim();
  }
  return null;
}

/** Friendly copy for booking-rule error codes, keyed by the API's stable `code`. */
export const BOOKING_RULE_ERROR_MESSAGES: Record<string, string> = {
  payment_deadline_passed:
    "The payment deadline for this booking has passed, so it has been cancelled and the date released. You can send a new request.",
  delivery_not_awaited: "This booking isn't waiting on delivery confirmation any more. Refresh to see its latest status.",
  deposit_claim_closed:
    "The window to report damage has closed, or a claim has already been made for this booking.",
  deposit_claim_invalid:
    "That damage report isn't valid. Check the amount is no more than the deposit and the description is 10 to 2000 characters.",
  no_deposit_claim: "There is no open deposit claim on this booking.",
  deposit_award_invalid: "The award must be between £0 and the amount claimed.",
  deposit_vendor_payouts_not_ready:
    "The vendor hasn't finished setting up payouts yet, so the award can't be paid. Ask them to complete Stripe setup, then try again.",
};

/** AppError code the API returns when an action needs the current Terms accepted. */
export const TERMS_NOT_ACCEPTED_CODE = "terms_not_accepted";

/** Friendly copy for TERMS_NOT_ACCEPTED, pointing at the banner at the top of the portal. */
export const TERMS_NOT_ACCEPTED_MESSAGE =
  "Please accept our updated Terms of Service first. Use the banner at the top of the page, then try again.";
