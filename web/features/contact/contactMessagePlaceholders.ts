import type { PortalRole } from "@/lib/portalRole";

export const VENDOR_CONTACT_MESSAGE_EXAMPLES = [
  "I cannot upload photos or videos to my portfolio",
  "I cannot receive payments or connect my Stripe account",
  "My payout is stuck on hold after I marked the booking complete",
  "My profile is still pending review and I cannot go live",
  "A client opened a dispute and I need help responding",
  "I need to update my services, prices, or availability",
  "I accepted a booking but the client has not paid yet",
  "I cannot send or receive messages with a client",
  "I need help with a cancellation or refund on a booking",
  "Something on my dashboard looks wrong or will not load",
] as const;

export const CLIENT_CONTACT_MESSAGE_EXAMPLES = [
  "I cannot complete payment for my booking",
  "I need to cancel a booking and want to know about a refund",
  "I have not heard back from a vendor after messaging them",
  "Something went wrong at my event and I need to report it",
  "I was charged the wrong amount or see an unexpected fee",
  "My booking status has not updated after I paid",
  "I need help opening or updating a dispute",
  "A vendor cancelled or changed my booking at the last minute",
  "I cannot access my receipt, messages, or booking details",
  "I need help with my account, login, or email settings",
] as const;

export function contactMessagePlaceholderExamples(
  role: PortalRole,
): readonly string[] {
  return role === "vendor"
    ? VENDOR_CONTACT_MESSAGE_EXAMPLES
    : CLIENT_CONTACT_MESSAGE_EXAMPLES;
}
