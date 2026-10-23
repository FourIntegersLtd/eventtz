import type { ReactNode } from "react";
import { TONE } from "@/components/ui/tokens";

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
