/** Relative "saved" wording for the wizard's draft badge. */

/**
 * Describe when the draft was last saved, e.g. "just now" or "5 min ago".
 * Returns null when there is no saved row yet or the timestamp is unreadable.
 */
export function draftSavedLabel(savedAtIso: string | null, nowMs: number = Date.now()): string | null {
  if (!savedAtIso) return null;
  const savedMs = Date.parse(savedAtIso);
  if (Number.isNaN(savedMs)) return null;
  const seconds = Math.max(0, Math.floor((nowMs - savedMs) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
