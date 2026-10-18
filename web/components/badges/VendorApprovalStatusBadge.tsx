import { Badge } from "@/components/ui/Badge";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { getVendorApprovalStatusMeta } from "@/lib/domain-types";

export type VendorApprovalStatusBadgeProps = {
  status: VendorApprovalStatus | string;
  className?: string;
};

/** Admin approval state of a vendor - pending, approved, banned. */
export function VendorApprovalStatusBadge({
  status,
  className = "",
}: VendorApprovalStatusBadgeProps) {
  const meta = getVendorApprovalStatusMeta(status);
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}
