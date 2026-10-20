"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { ContactFormView } from "@/features/contact/ContactFormView";
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
  useEzChrome?: boolean;
};

export function HelpHubView({
  portal,
  tab,
  selectedConversationId,
  useEzChrome = false,
}: HelpHubViewProps) {
  const router = useRouter();

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
      <div className="shrink-0">
        {useEzChrome ? (
          <div className="ez-seg" aria-label="Help sections">
            {HELP_HUB_TAB_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={helpHubTabHref(portal, option.value)}
                className={
                  tab === option.value ? "ez-seg__item ez-seg__item--active" : "ez-seg__item"
                }
              >
                {option.label}
              </Link>
            ))}
          </div>
        ) : (
          <SegmentedControl
            aria-label="Help sections"
            options={HELP_HUB_TAB_OPTIONS}
            value={tab}
            onChange={(next) => router.push(helpHubTabHref(portal, next))}
          />
        )}
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

      {tab === "contact" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ContactFormView role={portal} embedded />
        </div>
      ) : null}
    </div>
  );
}
