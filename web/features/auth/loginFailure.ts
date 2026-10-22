import { getApiErrorCode, getApiErrorDetail } from "@/lib/api-errors";
import { EMAIL_NOT_VERIFIED_CODE, GENERIC_AUTH_ERROR, SessionVerifyError } from "@/lib/auth-messages";

export type LoginFailure = {
  message: string;
  /** Show the "resend verification email" prompt. */
  needsVerification: boolean;
  /** Analytics reason for the login_failed event. */
  reason: "session_verify" | "credentials";
};

/** Turn a sign-in error into what the login form shows, branching on the API `code` and error type, never on copy. */
export function classifyLoginFailure(err: unknown): LoginFailure {
  const message =
    getApiErrorDetail(err) ?? (err instanceof Error && err.message.trim() ? err.message : GENERIC_AUTH_ERROR);
  return {
    message,
    needsVerification: getApiErrorCode(err) === EMAIL_NOT_VERIFIED_CODE,
    reason: err instanceof SessionVerifyError ? "session_verify" : "credentials",
  };
}
