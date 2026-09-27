import { ConversationListView } from "@/domains/vendor-messages/ConversationListView";

/** `/vendor/messages` — the vendor's full conversation inbox. */
export default function VendorMessagesPage() {
  return <ConversationListView basePath="/vendor/messages" />;
}
