"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Info, Sparkles } from "lucide-react";
import { CARD_SURFACE } from "@/components/ui/tokens";
import { EmptyState } from "@/components/ui/EmptyState";
import { LottieFailurePanel } from "@/components/ui/LottieFailurePanel";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { MotionStaggerItem } from "@/components/ui/MotionStaggerItem";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { sortAttentionItems, type AttentionItem, type AttentionTone } from "./attentionTypes";

const TONE_ICON: Record<AttentionTone, typeof AlertCircle> = {
  urgent: AlertCircle,
  info: Info,
  positive: Sparkles,
};

const TONE_ICON_CLASS: Record<AttentionTone, string> = {
  urgent: "bg-amber-100 text-amber-700",
  info: "bg-surface-3 text-ink-2",
  positive: "bg-primary/10 text-primary",
};

const DEFAULT_PREVIEW = 3;

type AttentionFeedCardProps = {
  items: AttentionItem[];
  loading: boolean;
  /** How many items to show when collapsed. Default 3. */
  previewCount?: number;
  onItemClick?: (item: AttentionItem) => void;
};

/**
 * Dashboard “what needs my attention” feed.
 * Shows the top items by default; expands to the full list when there are more.
 */
export function AttentionFeedCard({
  items,
  loading,
  previewCount = DEFAULT_PREVIEW,
  onItemClick,
}: AttentionFeedCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortAttentionItems(items);
  const canCollapse = sorted.length > previewCount;
  const visible = expanded || !canCollapse ? sorted : sorted.slice(0, previewCount);

  return (
    <div className={`w-full min-w-0 overflow-hidden ${CARD_SURFACE}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-[15px] font-semibold tracking-tight text-ink">To do</p>
          {!loading && sorted.length > 0 ? (
            <p className="mt-0.5 text-[13px] text-ink-3">
              {sorted.length} item{sorted.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
        {canCollapse ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-2 transition hover:bg-surface-3 hover:text-ink"
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : `Show all ${sorted.length}`}
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      {loading ? (
        <div className="p-3">
          <SkeletonListRows rows={Math.min(previewCount, 4)} />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          className="border-0"
          lottie="allCaughtUp"
          title="You're all caught up"
        />
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((item, index) => {
            const Icon = TONE_ICON[item.tone];
            const iconAndText = (
              <>
                {item.timestamp ? (
                  <span className="hidden w-14 shrink-0 text-xs font-medium text-ink-3 sm:inline">
                    {item.timestamp}
                  </span>
                ) : null}
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE_ICON_CLASS[item.tone]}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                  {item.subtitle ? (
                    <p className="line-clamp-2 text-xs text-ink-3 sm:truncate">{item.subtitle}</p>
                  ) : null}
                </div>
              </>
            );
            return (
              <MotionStaggerItem
                key={item.id}
                as="li"
                index={index}
                className={`min-w-0 ${
                  item.trailing ? "flex items-center gap-2 px-4 py-3.5 sm:gap-3 sm:px-5" : ""
                }`}
              >
                {item.trailing ? (
                  <>
                    <Link
                      href={item.href}
                      onClick={() => onItemClick?.(item)}
                      className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"
                    >
                      {iconAndText}
                    </Link>
                    <div className="shrink-0">{item.trailing}</div>
                  </>
                ) : (
                  <Link
                    href={item.href}
                    onClick={() => onItemClick?.(item)}
                    className="flex w-full min-w-0 items-center gap-2 px-4 py-3.5 transition hover:bg-surface-3 sm:gap-3 sm:px-5"
                  >
                    {iconAndText}
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                  </Link>
                )}
              </MotionStaggerItem>
            );
          })}
        </ul>
      )}
    </div>
  );
}
