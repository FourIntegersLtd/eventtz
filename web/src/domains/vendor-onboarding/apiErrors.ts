/** Upload and request error text for the onboarding wizard. */

import { isPlatformError, PlatformTransportError } from "@/foundation/platform-client";
import { platformErrorDetail } from "@/foundation/platform-client/errorMessage";

/** Shown when a request fails and the API sends no detail. */
export const GENERIC_AUTH_ERROR = "Something went wrong. Please try again.";

/** True when the platform rejected the request with this HTTP status. */
export function isHttpStatus(error: unknown, status: number): boolean {
  return isPlatformError(error) && error.status === status;
}

/** The API's `detail` string, or null when the failure has none. */
export function getApiErrorDetail(error: unknown): string | null {
  return platformErrorDetail(error);
}

/** Which kind of file failed, so the message names a photo, video, or document. */
export type MediaUploadKind = "photo" | "video" | "document";

const MEDIA_UPLOAD_TIMEOUT_COPY: Record<MediaUploadKind, string> = {
  photo:
    "Photo upload timed out. Large images can take a while on slower connections — try Wi‑Fi, wait until the upload finishes, or use a smaller photo.",
  video:
    "Video upload timed out. Large videos can take several minutes on slower connections — try Wi‑Fi, wait until the upload finishes, or use a shorter or smaller video.",
  document:
    "Document upload timed out. Large files can take a while on slower connections — try Wi‑Fi, wait until the upload finishes, or use a smaller file.",
};

/** User-facing message for a failed photo, video, or document upload. */
export function mediaUploadErrorMessage(error: unknown, kind: MediaUploadKind = "photo"): string {
  const apiDetail = getApiErrorDetail(error);
  if (apiDetail) return apiDetail;
  if (error instanceof PlatformTransportError) return MEDIA_UPLOAD_TIMEOUT_COPY[kind];
  const label = kind === "video" ? "video" : kind === "document" ? "document" : "photo";
  return `Couldn't upload your ${label}. Please try again.`;
}
