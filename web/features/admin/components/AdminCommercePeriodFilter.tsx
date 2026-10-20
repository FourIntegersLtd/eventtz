"use client";

import {
  ADMIN_PERIOD_OPTIONS,
  type AdminPeriodDays,
} from "@/features/admin/commerce/commercePeriod";
import { EzPeriodFilterButton } from "@/components/ui/EzPeriodFilterButton";

type AdminCommercePeriodFilterProps = {
  period: AdminPeriodDays;
  onPeriodChange: (period: AdminPeriodDays) => void;
  className?: string;
  /** @deprecated Menu alignment is unused; period opens in a modal. */
  menuAlign?: "left" | "right";
};

/** Trailing date-window preset for admin dashboards and reports. */
export function AdminCommercePeriodFilter({
  period,
  onPeriodChange,
  className = "",
}: AdminCommercePeriodFilterProps) {
  return (
    <EzPeriodFilterButton
      options={ADMIN_PERIOD_OPTIONS}
      value={period}
      onChange={onPeriodChange}
      defaultValue={30}
      className={className}
    />
  );
}
