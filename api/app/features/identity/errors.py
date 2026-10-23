"""Errors the identity slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.auth import SessionExpired
from app.core.errors import Conflict, Forbidden, InvalidInput, RateLimited, Unauthenticated

# --- sign-up --------------------------------------------------------------------------------------


class EmailAlreadyRegistered(InvalidInput):
    """Sign-up with an email that already has an account."""

    code = "email_already_registered"
    default_message = (
        "An account with this email already exists. "
        "Try signing in instead, or use Forgot password to set a new one."
    )


class TooManyVerificationEmails(RateLimited):
    """Too many verification emails for one address or IP in the last hour."""

    code = "verification_email_rate_limited"
    default_message = "Too many verification emails. Try again later."
    # Sign-up checks the email allowance after creating the account, and the
    # account must survive the refusal: the user asks for a new link later.
    persist_effects = True


# --- sign-in and session ------------------------------------------------------------------------------


class TooManySignIns(RateLimited):
    """Too many sign-in attempts for one email or IP in 15 minutes."""

    code = "sign_in_rate_limited"
    default_message = "Too many sign-in attempts. Try again in a few minutes."


class WrongCredentials(Unauthenticated):
    """Email and password do not match an account.

    The baseline always shows the "registered again" variant; kept so the web app's copy is unchanged.
    """

    code = "wrong_credentials"
    default_message = (
        "We couldn't sign you in with those details. "
        "If you recently registered again with this email, use the password "
        "from your first sign-up, or reset your password."
    )


class SuspendedAtSignIn(Forbidden):
    """A suspended account tried to sign in.

    Baseline quirk, kept on purpose: the acceptance freeze pins it, so every account type
    sees the staff wording here.
    """

    code = "account_suspended"
    default_message = "This account is suspended. Contact a super admin if you need access."


# Sent with `AccountDeleted` / `SessionExpired` (core.auth owns those codes) where sign-in and the
# refresh exchange word the refusal differently from a bad access token.
DELETED_AT_SIGN_IN_MESSAGE = (
    "This account has been deleted. You can create a new account with the same email."
)
REFRESH_EXPIRED_MESSAGE = "Your session has expired. Please sign in again."


def refresh_expired() -> SessionExpired:
    """The `SessionExpired` the refresh exchange raises, worded for a refresh token."""
    return SessionExpired(REFRESH_EXPIRED_MESSAGE)


class EmailNotVerified(Forbidden):
    """A client or vendor who has not clicked the verification link tried to sign in."""

    code = "email_not_verified"
    default_message = (
        "Verify your email before signing in. Check your inbox for the link we sent, or request a new one."
    )


class RefreshTokenReused(SessionExpired):
    """A refresh token that was already exchanged came back: someone else holds a copy.

    The whole sign-in (its chain) is revoked, and that revocation must be kept
    even though the request fails, hence `persist_effects`.
    """

    code = "refresh_token_reused"
    default_message = REFRESH_EXPIRED_MESSAGE
    persist_effects = True


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


# --- passwords -------------------------------------------------------------------------------------


class WeakPassword(InvalidInput):
    """The new password breaks the strength rules; the message says which one."""

    code = "weak_password"


class PasswordUpdateFailed(InvalidInput):
    """The account has no email address to sign in with, so its password cannot be set."""

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


# --- account deletion ------------------------------------------------------------------------------


class AccountDeletionForbiddenForAdmin(Forbidden):
    """Staff cannot close their own account from settings; team access is removed by a super admin."""

    code = "account_deletion_staff"
    default_message = "Staff accounts cannot be deleted here. Ask a super admin to remove team access."


class AccountDeletionMoneyInFlight(Conflict):
    """A booking of this account still has a payment in progress (paid and not yet paid out, or pending)."""

    code = "money_in_flight"
    default_message = (
        "You have a booking with payment still in progress. "
        "Finish payout or wait for a refund, then try again."
    )


class AccountDeletionActiveBooking(Conflict):
    """An accepted booking of this account has not happened yet."""

    code = "active_booking"
    default_message = (
        "You have an accepted booking that has not happened yet. Complete or cancel it first, then try again."
    )


class AccountDeletionOpenDispute(Conflict):
    """A problem report on one of this account's bookings is still open."""

    code = "open_dispute"
    default_message = "You have an open problem report. Wait until it is resolved, then try again."


# --- terms of service -----------------------------------------------------------------------------------


class TermsVersionMismatch(Conflict):
    """The user accepted a Terms version that is not the current one (their page was out of date)."""

    code = "terms_version_mismatch"
    default_message = (
        "The Terms have changed since you opened this page. Refresh and read the latest version."
    )


class TermsNotAccepted(Conflict):
    """The user has not accepted the current Terms, which this action requires."""

    code = "terms_not_accepted"
    default_message = "Please read and accept our updated Terms of Service to continue."
