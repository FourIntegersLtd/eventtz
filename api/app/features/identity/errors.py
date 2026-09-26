"""Errors the identity slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import Forbidden, InvalidInput, RateLimited, Unauthenticated, Unavailable

# --- sign-up --------------------------------------------------------------------------------------


class EmailAlreadyRegistered(InvalidInput):
    """Sign-up with an email that already has an account."""

    code = "email_already_registered"
    default_message = (
        "An account with this email already exists. "
        "Try signing in instead, or use Forgot password to set a new one."
    )


class SignupFailed(InvalidInput):
    """Supabase Auth refused the sign-up for another reason."""

    code = "signup_failed"
    default_message = "We couldn't create your account. Please try again."


class AuthServiceUnavailable(Unavailable):
    """Supabase Auth did not answer (timeout or network error)."""

    code = "auth_unavailable"
    default_message = "Authentication is temporarily unavailable. Please try again."


class TooManyVerificationEmails(RateLimited):
    """Too many verification emails for one address or IP in the last hour."""

    code = "verification_email_rate_limited"
    default_message = "Too many verification emails. Try again later."


# --- sign-in and session ------------------------------------------------------------------------------


class TooManySignIns(RateLimited):
    """Too many sign-in attempts for one email or IP in 15 minutes."""

    code = "sign_in_rate_limited"
    default_message = "Too many sign-in attempts. Try again in a few minutes."


class WrongCredentials(Unauthenticated):
    """Email and password do not match an account.

    The baseline always shows the "registered again" variant, since Supabase answers the same way.
    """

    code = "wrong_credentials"
    default_message = (
        "We couldn't sign you in with those details. "
        "If you recently registered again with this email, use the password "
        "from your first sign-up, or reset your password."
    )


class EmailNotConfirmed(Unauthenticated):
    """Supabase Auth has not confirmed the email (older accounts from before our own verification)."""

    code = "email_not_confirmed"
    default_message = "Confirm your email before signing in. Check your inbox for the verification link."


class SignInFailed(Unauthenticated):
    """Supabase Auth refused the sign-in for an unexpected reason."""

    code = "sign_in_failed"
    default_message = "We couldn't sign you in right now. Please try again."


class SignInUnavailable(Unavailable):
    """Supabase Auth did not answer a sign-in."""

    code = "sign_in_unavailable"
    default_message = "We couldn't sign you in right now. Please try again."


class SuspendedAtSignIn(Forbidden):
    """A suspended account tried to sign in.

    Baseline quirk, kept on purpose until the web app is rebuilt: every account type sees
    the staff wording here (it is frozen by the acceptance suite).
    """

    code = "account_suspended"
    default_message = "This account is suspended. Contact a super admin if you need access."


class DeletedAtSignIn(Unauthenticated):
    """A closed account tried to sign in."""

    code = "account_deleted"
    default_message = "This account has been deleted. You can create a new account with the same email."


class EmailNotVerified(Forbidden):
    """A client or vendor who has not clicked the verification link tried to sign in."""

    code = "email_not_verified"
    default_message = (
        "Verify your email before signing in. Check your inbox for the link we sent, or request a new one."
    )


class RefreshExpired(Unauthenticated):
    """No refresh token, or Supabase refused it."""

    code = "session_expired"
    default_message = "Your session has expired. Please sign in again."


# --- email links -----------------------------------------------------------------------------------


class TooManyLinkAttempts(InvalidInput):
    """Too many verify or reset link attempts from one IP (the baseline answers 400, not 429)."""

    code = "link_rate_limited"
    default_message = "Too many attempts. Try again later."


class VerificationLinkInvalid(InvalidInput):
    """The verify link is unknown, expired, or already used for an account still unverified."""

    code = "verification_link_invalid"
    default_message = "This verification link is invalid or has expired. Request a new one."


class VerifyEmailFailed(InvalidInput):
    """The token was fine but the account behind it could not be loaded."""

    code = "verify_email_failed"
    default_message = "Could not verify email. Try again."


class TooManyResetRequests(RateLimited):
    """Too many forgot-password requests for one address or IP in the last hour."""

    code = "reset_request_rate_limited"
    default_message = "Too many reset requests. Try again later."


class ResetLinkInvalid(InvalidInput):
    """The reset link is unknown or expired."""

    code = "reset_link_invalid"
    default_message = "This reset link is invalid or has expired. Request a new one."


class ResetLinkUsed(InvalidInput):
    """The reset link was already used."""

    code = "reset_link_used"
    default_message = "This reset link has already been used. Request a new one."


class ResetSignInFailed(InvalidInput):
    """The password was reset but signing in with it straight away failed."""

    code = "reset_sign_in_failed"
    default_message = (
        "Password updated, but we couldn't sign you in automatically. Please sign in with your new password."
    )


# --- passwords -------------------------------------------------------------------------------------


class WeakPassword(InvalidInput):
    """The new password breaks the strength rules; the message says which one."""

    code = "weak_password"


class PasswordUpdateFailed(InvalidInput):
    """Supabase Auth did not accept the new password, or the account has no email."""

    code = "password_update_failed"
    default_message = "Could not update password. Try again."


class PasswordUnchanged(InvalidInput):
    """The new password is the same as the current one."""

    code = "password_unchanged"
    default_message = "Choose a new password that is different from your current one."


class CurrentPasswordIncorrect(InvalidInput):
    """The current password given on the change-password form is wrong."""

    code = "current_password_incorrect"
    default_message = "Current password is incorrect."


class TooManyPasswordChanges(InvalidInput):
    """Too many change-password attempts (the baseline answers 400, not 429)."""

    code = "change_password_rate_limited"
    default_message = "Too many password change attempts. Try again later."
