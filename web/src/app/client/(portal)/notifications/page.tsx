import { NotificationsListView } from "@/domains/notifications/NotificationsListView";

/** `/client/notifications` — booking, dispute and message notifications feed. */
export default function ClientNotificationsPage() {
  return <NotificationsListView portal="client" />;
}
