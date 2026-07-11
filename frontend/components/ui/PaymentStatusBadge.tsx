import {
  paymentStatusLabel,
  paymentStatusToneClasses,
} from "@/lib/bookingStatusStyles";

export type PaymentStatusBadgeProps = {
  status: string;
  className?: string;
};

/** Money lifecycle badge — independent of booking request `status`. */
export function PaymentStatusBadge({ status, className = "" }: PaymentStatusBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${paymentStatusToneClasses(status)} ${className}`.trim()}
    >
      {paymentStatusLabel(status)}
    </span>
  );
}
