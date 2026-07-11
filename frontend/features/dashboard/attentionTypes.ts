import type { ReactNode } from "react";

export type AttentionTone = "urgent" | "info" | "positive";

/**
 * One row in the dashboard's single prioritized feed. Client and vendor
 * dashboards each build their own `AttentionItem[]` from data they already
 * fetch (bookings, unread counts, the notifications feed) and hand it to the
 * shared `AttentionFeedCard` for rendering — no duplicated markup per source.
 */
export type AttentionItem = {
  id: string;
  /** Lower sorts first. Use small integer bands (0 = act now, 10 = fyi) with ties broken by insertion order. */
  priority: number;
  tone: AttentionTone;
  title: string;
  subtitle?: string;
  href: string;
  /** Short date/time label shown on the left of the row (e.g. "Today", "12 Jul"). */
  timestamp?: string;
  ctaLabel?: string;
  /** Overrides the default chevron — used for the inline one-tap star rating on review nudges. */
  trailing?: ReactNode;
};

export function sortAttentionItems(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => a.priority - b.priority);
}
