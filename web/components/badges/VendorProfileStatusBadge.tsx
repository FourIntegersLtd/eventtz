import { Badge } from "@/components/ui/Badge";
import type { VendorProfileStatus } from "@/lib/domain-types";
import { getVendorProfileStatusMeta } from "@/lib/domain-types";

export type VendorProfileStatusBadgeProps = {
  status: VendorProfileStatus | string;
  className?: string;
};

/** Vendor onboarding form lifecycle - draft, submitted, complete. */
export function VendorProfileStatusBadge({
  status,
  className = "",
}: VendorProfileStatusBadgeProps) {
  const meta = getVendorProfileStatusMeta(status);
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}
