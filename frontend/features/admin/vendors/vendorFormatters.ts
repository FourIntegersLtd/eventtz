import { getVendorApprovalStatusMeta } from "@/lib/domain-types";

export function payloadStr(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

export function payloadStrArr(p: Record<string, unknown>, key: string): string[] {
  const v = p[key];
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x));
}

export function displayValue(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function approvalLabel(status: string): string {
  return getVendorApprovalStatusMeta(status).label;
}

/** Turn snake_case API values into readable labels. */
export function formatPayloadLabel(value: string): string {
  if (!value.trim()) return "—";
  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPayloadLabels(values: string[]): string[] {
  return values.map((v) => formatPayloadLabel(v)).filter((v) => v !== "—");
}

export function formatMoneyLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return "—";
  if (/^£/.test(trimmed)) return trimmed;
  if (/^\d/.test(trimmed)) return `£${trimmed}`;
  return trimmed;
}
