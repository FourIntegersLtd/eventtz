/** Compact display for long ids (booking refs, Stripe ids, etc.). */
export function shortId(raw: unknown, head = 8, tail = 4): string | null {
  const value = raw != null ? String(raw).trim() : "";
  if (!value) return null;
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
