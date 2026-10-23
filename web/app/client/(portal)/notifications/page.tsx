"use client";

import { ClientEzPageHead } from "@/components/ui/ClientEzPageHead";
import { NotificationsPageView } from "@/features/notifications/NotificationsPageView";

export default function ClientNotificationsPage() {
  return (
    <div className="ez-stack ez-stack--lg">
      <ClientEzPageHead title="Notifications" description="Booking updates and messages." />
      <NotificationsPageView portal="client" />
    </div>
  );
}
