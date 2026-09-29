/** returnedForEditsCopy for the vendor onboarding wizard. */

import type { VendorStatusCheckFeedback } from "./types";

export const RETURNED_FOR_EDITS_TITLE = "Profile returned for edits";

export const RETURNED_FOR_EDITS_BODY =
  "Thank you for submitting your profile. You're almost there. We've reviewed it and noticed a few things you need to update. Please check Messages for the details, and feel free to reply if you have any questions. Make those changes, then submit again when you're ready.";

export const RETURNED_FOR_EDITS_FEEDBACK: VendorStatusCheckFeedback = {
  tone: "info",
  title: RETURNED_FOR_EDITS_TITLE,
  description: RETURNED_FOR_EDITS_BODY,
};
