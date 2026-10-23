import type { RefinementCtx } from "zod";

/** Longest chat or support message body, in visible characters (chat composer and support drafts). */
export const MESSAGE_MAX_LEN = 5000;

/** Shared visible-text length rules for admin Support / email-test rich message drafts. */
export function refineSupportMessageTextLength(
  textLength: number,
  ctx: RefinementCtx,
  path = "body",
): void {
  if (textLength < 1) {
    ctx.addIssue({
      code: "custom",
      path: [path],
      message: "Enter a message.",
    });
  }
  if (textLength > MESSAGE_MAX_LEN) {
    ctx.addIssue({
      code: "custom",
      path: [path],
      message: `Message must be at most ${MESSAGE_MAX_LEN} characters.`,
    });
  }
}
