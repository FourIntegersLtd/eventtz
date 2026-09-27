/** Validates the email health test-send form before calling the api. */

export function validateEmailTestSend(input: {
  templateId: string;
  toEmail: string;
  messageBody: string;
}): string | null {
  if (!input.templateId.trim()) return "Choose a layout.";
  const email = input.toEmail.trim();
  if (!email || !email.includes("@")) return "Enter a valid email address.";
  if (!input.messageBody.trim()) return "Enter a message.";
  return null;
}
