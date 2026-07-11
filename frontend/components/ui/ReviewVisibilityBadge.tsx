export type ReviewVisibilityBadgeProps = {
  hidden: boolean;
  className?: string;
};

export function ReviewVisibilityBadge({ hidden, className = "" }: ReviewVisibilityBadgeProps) {
  const tone = hidden
    ? "bg-neutral-200 text-neutral-700"
    : "bg-emerald-100 text-emerald-900";
  const label = hidden ? "Hidden" : "Visible";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone} ${className}`.trim()}
    >
      {label}
    </span>
  );
}
