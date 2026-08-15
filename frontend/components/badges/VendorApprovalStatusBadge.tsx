import type { VendorApprovalStatus } from "@/lib/domain-types";
import { getVendorApprovalStatusMeta } from "@/lib/domain-types";

export type VendorApprovalStatusBadgeProps = {
  status: VendorApprovalStatus | string;
  className?: string;
};

export function VendorApprovalStatusBadge({
  status,
  className = "",
}: VendorApprovalStatusBadgeProps) {
  const meta = getVendorApprovalStatusMeta(status);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClassName} ${className}`.trim()}
    >
      {meta.label}
    </span>
  );
}
