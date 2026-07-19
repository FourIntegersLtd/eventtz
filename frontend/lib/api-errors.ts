import axios from "axios";

export function isHttpStatus(error: unknown, status: number): boolean {
  return axios.isAxiosError(error) && error.response?.status === status;
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
