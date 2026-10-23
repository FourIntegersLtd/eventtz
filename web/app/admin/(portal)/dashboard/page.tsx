"use client";

import { useState } from "react";
import { EzPeriodFilterButton } from "@/components/ui/EzPeriodFilterButton";
import { ADMIN_PERIOD_OPTIONS } from "@/lib/commercePeriod";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import {
  AdminDashboardView,
  adminDashboardTodayLine,
} from "@/features/admin/dashboard/AdminDashboardView";
import type { AdminPeriodDays } from "@/lib/commercePeriod";

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<AdminPeriodDays>(30);

  return (
    <AdminConsolePage
      title="Dashboard"
      description={adminDashboardTodayLine()}
      actions={<EzPeriodFilterButton options={ADMIN_PERIOD_OPTIONS} value={period} onChange={setPeriod} defaultValue={30} />}
    >
      <AdminDashboardView period={period} />
    </AdminConsolePage>
  );
}
