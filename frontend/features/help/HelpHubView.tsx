"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { ContactFormView } from "@/features/contact/ContactFormView";
import { FeedbackFormView } from "@/features/contact/FeedbackFormView";
import { ChatPortalView } from "@/features/chat/ChatPortalView";
import {
  HELP_HUB_TAB_OPTIONS,
  helpHubTabHref,
  type HelpHubTab,
} from "@/lib/helpHub";

type HelpHubViewProps = {
  portal: PortalRole;
  tab: HelpHubTab;
  selectedConversationId?: string;
};

export function HelpHubView({ portal, tab, selectedConversationId }: HelpHubViewProps) {
  const router = useRouter();
  const isMessages = tab === "messages";

  return (
    <div
      className={`flex min-h-0 w-full flex-col ${isMessages ? "h-full flex-1" : "gap-4"}`}
    >
      <div className="shrink-0">
        <SegmentedControl
          aria-label="Help sections"
          options={HELP_HUB_TAB_OPTIONS}
          value={tab}
          stretch
          onChange={(next) => router.push(helpHubTabHref(portal, next))}
        />
      </div>

      {tab === "messages" ? (
        <div className="min-h-0 flex-1">
          <ChatPortalView
            portal={portal}
            selectedConversationId={selectedConversationId}
            contactTabHref={helpHubTabHref(portal, "contact")}
          />
        </div>
      ) : null}

      {tab === "contact" ? <ContactFormView role={portal} embedded /> : null}
      {tab === "feedback" ? <FeedbackFormView role={portal} /> : null}
    </div>
  );
}
