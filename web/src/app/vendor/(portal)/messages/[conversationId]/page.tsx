import { ConversationThreadView } from "@/domains/vendor-messages/ConversationThreadView";

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

/** `/vendor/messages/[conversationId]` — one conversation thread. */
export default async function VendorMessageThreadPage({ params }: PageProps) {
  const { conversationId } = await params;
  return <ConversationThreadView key={conversationId} conversationId={conversationId} backHref="/vendor/messages" />;
}
