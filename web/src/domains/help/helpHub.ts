/**
 * Help hub routing: tabs, paths, and query-param parsing for the shared
 * client/vendor Help page. Ported from the baseline's `lib/helpHub.ts`.
 *
 * `HelpPortal` is declared here (not imported from `domains/messages`)
 * because a domain may not import another domain.
 */

/** The portal whose help hub is being rendered. */
export type HelpPortal = "client" | "vendor";

/** The two tabs on the Help hub page. */
export type HelpHubTab = "messages" | "contact";

/** Tab options in display order, matching the baseline's `HELP_HUB_TAB_OPTIONS`. */
export const HELP_HUB_TAB_OPTIONS: readonly { value: HelpHubTab; label: string }[] = [
  { value: "messages", label: "Messages" },
  { value: "contact", label: "Contact" },
] as const;

/** The help hub root for a portal: `/client/help` or `/vendor/help`. */
export function helpHubPath(portal: HelpPortal): string {
  return portal === "client" ? "/client/help" : "/vendor/help";
}

/** The messages sub-path under the help hub: `/{portal}/help/messages`. */
export function helpMessagesPath(portal: HelpPortal): string {
  return `${helpHubPath(portal)}/messages`;
}

/** The href for a given tab. Messages is the default (no query param). */
export function helpHubTabHref(portal: HelpPortal, tab: HelpHubTab): string {
  if (tab === "messages") return helpHubPath(portal);
  return `${helpHubPath(portal)}?tab=${tab}`;
}

/**
 * Parse the `?tab=` search param into a `HelpHubTab`.
 *
 * Accepts `string | string[] | undefined` because Next.js's `searchParams`
 * can hold an array when the key is repeated; only the first value is used.
 * "contact" and "feedback" both resolve to the contact tab (the baseline
 * accepted "feedback" as an alias); anything else, including a missing or
 * empty value, falls back to "messages".
 */
export function parseHelpHubTab(value: string | string[] | undefined): HelpHubTab {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (firstValue === "contact" || firstValue === "feedback") return "contact";
  return "messages";
}
