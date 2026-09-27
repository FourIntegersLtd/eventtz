import { MessagesPortalView } from "@/domains/messages/MessagesPortalView";

/** `/vendor/messages` — the vendor's conversation inbox. */
export default function VendorMessagesPage() {
  return <MessagesPortalView portal="vendor" />;
}
