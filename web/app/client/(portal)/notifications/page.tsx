"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { NotificationsPageView } from "@/features/notifications/NotificationsPageView";

export default function ClientNotificationsPage() {
  return (
    <div className="ez-stack ez-stack--lg">
      <PageHeader title="Notifications" description="Booking updates and messages." />
      <NotificationsPageView portal="client" />
    </div>
  );
}
