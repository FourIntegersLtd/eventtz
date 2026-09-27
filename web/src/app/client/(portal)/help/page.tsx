import { HelpHubView } from "@/domains/help/HelpHubView";
import { parseHelpHubTab } from "@/domains/help/helpHub";
import { MessagesPortalView } from "@/domains/messages/MessagesPortalView";
import { helpMessagesPath } from "@/domains/messages/messageRoutes";
import { ContactView } from "@/domains/client-contact/ContactView";

interface PageProps {
  searchParams: Promise<{ tab?: string | string[] }>;
}

/** `/client/help` — Messages (the client's full inbox) and Contact tabs. */
export default async function ClientHelpPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams;
  const tab = parseHelpHubTab(tabParam);

  return (
    <HelpHubView
      portal="client"
      tab={tab}
      messages={<MessagesPortalView portal="client" basePath={helpMessagesPath("client")} />}
      contact={<ContactView embedded />}
    />
  );
}
