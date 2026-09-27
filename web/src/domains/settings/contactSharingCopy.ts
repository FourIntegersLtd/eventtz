/** Role-dependent copy for the contact-sharing settings card, shared by both portals. */
export type SettingsRole = "client" | "vendor";

/** The card heading and one-line description shown above the sharing toggles. */
export interface ContactSharingCopy {
  title: string;
  description: string;
}

/**
 * The heading/description wording differs by role (baseline literals). The
 * vendor wording is the already-shipped web/ copy, kept stable.
 */
export function contactSharingCopy(role: SettingsRole): ContactSharingCopy {
  if (role === "client") {
    return {
      title: "After you pay",
      description: "Email and phone stay hidden until you pay.",
    };
  }
  return {
    title: "Contact sharing",
    description: "Choose what clients you've booked with can see.",
  };
}
