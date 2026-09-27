/**
 * Rules for a chat draft before it is posted.
 *
 * Mirrors the baseline's `chatMessageSchema` (`messageBodySchema` with min 1,
 * max 5000, label "Message"): trim, reject blank, reject over-long. The
 * composer also clamps keystrokes to the max so the counter cannot run past it.
 */

export const MESSAGE_MAX_LENGTH = 5000;

export type MessageDraftResult = { ok: true; body: string } | { ok: false; error: string };

/** Drop anything past the max. The counter and the field both use this length. */
export function clampMessageDraft(value: string): string {
  return value.slice(0, MESSAGE_MAX_LENGTH);
}

/** Trim and accept, or the baseline validation sentence. The raw draft is left untouched. */
export function validateMessageDraft(raw: string): MessageDraftResult {
  const body = raw.trim();
  if (body.length < 1) return { ok: false, error: "Message cannot be empty." };
  if (body.length > MESSAGE_MAX_LENGTH) return { ok: false, error: "Message is too long." };
  return { ok: true, body };
}
