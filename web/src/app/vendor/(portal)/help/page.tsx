import { HelpHubView } from "@/domains/help/HelpHubView";
import { parseHelpHubTab } from "@/domains/help/helpHub";
import { MessagesPortalView } from "@/domains/messages/MessagesPortalView";
import { helpMessagesPath } from "@/domains/messages/messageRoutes";
import { ContactView } from "@/domains/vendor-contact/ContactView";

interface PageProps {
  searchParams: Promise<{ tab?: string | string[] }>;
}

/** `/vendor/help` — Messages (the vendor's full inbox) and Contact tabs. */
export default async function VendorHelpPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams;
  const tab = parseHelpHubTab(tabParam);

  return (
    <HelpHubView
      portal="vendor"
      tab={tab}
      messages={<MessagesPortalView portal="vendor" basePath={helpMessagesPath("vendor")} />}
      contact={<ContactView embedded />}
    />
  );
}
