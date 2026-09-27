import { MessagesPortalView } from "@/domains/messages/MessagesPortalView";

/** `/client/messages` — the client's conversation inbox. */
export default function ClientMessagesPage() {
  return <MessagesPortalView portal="client" />;
}
