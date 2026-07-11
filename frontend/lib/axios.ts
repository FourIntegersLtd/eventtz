import axios, { type AxiosInstance } from "axios";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

const baseURL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000",
);

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: 30_000,
});

export default api;
