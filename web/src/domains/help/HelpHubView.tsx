import Link from "next/link";
import type { ReactNode } from "react";
import { type HelpHubTab, HELP_HUB_TAB_OPTIONS, helpHubTabHref, type HelpPortal } from "@/domains/help/helpHub";

interface HelpHubViewProps {
  portal: HelpPortal;
  tab: HelpHubTab;
  /** The Messages tab's content — the shared inbox, scoped to this hub. */
  messages: ReactNode;
  /** The Contact tab's content — the portal's contact form, embedded. */
  contact: ReactNode;
}

/**
 * `/client/help` and `/vendor/help` — a two-tab hub shared by both portals:
 * Messages (the full chat inbox, the default) and Contact (the email form).
 * Matches the baseline's `HelpHubView`: a tab control that links to
 * `helpHubTabHref`, and the active tab's pane filling the remaining height.
 */
export function HelpHubView({ portal, tab, messages, contact }: HelpHubViewProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
      <div className="shrink-0" role="tablist" aria-label="Help sections">
        <div className="inline-flex gap-1 rounded-xl bg-neutral-100 p-1">
          {HELP_HUB_TAB_OPTIONS.map((option) => {
            const active = option.value === tab;
            return (
              <Link
                key={option.value}
                href={helpHubTabHref(portal, option.value)}
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  active ? "bg-primary text-white" : "text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </div>

      {tab === "messages" ? <div className="min-h-0 flex-1">{messages}</div> : null}

      {tab === "contact" ? <div className="min-h-0 flex-1 overflow-y-auto">{contact}</div> : null}
    </div>
  );
}
