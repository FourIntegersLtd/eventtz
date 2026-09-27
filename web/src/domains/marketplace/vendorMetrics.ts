/**
 * Public vendor performance metrics (browse / marketplace).
 * Ported from the baseline `vendorMetrics.ts`.
 */

export type VendorPublicMetrics = {
  /** All-time completed bookings. */
  completed_bookings?: number;
  /** Average first-response time in seconds. */
  avg_response_seconds?: number | null;
  /** Completed / client enquiries (0-1). */
  conversion_rate?: number | null;
  review_average?: number | null;
  review_count?: number;
};

/** Compact duration for metric chips (e.g. "2h", "45 min"). */
export function formatVendorResponseTime(
  seconds: number | null | undefined,
): string | null {
  if (seconds == null || Number.isNaN(Number(seconds))) return null;
  const totalSeconds = Number(seconds);
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  if (totalSeconds < 3600) return `${Math.round(totalSeconds / 60)} min`;
  const hours = totalSeconds / 3600;
  if (hours < 24) {
    const rounded = hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : String(Math.round(hours));
    return `${rounded}h`;
  }
  const days = hours / 24;
  const dayStr = days < 10 ? days.toFixed(1).replace(/\.0$/, "") : String(Math.round(days));
  return `${dayStr}d`;
}

/** Human duration for "Usually replies within …" copy. */
export function formatUsualReplyWithin(
  seconds: number | null | undefined,
): string | null {
  if (seconds == null || Number.isNaN(Number(seconds))) return null;
  const totalSeconds = Number(seconds);
  if (totalSeconds < 60) return `${Math.max(1, Math.round(totalSeconds))} seconds`;
  if (totalSeconds < 3600) {
    const minutes = Math.max(1, Math.round(totalSeconds / 60));
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  if (totalSeconds < 86400) {
    const hours = Math.max(1, Math.round(totalSeconds / 3600));
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const days = Math.max(1, Math.round(totalSeconds / 86400));
  return days === 1 ? "1 day" : `${days} days`;
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
  const numberOfEvents = Number(count) || 0;
  if (numberOfEvents === 1) return "1 event";
  return `${numberOfEvents} events`;
}

export function formatVendorRating(
  average: number | null | undefined,
  count: number | null | undefined,
): string | null {
  const reviewCount = Number(count) || 0;
  if (reviewCount <= 0 || average == null || Number.isNaN(Number(average))) return null;
  return `${Number(average).toFixed(1)} (${reviewCount})`;
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
