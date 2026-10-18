import { Badge } from "@/components/ui/Badge";
import { paymentStatusLabel, paymentStatusTone } from "@/lib/bookingStatusStyles";

export type PaymentStatusBadgeProps = {
  status: string;
  className?: string;
};

/** Money lifecycle badge - independent of booking request `status`. */
export function PaymentStatusBadge({ status, className = "" }: PaymentStatusBadgeProps) {
  return (
    <Badge tone={paymentStatusTone(status)} className={className}>
      {paymentStatusLabel(status)}
    </Badge>
  );
}
