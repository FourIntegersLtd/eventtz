export type AccountStatusBadgeProps = {
  suspended: boolean;
  className?: string;
};

/** Admin client account — active vs suspended. */
export function AccountStatusBadge({ suspended, className = "" }: AccountStatusBadgeProps) {
  const tone = suspended
    ? "bg-neutral-200 text-neutral-700"
    : "bg-emerald-100 text-emerald-900";
  const label = suspended ? "Suspended" : "Active";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone} ${className}`.trim()}
    >
      {label}
    </span>
  );
}
