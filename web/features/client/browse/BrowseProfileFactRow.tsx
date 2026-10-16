import type { ReactNode } from "react";

export type BrowseProfileFactTone = "default" | "notice" | "positive";

type BrowseProfileFactRowProps = {
  label: string;
  value: ReactNode;
  tone?: BrowseProfileFactTone;
};

const TONE_ROW: Record<Exclude<BrowseProfileFactTone, "default">, string> = {
  notice:
    "rounded-xl bg-amber-50 px-4 py-3.5 ring-1 ring-inset ring-amber-200/60",
  positive:
    "rounded-xl bg-emerald-50/90 px-4 py-3.5 ring-1 ring-inset ring-emerald-200/55",
};

const TONE_LABEL: Record<Exclude<BrowseProfileFactTone, "default">, string> = {
  notice: "text-sm font-medium text-amber-950 sm:w-36",
  positive: "text-sm font-medium text-emerald-950 sm:w-36",
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
        <dt className="shrink-0 text-sm text-neutral-500 sm:w-36">{label}</dt>
        <dd className="text-sm leading-relaxed text-neutral-800">{value}</dd>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 sm:flex-row sm:gap-6 ${TONE_ROW[tone]}`}>
      <dt className={`shrink-0 ${TONE_LABEL[tone]}`}>{label}</dt>
      <dd className="text-sm leading-relaxed text-neutral-800">{value}</dd>
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
  const shell =
    tone === "notice"
      ? "border-amber-200/70 bg-amber-50 text-amber-950"
      : "border-emerald-200/70 bg-emerald-50/90 text-emerald-950";

  return (
    <div className={`rounded-xl border px-4 py-3.5 ${shell}`}>
      <p className="text-[13px] font-semibold">{title}</p>
      <div className="mt-1.5 text-sm leading-relaxed opacity-90">{children}</div>
    </div>
  );
}
