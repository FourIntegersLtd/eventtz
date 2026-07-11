import type { VendorProfileStatus } from "@/lib/domain-types";
import { getVendorProfileStatusMeta } from "@/lib/domain-types";

export type VendorProfileStatusBadgeProps = {
  status: VendorProfileStatus | string;
  className?: string;
};

/** Vendor onboarding form lifecycle — draft, submitted, complete. */
export function VendorProfileStatusBadge({
  status,
  className = "",
}: VendorProfileStatusBadgeProps) {
  const meta = getVendorProfileStatusMeta(status);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClassName} ${className}`.trim()}
    >
      {meta.label}
    </span>
  );
}
