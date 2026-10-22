import type { UserType } from "@/lib/domain-types";

/**
 * Client-only auth UX copy.
 *
 * API error strings are defined in backend `app/features/auth/messages.py` and
 * returned in response bodies — use `getApiErrorDetail(err)` first.
 * `GENERIC_AUTH_ERROR` is only for rare cases when the API sends no detail.
 */

export const GENERIC_AUTH_ERROR = "Something went wrong. Please try again.";

export const SESSION_VERIFY_FAILED =
  "We signed you in but couldn't verify your account. Please try again, or refresh the page.";

/** Admin login page — not returned by a dedicated API error code. */
export const ADMIN_ACCOUNT_REQUIRED =
  "This sign-in is only for team admin accounts. If you're a vendor or client, use the matching sign-in page instead.";

/** When `?next=` targets admin, block non-admin sessions after sign-in. */
export function wrongAdminPortalMessage(actual: UserType | undefined): string {
  if (actual == null) {
    return "We couldn't confirm your account type. Please try again, or contact support if this keeps happening.";
  }
  if (actual === "vendor") {
    return "This sign-in is for Eventtz team admins only. Your account is a vendor account - use vendor sign-in to open your dashboard.";
  }
  if (actual === "client") {
    return "This sign-in is for Eventtz team admins only. Your account is a client account - use client sign-in instead.";
  }
  return ADMIN_ACCOUNT_REQUIRED;
}

/** Thrown by sign-in when the credentials worked but the follow-up session check failed. */
export class SessionVerifyError extends Error {
  constructor() {
    super(SESSION_VERIFY_FAILED);
    this.name = "SessionVerifyError";
  }
}

/** AppError code the API returns when a client or vendor signs in before verifying their email. */
export const EMAIL_NOT_VERIFIED_CODE = "email_not_verified";
