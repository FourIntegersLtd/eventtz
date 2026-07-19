"use client";

type ConfidenceBadgeProps = {
  score: number;
  reasons: string[];
};

export function ConfidenceBadge({ score, reasons }: ConfidenceBadgeProps) {
  const tone =
    score >= 80
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : score >= 55
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-neutral-200 bg-neutral-50 text-neutral-800";

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <p className="text-sm font-semibold">
        Confidence {score}%
      </p>
      {reasons.length ? (
        <ul className="mt-1.5 space-y-0.5 text-xs leading-relaxed opacity-90">
          {reasons.slice(0, 3).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
