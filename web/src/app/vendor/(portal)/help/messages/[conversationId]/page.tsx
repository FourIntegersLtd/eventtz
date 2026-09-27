import { HelpHubView } from "@/domains/vendor-help/HelpHubView";

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

/** `/vendor/help/messages/[conversationId]` — the Help page's Messages tab, one thread open. */
export default async function VendorHelpMessageThreadPage({ params }: PageProps) {
  const { conversationId } = await params;
  return <HelpHubView key={conversationId} selectedConversationId={conversationId} />;
}
