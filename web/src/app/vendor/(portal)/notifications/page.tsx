import { NotificationsListView } from "@/domains/notifications/NotificationsListView";

/** `/vendor/notifications` — booking, dispute and message notifications feed. */
export default function VendorNotificationsPage() {
  return <NotificationsListView portal="vendor" />;
}
