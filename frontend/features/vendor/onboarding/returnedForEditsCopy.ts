import type { VendorStatusCheckFeedback } from "./types";

export const RETURNED_FOR_EDITS_TITLE = "Profile returned for edits";

export const RETURNED_FOR_EDITS_BODY =
  "You already submitted your profile. Our team sent details in Messages — read what to fix, update your profile, then submit again when you're ready.";

export const RETURNED_FOR_EDITS_FEEDBACK: VendorStatusCheckFeedback = {
  tone: "info",
  title: RETURNED_FOR_EDITS_TITLE,
  description: RETURNED_FOR_EDITS_BODY,
};
