/** Server-side FastAPI base URL (Railway / local). Used by Next rewrites and route handlers. */
export function getBackendBaseUrl(): string {
  const raw =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:8000";
  return raw.replace(/\/+$/, "");
}
