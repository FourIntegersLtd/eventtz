import type { PortalRole } from "@/lib/portalRole";

export type HelpHubTab = "messages" | "contact";

export const HELP_HUB_TAB_OPTIONS: readonly { value: HelpHubTab; label: string }[] = [
  { value: "messages", label: "Messages" },
  { value: "contact", label: "Contact" },
] as const;

export function helpHubPath(portal: PortalRole): string {
  return portal === "client" ? "/client/help" : "/vendor/help";
}

export function helpMessagesPath(portal: PortalRole): string {
  return `${helpHubPath(portal)}/messages`;
}

export function helpHubTabHref(portal: PortalRole, tab: HelpHubTab): string {
  if (tab === "messages") return helpHubPath(portal);
  return `${helpHubPath(portal)}?tab=${tab}`;
}

export function parseHelpHubTab(value: string | null | undefined): HelpHubTab {
  if (value === "contact" || value === "feedback") return "contact";
  return "messages";
}
