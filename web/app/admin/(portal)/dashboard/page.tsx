"use client";

import { useState } from "react";
import { AdminCommercePeriodFilter } from "@/features/admin/components/AdminCommercePeriodFilter";
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
      actions={<AdminCommercePeriodFilter period={period} onPeriodChange={setPeriod} />}
    >
      <AdminDashboardView period={period} />
    </AdminConsolePage>
  );
}
