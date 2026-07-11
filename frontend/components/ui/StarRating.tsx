type StarRatingProps = {
  rating: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  /** When set, stars become tappable buttons — used for one-tap review nudges. */
  onRate?: (value: number) => void;
};

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "text-xs",
  md: "text-base",
  lg: "text-2xl",
};

export function StarRating({ rating, max = 5, size = "sm", onRate }: StarRatingProps) {
  const n = Math.round(Math.min(max, Math.max(0, rating)));
  const cls = SIZE_CLASSES[size];

  if (onRate) {
    return (
      <span className={`inline-flex items-center gap-1 text-amber-600 ${cls}`} role="radiogroup" aria-label="Rating">
        {Array.from({ length: max }, (_, i) => {
          const value = i + 1;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              onClick={() => onRate(value)}
              className="rounded transition duration-150 ease-out hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {value <= n ? "★" : "☆"}
            </button>
          );
        })}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-0.5 text-amber-600 ${cls}`} aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <span key={i}>{i < n ? "★" : "☆"}</span>
      ))}
    </span>
  );
}
