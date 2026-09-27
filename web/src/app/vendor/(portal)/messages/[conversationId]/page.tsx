import { MessagesPortalView } from "@/domains/messages/MessagesPortalView";
import { INVALID_CONVERSATION } from "@/domains/messages/messageRoutes";

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

/** `/vendor/messages/[conversationId]` — the inbox with one thread open. */
export default async function VendorMessageThreadPage({ params }: PageProps) {
  const { conversationId } = await params;
  if (!conversationId) {
    return <p className="text-sm text-neutral-600">{INVALID_CONVERSATION}</p>;
  }
  return <MessagesPortalView key={conversationId} portal="vendor" selectedConversationId={conversationId} />;
}
