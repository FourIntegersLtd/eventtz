import { Badge } from "@/components/ui/Badge";
import { getBookingStatusMeta } from "@/lib/domain-types";

export type StatusBadgeProps = {
  /** Raw status string from the API - narrowed internally via `getBookingStatusMeta`. */
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
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}
