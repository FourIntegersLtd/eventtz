/** Approval strings the onboarding wizard branches on. */

/** Admin decision on a submitted vendor. */
export type VendorApprovalStatus = "pending" | "approved" | "banned";

/** Whether the vendor is still editing or has sent the form for review. */
export type VendorProfileStatus = "draft" | "submitted" | "complete";
