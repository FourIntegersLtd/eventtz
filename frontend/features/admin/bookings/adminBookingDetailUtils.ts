import type { BookingLineItemRow, BookingPricing } from "@/features/bookings/BookingPricingBreakdown";
import type { BookingReviewDisplay } from "@/lib/reviewTypes";
import type { AdminBookingSupportMeta } from "@/lib/adminPlatformApi";

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

export function asPricing(v: unknown): BookingPricing | null {
  const p = asRecord(v);
  if (!p || typeof p.client_total_label !== "string") return null;
  return p as unknown as BookingPricing;
}

export function asSupport(v: unknown): AdminBookingSupportMeta | null {
  const s = asRecord(v);
  if (!s || !Array.isArray(s.needs_attention)) return null;
  return s as unknown as AdminBookingSupportMeta;
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
    };
  });
}

export function asClientReview(v: unknown): BookingReviewDisplay | null {
  const r = asRecord(v);
  if (!r || typeof r.rating !== "number") return null;
  return {
    id: String(r.id ?? ""),
    rating: r.rating,
    body: String(r.body ?? ""),
    created_at: typeof r.created_at === "string" ? r.created_at : null,
  };
}
