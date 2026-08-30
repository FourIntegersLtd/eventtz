export function payloadStr(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : value != null ? String(value) : "";
}

/** Vendor profile JSON field shown in UI — ignore non-string values. */
export function payloadStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}
