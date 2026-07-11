/** Server-side FastAPI base URL (Railway / local). Used by Next rewrites and route handlers. */
export function getBackendBaseUrl(): string {
  const raw =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:8000";
  let url = raw.replace(/\/+$/, "");
  // Vercel env sometimes omits the scheme — Next rewrites require http(s):// or /
  if (url && !/^https?:\/\//i.test(url)) {
    url = `https://${url.replace(/^\/+/, "")}`;
  }
  return url;
}
