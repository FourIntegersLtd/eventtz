"use client";

import { NotificationsPageView } from "@/features/notifications/NotificationsPageView";

/** Vendor notification history (shared view with the client page). */
export default function VendorNotificationsPage() {
  return <NotificationsPageView portal="vendor" />;
}
