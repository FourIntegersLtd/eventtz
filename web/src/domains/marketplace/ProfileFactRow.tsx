/**
 * One labelled fact on the vendor profile, with optional notice or positive styling.
 */
import type { ReactNode } from "react";

export type ProfileFactTone = "default" | "notice" | "positive";

type ProfileFactRowProps = {
  label: string;
  value: ReactNode;
  tone?: ProfileFactTone;
};

const TONE_ROW: Record<Exclude<ProfileFactTone, "default">, string> = {
  notice: "rounded-xl bg-amber-50 px-4 py-3.5 ring-1 ring-inset ring-amber-200/60",
  positive: "rounded-xl bg-emerald-50/90 px-4 py-3.5 ring-1 ring-inset ring-emerald-200/55",
};

const TONE_LABEL: Record<Exclude<ProfileFactTone, "default">, string> = {
  notice: "text-sm font-medium text-amber-950 sm:w-36",
  positive: "text-sm font-medium text-emerald-950 sm:w-36",
};

/** A single fact row. Notice and positive tones call out must-read details. */
export function ProfileFactRow({ label, value, tone = "default" }: ProfileFactRowProps) {
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

type ProfileCalloutProps = {
  title: string;
  children: ReactNode;
  tone?: "notice" | "positive";
};

/** Standalone callout, used for dates the vendor has blocked. */
export function ProfileCallout({ title, children, tone = "notice" }: ProfileCalloutProps) {
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
