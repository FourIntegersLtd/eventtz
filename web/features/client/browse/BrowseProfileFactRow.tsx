import type { ReactNode } from "react";
import { TONE } from "@/components/ui/tokens";

export type BrowseProfileFactTone = "default" | "notice" | "positive";

type BrowseProfileFactRowProps = {
  label: string;
  value: ReactNode;
  tone?: BrowseProfileFactTone;
};

/** Notice maps to the warning tone, positive to success, so colours come from the shared tokens. */
const TONE_ROW: Record<Exclude<BrowseProfileFactTone, "default">, string> = {
  notice: `rounded-control border px-4 py-3.5 ${TONE.warning.background} ${TONE.warning.line}`,
  positive: `rounded-control border px-4 py-3.5 ${TONE.success.background} ${TONE.success.line}`,
};

const TONE_LABEL: Record<Exclude<BrowseProfileFactTone, "default">, string> = {
  notice: `text-sm font-medium sm:w-36 ${TONE.warning.text}`,
  positive: `text-sm font-medium sm:w-36 ${TONE.success.text}`,
};

/** Single fact row in the browse profile card; use notice/positive for must-read details. */
export function BrowseProfileFactRow({
  label,
  value,
  tone = "default",
}: BrowseProfileFactRowProps) {
  if (tone === "default") {
    return (
      <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-6">
        <dt className="shrink-0 text-sm text-ink-3 sm:w-36">{label}</dt>
        <dd className="text-sm leading-relaxed text-ink">{value}</dd>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 sm:flex-row sm:gap-6 ${TONE_ROW[tone]}`}>
      <dt className={`shrink-0 ${TONE_LABEL[tone]}`}>{label}</dt>
      <dd className="text-sm leading-relaxed text-ink">{value}</dd>
    </div>
  );
}

type BrowseProfileCalloutProps = {
  title: string;
  children: ReactNode;
  tone?: "notice" | "positive";
};

/** Standalone callout for the most important facts (e.g. blocked dates). */
export function BrowseProfileCallout({
  title,
  children,
  tone = "notice",
}: BrowseProfileCalloutProps) {
  const toneTokens = tone === "notice" ? TONE.warning : TONE.success;

  return (
    <div
      className={`rounded-control border px-4 py-3.5 ${toneTokens.background} ${toneTokens.line} ${toneTokens.text}`}
    >
      <p className="text-[13px] font-semibold">{title}</p>
      <div className="mt-1.5 text-sm leading-relaxed opacity-90">{children}</div>
    </div>
  );
}
