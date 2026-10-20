/** Sent/received chat bubble surfaces (`web/design/canvas/project/eventtz.css`). */

export const CHAT_BUBBLE_MINE = "ez-bubble ez-bubble--me";
export const CHAT_BUBBLE_THEIRS = "ez-bubble ez-bubble--them";

export function chatBubbleClass(mine: boolean): string {
  return mine ? CHAT_BUBBLE_MINE : CHAT_BUBBLE_THEIRS;
}
