import { HelpHubView } from "@/domains/help/HelpHubView";
import { MessagesPortalView } from "@/domains/messages/MessagesPortalView";
import { helpMessagesPath, INVALID_CONVERSATION } from "@/domains/messages/messageRoutes";
import { ContactView } from "@/domains/vendor-contact/ContactView";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

/** `/vendor/help/messages/[conversationId]` — the Help hub's Messages tab, one thread open. */
export default async function VendorHelpMessageThreadPage({ params }: PageProps) {
  const { conversationId } = await params;
  if (!conversationId) {
    return <p className="text-sm text-neutral-600">{INVALID_CONVERSATION}</p>;
  }

  return (
    <HelpHubView
      portal="vendor"
      tab="messages"
      messages={
        <MessagesPortalView
          key={conversationId}
          portal="vendor"
          selectedConversationId={conversationId}
          basePath={helpMessagesPath("vendor")}
        />
      }
      contact={<ContactView embedded />}
    />
  );
}
