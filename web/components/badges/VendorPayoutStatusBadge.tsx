import { Badge } from "@/components/ui/Badge";
import { getVendorPayoutStatusMeta } from "@/lib/domain-types";

export type VendorPayoutStatusBadgeProps = {
  verified: boolean | undefined;
  className?: string;
};

/** Stripe Connect payout readiness of a vendor - verified or not. */
export function VendorPayoutStatusBadge({
  verified,
  className = "",
}: VendorPayoutStatusBadgeProps) {
  const meta = getVendorPayoutStatusMeta(verified);
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}
