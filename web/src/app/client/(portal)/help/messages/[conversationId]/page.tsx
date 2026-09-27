import { HelpHubView } from "@/domains/help/HelpHubView";
import { MessagesPortalView } from "@/domains/messages/MessagesPortalView";
import { helpMessagesPath, INVALID_CONVERSATION } from "@/domains/messages/messageRoutes";
import { ContactView } from "@/domains/client-contact/ContactView";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

/** `/client/help/messages/[conversationId]` — the Help hub's Messages tab, one thread open. */
export default async function ClientHelpMessageThreadPage({ params }: PageProps) {
  const { conversationId } = await params;
  if (!conversationId) {
    return <p className="text-sm text-neutral-600">{INVALID_CONVERSATION}</p>;
  }

  return (
    <HelpHubView
      portal="client"
      tab="messages"
      messages={
        <MessagesPortalView
          key={conversationId}
          portal="client"
          selectedConversationId={conversationId}
          basePath={helpMessagesPath("client")}
        />
      }
      contact={<ContactView embedded />}
    />
  );
}
