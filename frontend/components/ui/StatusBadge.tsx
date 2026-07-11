import { getBookingStatusMeta } from "@/lib/domain-types";

export type StatusBadgeProps = {
  /** Raw status string from the API — narrowed internally via `getBookingStatusMeta`. */
  status: string;
  className?: string;
};

/**
 * The one place booking status renders as color+label. Every screen that
 * shows a booking status (list rows, detail header, calendar, attention
 * feed) should use this instead of re-deriving status -> color per file.
 */
export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const meta = getBookingStatusMeta(status);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClassName} ${className}`.trim()}
    >
      {meta.label}
    </span>
  );
}
