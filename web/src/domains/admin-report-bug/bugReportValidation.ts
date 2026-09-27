/** Validates the admin bug report form (`frontend/lib/validation/contact.ts` `adminBugReportSchema`). */

export function validateBugReportMessage(message: string): string | null {
  const trimmed = message.trim();
  if (trimmed.length < 10) return "Message must be at least 10 characters.";
  if (trimmed.length > 5000) return "Message must be at most 5000 characters.";
  return null;
}
