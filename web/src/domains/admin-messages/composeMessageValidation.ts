/** Compose-tab validation (`frontend/lib/validation/settingsAdmin.ts` `adminComposeMessageSchema`). */

export const ADMIN_MESSAGE_MAX_LEN = 5000;

export type ComposeAudience = "selected" | "clients" | "vendors" | "users";

export function parseRecipientUserIds(text: string): string[] {
  return text
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function validateComposeMessage(input: {
  body: string;
  audience: ComposeAudience;
  recipientUserIds: string[];
}): string | null {
  const body = input.body.trim();
  if (!body) return "Enter a message.";
  if (body.length > ADMIN_MESSAGE_MAX_LEN) {
    return `Message must be at most ${ADMIN_MESSAGE_MAX_LEN} characters.`;
  }
  if (input.audience === "selected" && input.recipientUserIds.length < 1) {
    return "Enter at least one recipient user ID.";
  }
  return null;
}
