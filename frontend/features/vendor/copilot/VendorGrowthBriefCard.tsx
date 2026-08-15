"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Sparkles, TrendingUp } from "lucide-react";
import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { helpMarkdownProseClassName, helpMarkdownToHtml } from "@/features/help/helpContent";
import { VENDOR_COPILOT } from "@/features/vendor/copilot/copilotBranding";
import { GrowthScoreRing } from "@/features/vendor/copilot/GrowthScoreRing";
import { useVendorCopilotBrief } from "@/features/vendor/copilot/useVendorCopilotBrief";
import type { CopilotAction } from "@/lib/vendorCopilotApi";

function ActionButton({ action }: { action: CopilotAction }) {
  const href = action.href ?? "/vendor/profile";
  return (
    <Link
      href={href}
      className="flex w-full items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.02]"
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900">{action.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{action.rationale}</p>
      </div>
    </Link>
  );
}

type Props = {
  onOpenCopilot?: () => void;
};

export function VendorGrowthBriefCard({ onOpenCopilot }: Props) {
  const { brief, loading, revalidating, error } = useVendorCopilotBrief();

  const summaryHtml = useMemo(
    () => (brief ? helpMarkdownToHtml(brief.summary_markdown) : ""),
    [brief],
  );

  if (loading) {
    return (
      <div className={`${portalCard} ${portalCardPadding}`}>
        <div className="flex flex-col items-center py-4">
          <LottieIllustration asset="aiThinking" size="feature" ariaLabel="Loading growth brief" />
          <p className="mt-2 text-sm text-neutral-600">Preparing your growth brief…</p>
        </div>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className={`${portalCard} ${portalCardPadding}`}>
        <p className="text-sm text-neutral-600">
          {error ?? "Growth brief unavailable."}
        </p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-white ${portalCard}`}>
      <div className="border-b border-primary/10 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] px-5 py-4 sm:px-6">
        <div className="flex items-start gap-4">
          <GrowthScoreRing score={brief.growth_score} />
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-center gap-2">
              {brief.growth_score >= 75 ? (
                <LottieIllustration asset="allCaughtUp" size="inline" className="mx-0 h-8 w-8" ariaLabel="" />
              ) : (
                <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
              )}
              <p className="text-sm font-semibold text-neutral-900">Today&apos;s focus</p>
              {revalidating ? (
                <span className="text-xs font-medium text-neutral-500">Updating…</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-neutral-700">{brief.greeting}</p>
            {onOpenCopilot ? (
              <button
                type="button"
                onClick={onOpenCopilot}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                {VENDOR_COPILOT.askLink}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4 sm:px-6">
        <div
          className={`text-sm leading-relaxed text-neutral-700 ${helpMarkdownProseClassName}`}
          dangerouslySetInnerHTML={{ __html: summaryHtml }}
        />

        {brief.suggested_actions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Suggested actions
            </p>
            {brief.suggested_actions.map((action, i) => (
              <ActionButton key={`${action.kind}-${i}`} action={action} />
            ))}
          </div>
        ) : null}

        {brief.demand_insights.length > 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Market insight
            </p>
            {brief.demand_insights.slice(0, 1).map((insight, i) => (
              <div key={i} className="mt-2">
                <p className="text-sm font-semibold text-neutral-900">{insight.headline}</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">{insight.detail}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
