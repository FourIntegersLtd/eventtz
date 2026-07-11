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

export function approvalBadgeClasses(status: string): string {
  if (status === "approved") {
    return "rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary";
  }
  if (status === "banned") {
    return "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900";
  }
  return "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900";
}

export function approvalLabel(status: string): string {
  if (status === "approved") return "Approved";
  if (status === "banned") return "Banned";
  return "Pending";
}
