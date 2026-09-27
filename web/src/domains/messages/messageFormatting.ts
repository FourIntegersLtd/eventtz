/**
 * Pure formatting helpers for the messages domain: day-divider grouping for
 * a thread, the compact "when" label the conversation list shows, and the
 * full timestamp on a message bubble.
 *
 * Kept dependency-free (no date library — AGENTS.md's rebuild allows none)
 * and free of React so `messageFormatting.test.ts` can assert literal output
 * without rendering anything. List and bubble times take a time zone so tests
 * can pin UTC; the inbox passes the viewer's zone, matching the baseline's
 * `toLocaleString` (local) labels.
 */

/** The minimum shape `groupMessagesByDay` needs from a message. */
export interface TimestampedMessage {
  created_at?: string | null;
}

/** One day's messages, in thread order, under a human label. */
export interface DayGroup<Message> {
  label: string;
  messages: Message[];
}

/** `YYYY-MM-DD` in UTC, so day grouping never depends on the reader's time zone. */
function utcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` in `timeZone`, for "is this the same local day as now?". */
function dateKeyInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "Today", "Yesterday", or a full date, for the divider above a day's messages. */
export function dayDividerLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const key = utcDateKey(date);
  const todayKey = utcDateKey(now);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (key === todayKey) return "Today";
  if (key === utcDateKey(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: date.getUTCFullYear() === now.getUTCFullYear() ? undefined : "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Group consecutive same-day messages under one divider, in the order given. */
export function groupMessagesByDay<Message extends TimestampedMessage>(
  messages: readonly Message[],
  now: Date = new Date(),
): DayGroup<Message>[] {
  const groups: { key: string; label: string; messages: Message[] }[] = [];
  for (const message of messages) {
    const iso = message.created_at ?? now.toISOString();
    const key = utcDateKey(new Date(iso));
    const openGroup = groups[groups.length - 1];
    if (openGroup && openGroup.key === key) {
      openGroup.messages.push(message);
    } else {
      groups.push({ key, label: dayDividerLabel(iso, now), messages: [message] });
    }
  }
  return groups.map(({ label, messages: groupMessages }) => ({ label, messages: groupMessages }));
}

/** 24-hour clock time, e.g. "14:05". Defaults to UTC so tests stay literal. */
export function formatMessageTime(iso: string | null | undefined, timeZone = "UTC"): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

/**
 * Timestamp under a message bubble, matching the baseline's `formatDateTime`:
 * "26 Sept 2026, 14:05". A missing value is "-", and a non-date is returned as given.
 */
export function formatBubbleTime(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  });
}

/**
 * Compact "when this last happened" for the conversation list: a clock time
 * when it falls on the same calendar day as `now` in `timeZone`, otherwise a
 * short date. Defaults to UTC so existing tests stay literal; the inbox
 * passes the viewer's zone.
 */
export function formatConversationActivity(
  iso: string | null | undefined,
  now: Date = new Date(),
  timeZone = "UTC",
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (dateKeyInZone(date, timeZone) === dateKeyInZone(now, timeZone)) return formatMessageTime(iso, timeZone);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(date);
}

/** The unread-count pill's text, capped so a very active thread doesn't blow out the layout. */
export function formatUnreadBadge(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/** Initials shown in the peer avatar circle, from a display name or email. */
export function peerInitials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  const first = parts[0] ?? "";
  const second = parts[1] ?? "";
  return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase();
}
