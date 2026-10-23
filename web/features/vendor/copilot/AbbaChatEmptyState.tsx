"use client";

import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { VENDOR_COPILOT } from "@/features/vendor/copilot/copilotBranding";
import { GrowthScoreRing } from "@/features/vendor/copilot/GrowthScoreRing";
import { useVendorCopilotBrief } from "@/features/vendor/copilot/useVendorCopilotBrief";

type Props = {
  embedded?: boolean;
  onAskFocus: (question: string) => void;
};

export function AbbaChatEmptyState({ embedded = false, onAskFocus }: Props) {
  const { brief, loading } = useVendorCopilotBrief();
  const topAction = brief?.suggested_actions[0];

  return (
    <div
      className={
        embedded
          ? "flex min-h-[min(20rem,50vh)] flex-col items-center justify-center py-4 text-center"
          : "rounded-xl border border-dashed border-line bg-surface-3 px-4 py-5 text-center"
      }
    >
      <LottieIllustration
        asset="welcome"
        size="feature"
        className={embedded ? "h-24 w-24 sm:h-28 sm:w-28" : undefined}
        ariaLabel={VENDOR_COPILOT.name}
      />

      {loading ? (
        <p className="mt-4 text-sm text-ink-3">Loading your brief…</p>
      ) : brief ? (
        <>
          <p className="mt-4 max-w-[16rem] text-sm leading-relaxed text-ink-2">{brief.greeting}</p>
          <div className="mt-4">
            <GrowthScoreRing score={brief.growth_score} size="compact" />
          </div>
          {topAction ? (
            <button
              type="button"
              onClick={() => onAskFocus(`Help me with: ${topAction.title}`)}
              className="mt-4 w-full max-w-xs rounded-xl border border-line bg-white px-4 py-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.03]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                Today&apos;s focus
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">{topAction.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{topAction.rationale}</p>
            </button>
          ) : null}
        </>
      ) : null}

      <p className="mt-4 text-xs text-ink-3">{VENDOR_COPILOT.chatEmptyHint}</p>
    </div>
  );
}
