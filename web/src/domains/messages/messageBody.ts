/**
 * How a stored message should be drawn: a quote card, staff HTML, or plain
 * text with links. Pure so the thread view and the tests share one reading
 * of `MessageRow.metadata`.
 */

export interface QuoteCard {
  bookingRequestId: string;
  eventName: string;
  totalLabel: string;
}

export type MessageSegment = { kind: "text"; value: string } | { kind: "url"; value: string };

const URL_PATTERN = /https?:\/\/[^\s]+/g;

/** Staff messages are stored as HTML (`metadata.format === "html"`). */
export function isHtmlMessage(metadata: Readonly<Record<string, unknown>> | null | undefined): boolean {
  return Boolean(metadata && metadata.format === "html");
}

/**
 * A "quote sent" card, or null when this message is ordinary text.
 * Requires the booking id the baseline uses before it will render the card.
 */
export function quoteCardFromMetadata(
  metadata: Readonly<Record<string, unknown>> | null | undefined,
): QuoteCard | null {
  if (!metadata || metadata.kind !== "quote") return null;
  const bookingRequestId = metadata.booking_request_id;
  const eventName = metadata.event_name;
  const totalLabel = metadata.total_label;
  if (typeof bookingRequestId !== "string" || bookingRequestId.length === 0) return null;
  if (typeof eventName !== "string" || typeof totalLabel !== "string") return null;
  return { bookingRequestId, eventName, totalLabel };
}

/** Split plain text into text and http(s) URL runs, in order, like the baseline linkifier. */
export function splitMessageLinks(body: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    const url = match[0] ?? "";
    if (index > lastIndex) {
      segments.push({ kind: "text", value: body.slice(lastIndex, index) });
    }
    segments.push({ kind: "url", value: url });
    lastIndex = index + url.length;
  }
  if (lastIndex < body.length) {
    segments.push({ kind: "text", value: body.slice(lastIndex) });
  }
  return segments;
}
