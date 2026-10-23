"use client";

import { ChevronRight } from "lucide-react";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { CARD_PADDING, CARD_SURFACE } from "@/components/ui/tokens";
import { VENDOR_COPILOT } from "@/features/vendor/copilot/copilotBranding";
import { GrowthScoreRing } from "@/features/vendor/copilot/GrowthScoreRing";
import { useVendorCopilot } from "@/features/vendor/copilot/VendorCopilotContext";
import { useVendorCopilotBrief } from "@/features/vendor/copilot/useVendorCopilotBrief";

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

const tileInteractiveClass =
  "cursor-pointer border border-transparent transition hover:border-primary/25 hover:bg-primary/[0.02] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function VendorGrowthGlanceTile() {
  const { openCopilot } = useVendorCopilot();
  const { brief, loading, revalidating, error } = useVendorCopilotBrief();

  if (loading) {
    return (
      <div
        className={`flex min-w-0 w-full flex-col justify-between overflow-hidden sm:col-span-2 lg:col-span-1 ${CARD_SURFACE} ${CARD_PADDING}`}
        aria-hidden
      >
        <p className="text-base font-medium text-ink-3">{VENDOR_COPILOT.glanceTitle}</p>
        <div className="mt-4 h-14 w-14 animate-pulse rounded-full bg-surface-3" />
        <div className="mt-2 h-4 w-full max-w-[12rem] animate-pulse rounded bg-surface-3" />
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div
        className={`flex min-w-0 w-full flex-col justify-between overflow-hidden sm:col-span-2 lg:col-span-1 ${CARD_SURFACE} ${CARD_PADDING}`}
      >
        <p className="text-base font-medium text-ink-3">{VENDOR_COPILOT.glanceTitle}</p>
        <p className="mt-4 text-sm text-ink-2">Score unavailable</p>
      </div>
    );
  }

  const focusLine =
    brief.suggested_actions[0]?.title ??
    truncate(brief.greeting.replace(/^Good (morning|afternoon|evening|to see you),?\s*/i, ""), 40) ??
    "Personalised tips for your listing";

  const lowScore = brief.growth_score < 50;
  const tintClass = lowScore ? "ring-1 ring-primary/20 bg-primary/[0.03]" : "";

  return (
    <button
      type="button"
      onClick={() => openCopilot({ name: "home" })}
      aria-label={`Open ${VENDOR_COPILOT.glanceTitle}. Growth score ${brief.growth_score}. Focus: ${focusLine}`}
      className={`group flex min-w-0 w-full flex-col justify-between overflow-hidden text-left sm:col-span-2 lg:col-span-1 ${CARD_SURFACE} ${CARD_PADDING} ${tileInteractiveClass} ${tintClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
            <LottieIllustration
              asset="welcome"
              className="mx-0 h-8 w-8 shrink-0"
              ariaLabel=""
            />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-base font-medium text-ink">{VENDOR_COPILOT.glanceTitle}</p>
            <p className="mt-0.5 text-sm text-ink-3">{VENDOR_COPILOT.glanceSubtitle}</p>
          </div>
        </div>
        <ChevronRight
          className="mt-1 h-5 w-5 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden
        />
      </div>

      <div className="mt-4">
        <GrowthScoreRing score={brief.growth_score} size="compact" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <p className="min-w-0 line-clamp-1 text-sm text-ink-2">
          <span className="font-medium text-ink">Today:</span> {focusLine}
        </p>
        <span className="shrink-0 text-xs font-semibold text-primary underline decoration-primary underline-offset-2">
          {revalidating ? "Updating…" : VENDOR_COPILOT.briefLink}
        </span>
      </div>
    </button>
  );
}
