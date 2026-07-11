/** Server-side FastAPI origin (Next.js rewrites / realtime proxy). */
export function resolveBackendUrl(): string {
  const raw =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:8000";
  return raw.replace(/\/+$/, "");
}

/**
 * Browser axios base URL. Empty string = same-origin `/api/v1/*` (proxied via Next.js).
 * Set NEXT_PUBLIC_API_URL only for direct cross-origin calls (legacy / debugging).
 */
export function resolvePublicApiBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return "";
}
