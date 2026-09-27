"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sortAttentionItems, type AttentionFeedEntry, type AttentionTone } from "@/domains/client-dashboard/attentionFeed";

/** A small coloured dot standing in for the baseline's tone icon (no icon library — AGENTS.md). */
const TONE_DOT_CLASS: Record<AttentionTone, string> = {
  urgent: "bg-amber-500",
  info: "bg-neutral-400",
  positive: "bg-primary",
};

const DEFAULT_PREVIEW = 3;

/** Five tappable empty stars; tapping one links to the booking's review page pre-rated. */
function OneTapStarRating({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-0.5" aria-label="Rate this vendor">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => router.push(`/client/bookings/${encodeURIComponent(bookingId)}?rate=${value}`)}
          className="text-xl leading-none text-amber-500 transition hover:scale-110"
          aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
        >
          ☆
        </button>
      ))}
    </div>
  );
}

/**
 * The dashboard "To do" feed. Shows the highest-priority rows first and
 * collapses to the top few when there are more; rating nudges render an
 * inline star strip instead of the default chevron.
 */
export function AttentionFeedCard({ items, loading }: { items: readonly AttentionFeedEntry[]; loading: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortAttentionItems(items);
  const canCollapse = sorted.length > DEFAULT_PREVIEW;
  const visible = expanded || !canCollapse ? sorted : sorted.slice(0, DEFAULT_PREVIEW);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <p className="text-[15px] font-semibold tracking-tight text-neutral-900">To do</p>
          {!loading && sorted.length > 0 ? (
            <p className="mt-0.5 text-[13px] text-neutral-400">
              {sorted.length} item{sorted.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
        {canCollapse ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : `Show all ${sorted.length}`}
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="px-5 py-6 text-sm text-neutral-500">Loading your to-dos…</p>
      ) : sorted.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-neutral-500">You&apos;re all caught up.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {visible.map((item) => {
            const iconAndText = (
              <>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT_CLASS[item.tone]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{item.title}</p>
                  {item.subtitle ? <p className="truncate text-xs text-neutral-500">{item.subtitle}</p> : null}
                </div>
              </>
            );
            return (
              <li key={item.id}>
                {item.rateBookingId ? (
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-3">
                      {iconAndText}
                    </Link>
                    <OneTapStarRating bookingId={item.rateBookingId} />
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-neutral-50/80"
                  >
                    {iconAndText}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
