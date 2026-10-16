import axios, { type AxiosInstance } from "axios";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Browser API base URL.
 * - Empty (default in production): same-origin `/api/v1/...` via Next.js rewrite → cookies stay on your domain.
 * - Set `NEXT_PUBLIC_API_URL` only for direct backend access (e.g. local dev without rewrites).
 */
const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
const baseURL = explicit ? normalizeBaseUrl(explicit) : "";

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: 30_000,
});

export default api;
