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
