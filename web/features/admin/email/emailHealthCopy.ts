export type EmailHealthLayoutInfo = {
  title: string;
  summary: string;
  tooltip: string;
  realWorldExamples: string[];
  whenToUse: string;
};

export const EMAIL_HEALTH_LAYOUT_INFO: Record<string, EmailHealthLayoutInfo> = {
  health: {
    title: "Standard email",
    summary:
      "The everyday Eventtz look: a heading, your message, and a button. Same style as support messages and most booking updates.",
    tooltip:
      "Send a test to yourself to check delivery, or try your message text before messaging vendors or clients.",
    realWorldExamples: [
      "Support messages from admin",
      "Booking accepted, paid, or cancelled",
      "Vendor approved, under review, or asked to update their profile",
    ],
    whenToUse: "Best for almost every test. Start here.",
  },
  "layout.welcome": {
    title: "Welcome email",
    summary:
      "The longer welcome people get after signing up: hero image, short intro, and a button to get started. Your test text appears in the intro.",
    tooltip:
      "Preview the welcome design only. Real welcome emails use fixed signup copy, not your test message.",
    realWorldExamples: ["Welcome email after a client signs up", "Welcome email after a vendor signs up"],
    whenToUse: "Only when you want to preview the welcome email design.",
  },
  "layout.auth": {
    title: "Sign-in & security",
    summary:
      "A simple security email: short heading, your message, and one button (for example verify email or reset password).",
    tooltip:
      "Matches verify-email and password-reset emails. Use this to check that styling, not for support broadcasts.",
    realWorldExamples: [
      "Verify your email after signup",
      "Reset your password",
      "We noticed your password changed",
    ],
    whenToUse: "When checking sign-in and security email styling.",
  },
  "layout.admin": {
    title: "Team alert",
    summary:
      "Plain internal email for the Eventtz team. Your message is the main content.",
    tooltip:
      "What the team gets for contact forms, disputes, refund problems, and similar alerts.",
    realWorldExamples: [
      "Someone submitted the contact form",
      "A dispute was opened",
      "A refund or payout failed",
    ],
    whenToUse: "When checking team alert email styling.",
  },
};

/** Shared hint for admin Support message body (compose + email health preview). */
export const ADMIN_MESSAGE_BODY_HINT =
  "This exact text is inserted into the email body. Edit it to preview real copy (for example before a bulk Support message).";

export const EMAIL_HEALTH_FIELD_HINTS = {
  sendTo:
    "Use an inbox you can check. If the email arrives, delivery is working.",
  message: ADMIN_MESSAGE_BODY_HINT,
  layout:
    "Pick a different email design to preview. Leave Advanced closed to use the standard style.",
} as const;

export function emailHealthLayoutInfo(templateId: string): EmailHealthLayoutInfo {
  return EMAIL_HEALTH_LAYOUT_INFO[templateId] ?? EMAIL_HEALTH_LAYOUT_INFO.health;
}
