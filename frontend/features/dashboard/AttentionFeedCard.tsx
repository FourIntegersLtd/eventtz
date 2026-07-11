"use client";

import Link from "next/link";
import { AlertCircle, ChevronRight, Info, Sparkles } from "lucide-react";
import { RADIUS } from "@/components/ui/tokens";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { sortAttentionItems, type AttentionItem, type AttentionTone } from "./attentionTypes";

const TONE_ICON: Record<AttentionTone, typeof AlertCircle> = {
  urgent: AlertCircle,
  info: Info,
  positive: Sparkles,
};

const TONE_ICON_CLASS: Record<AttentionTone, string> = {
  urgent: "bg-amber-100 text-amber-700",
  info: "bg-neutral-100 text-neutral-600",
  positive: "bg-primary/10 text-primary",
};

type AttentionFeedCardProps = {
  items: AttentionItem[];
  loading: boolean;
};

/**
 * The dashboard's single prioritized "what needs my attention" feed —
 * replaces the old combination of a stat-tile grid, a separate updates
 * banner, and a recent-activity list with one ranked list of concrete next
 * actions. Each portal is responsible for building its own `items` from data
 * it already fetches; this component only renders and sorts.
 */
export function AttentionFeedCard({ items, loading }: AttentionFeedCardProps) {
  const sorted = sortAttentionItems(items);

  return (
    <div className={`w-full min-w-0 overflow-hidden bg-white shadow-sm ring-1 ring-neutral-200/50 ${RADIUS.lg}`}>
      <div className="border-b border-neutral-100 px-4 py-4 sm:px-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">To do</p>
      </div>
      {loading ? (
        <div className="p-3">
          <SkeletonListRows rows={4} />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          className="border-0"
          icon={<Sparkles className="h-8 w-8" strokeWidth={1.5} />}
          title="You're all caught up"
        />
      ) : (
        <ul className="space-y-2 p-3">
          {sorted.map((item) => {
            const Icon = TONE_ICON[item.tone];
            const iconAndText = (
              <>
                {item.timestamp ? (
                  <span className="hidden w-14 shrink-0 text-xs font-medium text-neutral-400 sm:inline">
                    {item.timestamp}
                  </span>
                ) : null}
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE_ICON_CLASS[item.tone]}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{item.title}</p>
                  {item.subtitle ? (
                    <p className="line-clamp-2 text-xs text-neutral-500 sm:truncate">{item.subtitle}</p>
                  ) : null}
                </div>
              </>
            );
            return (
              <li
                key={item.id}
                className={`min-w-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-neutral-100 transition duration-150 ease-out hover:shadow-md ${
                  item.trailing ? "flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4" : ""
                }`}
              >
                {item.trailing ? (
                  <>
                    <Link
                      href={item.href}
                      className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"
                    >
                      {iconAndText}
                    </Link>
                    <div className="shrink-0">{item.trailing}</div>
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className="flex w-full min-w-0 items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4"
                  >
                    {iconAndText}
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
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
