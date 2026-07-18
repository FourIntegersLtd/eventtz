/**
 * Public vendor performance metrics (browse / marketplace).
 * Keep formatters here so cards, detail, and admin can reuse the same labels.
 */

export type VendorPublicMetrics = {
  /** All-time completed bookings. */
  completed_bookings?: number;
  /** Average first-response time in seconds. */
  avg_response_seconds?: number | null;
  /** Completed / client enquiries (0–1). */
  conversion_rate?: number | null;
  review_average?: number | null;
  review_count?: number;
};

/** Compact duration for metric chips (e.g. "2h", "45 min"). */
export function formatVendorResponseTime(
  seconds: number | null | undefined,
): string | null {
  if (seconds == null || Number.isNaN(Number(seconds))) return null;
  const s = Number(seconds);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const hours = s / 3600;
  if (hours < 24) {
    const rounded = hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : String(Math.round(hours));
    return `${rounded}h`;
  }
  const days = hours / 24;
  const d = days < 10 ? days.toFixed(1).replace(/\.0$/, "") : String(Math.round(days));
  return `${d}d`;
}

/** Human duration for “Usually replies within …” copy. */
export function formatUsualReplyWithin(
  seconds: number | null | undefined,
): string | null {
  if (seconds == null || Number.isNaN(Number(seconds))) return null;
  const s = Number(seconds);
  if (s < 60) return `${Math.max(1, Math.round(s))} seconds`;
  if (s < 3600) {
    const m = Math.max(1, Math.round(s / 60));
    return m === 1 ? "1 minute" : `${m} minutes`;
  }
  if (s < 86400) {
    const h = Math.max(1, Math.round(s / 3600));
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  const d = Math.max(1, Math.round(s / 86400));
  return d === 1 ? "1 day" : `${d} days`;
}

/** Full sentence for booking-sent / pending UX. */
export function usualReplyExpectation(
  seconds: number | null | undefined,
): string {
  const within = formatUsualReplyWithin(seconds);
  if (within) return `Usually replies within ${within}.`;
  return "Most vendors reply within a day.";
}

export function formatVendorConversionRate(
  rate: number | null | undefined,
): string | null {
  if (rate == null || Number.isNaN(Number(rate))) return null;
  return `${(Number(rate) * 100).toFixed(0)}%`;
}

export function formatVendorCompletedBookings(count: number | null | undefined): string {
  const n = Number(count) || 0;
  if (n === 1) return "1 event";
  return `${n} events`;
}

export function formatVendorRating(
  average: number | null | undefined,
  count: number | null | undefined,
): string | null {
  const c = Number(count) || 0;
  if (c <= 0 || average == null || Number.isNaN(Number(average))) return null;
  return `${Number(average).toFixed(1)} (${c})`;
}

export type VendorMetricItem = {
  key: string;
  label: string;
  value: string;
};

/** Build display items from public metrics — omit empty / unknown values. */
export function buildVendorMetricItems(
  metrics: VendorPublicMetrics,
  options?: { includeRating?: boolean; includeConversion?: boolean },
): VendorMetricItem[] {
  const includeRating = options?.includeRating !== false;
  const includeConversion = options?.includeConversion === true;
  const items: VendorMetricItem[] = [];

  if (includeRating) {
    const rating = formatVendorRating(metrics.review_average, metrics.review_count);
    if (rating) {
      items.push({ key: "rating", label: "Rating", value: rating });
    }
  }

  const completed = Number(metrics.completed_bookings) || 0;
  if (completed > 0) {
    items.push({
      key: "completed",
      label: "Completed",
      value: formatVendorCompletedBookings(completed),
    });
  }

  const within = formatUsualReplyWithin(metrics.avg_response_seconds);
  if (within) {
    items.push({
      key: "response",
      label: "Usually replies",
      value: `within ${within}`,
    });
  }

  if (includeConversion) {
    const conversion = formatVendorConversionRate(metrics.conversion_rate);
    if (conversion) {
      items.push({ key: "conversion", label: "Conversion", value: conversion });
    }
  }

  return items;
}
