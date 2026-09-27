/**
 * Portal-dependent links and copy for the shared client/vendor inbox.
 *
 * The baseline renders one chat view and switches these on `portal`. Paths
 * stay on `/client/messages` and `/vendor/messages` (the routes this domain
 * owns); the baseline's live site redirects those URLs to Help, which is a
 * different domain.
 */

export type MessagePortal = "client" | "vendor";

export const INBOX_HEADING = "Messages";
export const EMPTY_INBOX_TITLE = "No conversations yet";
export const SELECT_CONVERSATION_TITLE = "Select a conversation";
export const CONTACT_TEAM_LABEL = "Contact the team";
export const EMPTY_THREAD_COPY = "No messages yet. Send the first one below.";
export const LOADING_CONVERSATIONS = "Loading conversations…";
export const LOADING_CONVERSATION = "Loading conversation…";
export const LOAD_INBOX_FAILED = "Could not load messages.";
export const LOAD_THREAD_FAILED = "Could not load conversation.";
export const SEND_FAILED = "Could not send message.";
export const INVALID_CONVERSATION = "Invalid conversation.";
export const BACK_TO_MESSAGES = "Messages";

/** Inbox index for `portal`. */
export function messagesPath(portal: MessagePortal): string {
  return portal === "client" ? "/client/messages" : "/vendor/messages";
}

/**
 * The Messages tab of the Help hub — the same inbox, nested under
 * `/{portal}/help` instead of the standalone `/{portal}/messages` route.
 */
export function helpMessagesPath(portal: MessagePortal): string {
  const helpPath = portal === "client" ? "/client/help" : "/vendor/help";
  return `${helpPath}/messages`;
}

/**
 * One thread. The id is encoded so a slash in it cannot change the route.
 * `basePath` overrides the inbox root — the Help hub passes its own
 * messages path so a row opens `{hub}/messages/{id}` instead.
 */
export function conversationPath(
  portal: MessagePortal,
  conversationId: string,
  basePath: string = messagesPath(portal),
): string {
  return `${basePath}/${encodeURIComponent(conversationId)}`;
}

/**
 * "Contact the team" from an empty inbox. Matches the baseline's
 * `helpHubTabHref(portal, "contact")`.
 */
export function contactTeamPath(portal: MessagePortal): string {
  const helpPath = portal === "client" ? "/client/help" : "/vendor/help";
  return `${helpPath}?tab=contact`;
}

/**
 * The peer's public profile, when this portal has one.
 *
 * A client is talking to a vendor, whose profile is the browse page. A vendor
 * is talking to a client, who has no public profile. Support is not a person.
 */
export function peerProfilePath(
  portal: MessagePortal,
  peerUserId: string,
  kind: "dm" | "support",
): string | null {
  if (portal !== "client" || kind !== "dm") return null;
  const trimmedPeerId = peerUserId.trim();
  if (!trimmedPeerId) return null;
  return `/client/browse/${encodeURIComponent(trimmedPeerId)}`;
}

/** Where a "custom quote" card opens the booking, for each portal. */
export function quoteBookingPath(portal: MessagePortal, bookingRequestId: string): string {
  const bookingsPath = portal === "client" ? "/client/bookings" : "/vendor/bookings";
  return `${bookingsPath}/${encodeURIComponent(bookingRequestId)}`;
}

/** The second line of an inbox row: unread count, support, or the peer's role. */
export function conversationPreview(
  portal: MessagePortal,
  kind: "dm" | "support",
  unreadCount: number,
): string {
  if (unreadCount > 0) {
    return `${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`;
  }
  if (kind === "support") return "Eventtz Support";
  return portal === "vendor" ? "Client conversation" : "Vendor conversation";
}

/** The line under the peer's name in an open thread. */
export function threadSubtitle(portal: MessagePortal, kind: "dm" | "support"): string {
  if (kind === "support") return "Messages with Eventtz Support";
  if (portal === "vendor") {
    return "Chat with this client, or send a custom quote they can accept from Bookings";
  }
  return "Messages with this vendor about your event";
}

/** The inbox header once the list has loaded: "1 conversation" or "2 conversations". */
export function inboxCountLabel(count: number): string {
  return `${count} conversation${count === 1 ? "" : "s"}`;
}
