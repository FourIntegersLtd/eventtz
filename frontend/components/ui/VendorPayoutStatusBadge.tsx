import { getVendorPayoutStatusMeta } from "@/lib/domain-types";

export type VendorPayoutStatusBadgeProps = {
  verified: boolean | undefined;
  className?: string;
};

export function VendorPayoutStatusBadge({
  verified,
  className = "",
}: VendorPayoutStatusBadgeProps) {
  const meta = getVendorPayoutStatusMeta(verified);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClassName} ${className}`.trim()}
    >
      {meta.label}
    </span>
  );
}
