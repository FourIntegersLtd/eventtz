import type { BookingLineItemRow } from "@/features/bookings/BookingPricingBreakdown";

export function shortId(raw: unknown, head = 10, tail = 6): string | null {
  const s = raw != null ? String(raw).trim() : "";
  if (!s) return null;
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function mapAdminLineItems(items: unknown[]): BookingLineItemRow[] {
  return items.map((item, i) => {
    const row = asRecord(item) ?? {};
    return {
      id: String(row.id ?? `line-${i}`),
      heading: String(row.heading ?? row.label ?? row.name ?? `Line ${i + 1}`),
      unit_price_gbp: typeof row.unit_price_gbp === "number" ? row.unit_price_gbp : null,
      description: row.description != null ? String(row.description) : null,
      feature_lines: Array.isArray(row.feature_lines)
        ? row.feature_lines.map((x) => String(x))
        : undefined,
      timeline_line: row.timeline_line != null ? String(row.timeline_line) : null,
      quantity: typeof row.quantity === "number" ? row.quantity : null,
      unit_rate_gbp: typeof row.unit_rate_gbp === "number" ? row.unit_rate_gbp : null,
      unit_label: row.unit_label != null ? String(row.unit_label) : null,
    };
  });
}

