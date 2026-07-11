import type { UserType } from "@/lib/domain-types";

/** User-facing copy for auth and role errors (keep in sync with backend `app/api/authz.py` where possible). */

export const VENDOR_PROFILE_FORBIDDEN =
  "This page is for vendor accounts. If you offer services on Eventtz, create a vendor account or sign out and sign in again so we can refresh your account type. If you're planning an event, use client sign-in instead.";

export const LOGIN_CREDENTIALS_MISMATCH =
  "We couldn't sign you in with those details. Check your email and password, then try again.";

export const ADMIN_ACCOUNT_REQUIRED =
  "This sign-in is only for team admin accounts. If you're a vendor or client, use the matching sign-in page instead.";

export const SIGNUP_GENERIC_ERROR =
  "We couldn't finish creating your account. Please try again in a moment.";

export const SESSION_VERIFY_FAILED =
  "We signed you in but couldn't verify your account. Please try again, or refresh the page.";

/** After credentials succeed on `/admin/login`, block non-admin sessions. */
export function wrongAdminPortalMessage(actual: UserType | undefined): string {
  if (actual == null) {
    return "We couldn't confirm your account type. Please try again, or contact support if this keeps happening.";
  }
  if (actual === "vendor") {
    return "This sign-in is for Eventtz team admins only. Your account is a vendor account — use vendor sign-in to open your dashboard.";
  }
  if (actual === "client") {
    return "This sign-in is for Eventtz team admins only. Your account is a client account — use client sign-in instead.";
  }
  return ADMIN_ACCOUNT_REQUIRED;
}
