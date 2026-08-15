"use client";

function scoreRingColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function scoreTrackColor(score: number): string {
  if (score >= 75) return "stroke-emerald-500";
  if (score >= 50) return "stroke-amber-500";
  return "stroke-red-500";
}

type Props = {
  score: number;
  size?: "default" | "compact";
};

export function GrowthScoreRing({ score, size = "default" }: Props) {
  const compact = size === "compact";
  const radius = compact ? 20 : 36;
  const svgSize = compact ? 56 : 96;
  const strokeWidth = compact ? 5 : 8;
  const containerClass = compact ? "h-14 w-14" : "h-24 w-24";
  const scoreClass = compact ? "text-lg font-bold" : "text-2xl font-bold";
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = svgSize / 2;

  return (
    <div className={`relative flex ${containerClass} shrink-0 items-center justify-center`}>
      <svg
        className="-rotate-90"
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        aria-hidden
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-neutral-200"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={scoreTrackColor(score)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`tabular-nums ${scoreClass} ${scoreRingColor(score)}`}>{score}</span>
        {!compact ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            Score
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function growthScoreTextColor(score: number): string {
  return scoreRingColor(score);
}
