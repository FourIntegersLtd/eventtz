"""User-facing auth copy for API responses and HTTP errors."""

from __future__ import annotations

# --- Email verification ---

GENERIC_RESEND_MESSAGE = (
    "If an account exists for that email and still needs verification, "
    "we sent a new link. Check your inbox (and spam) for an email from Eventtz."
)
SIGNUP_VERIFY_MESSAGE = "Account created."
UNVERIFIED_LOGIN_DETAIL = (
    "Verify your email before signing in. Check your inbox for the link we sent, "
    "or request a new one."
)
VERIFICATION_EMAIL_RATE_LIMIT = "Too many verification emails. Try again later."
VERIFY_RATE_LIMIT = "Too many attempts. Try again later."
VERIFICATION_LINK_INVALID = (
    "This verification link is invalid or has expired. Request a new one."
)
VERIFY_EMAIL_FAILED = "Could not verify email. Try again."
EMAIL_VERIFIED_SIGNED_IN = "Email verified. You're signed in."
EMAIL_VERIFIED_SIGN_IN = "Email verified. You can sign in now."

# --- Password reset / change ---

GENERIC_FORGOT_MESSAGE = (
    "If an account exists for that email, we sent a link to reset your password. "
    "Check your inbox (and spam) for an email from Eventtz."
)
RESET_REQUEST_RATE_LIMIT = "Too many reset requests. Try again later."
RESET_LINK_INVALID = "This reset link is invalid or has expired. Request a new one."
RESET_LINK_USED = "This reset link has already been used. Request a new one."
UPDATE_PASSWORD_FAILED = "Could not update password. Try again."
PASSWORD_UPDATED_SIGN_IN_MANUAL = (
    "Password updated, but we couldn't sign you in automatically. "
    "Please sign in with your new password."
)
PASSWORD_MUST_DIFFER = "Choose a new password that is different from your current one."
CURRENT_PASSWORD_INCORRECT = "Current password is incorrect."
PASSWORD_UPDATED_REAUTH = "Password updated. Sign in again with your new password."

# --- Password policy ---

PASSWORD_MIN_LENGTH = "Password must be at least {min_length} characters."
ADMIN_PASSWORD_MIN_LENGTH = "Admin password must be at least {min_length} characters."
ADMIN_PASSWORD_UPPERCASE = "Admin password must include an uppercase letter."
ADMIN_PASSWORD_NUMBER = "Admin password must include a number."
ADMIN_PASSWORD_SYMBOL = "Admin password must include a symbol."


def password_min_length_detail(min_length: int) -> str:
    return PASSWORD_MIN_LENGTH.format(min_length=min_length)


def admin_password_min_length_detail(min_length: int) -> str:
    return ADMIN_PASSWORD_MIN_LENGTH.format(min_length=min_length)


# --- Session ---

SIGN_IN_REQUIRED = "Please sign in to continue."
SESSION_EXPIRED = "Session expired. Please sign in again."
REFRESH_SESSION_EXPIRED = "Your session has expired. Please sign in again."
REFRESH_SIGN_IN_AGAIN = "Please sign in again."
AUTH_UPSTREAM_UNAVAILABLE = (
    "We couldn't reach the sign-in service. Please try again."
)

# --- Signup / signin / signout ---

EMAIL_ALREADY_REGISTERED = "That email is already registered. Try signing in."
SIGNUP_FAILED = "We couldn't create your account. Please try again."
SIGNUP_EMAIL_EXISTS = (
    "An account with this email already exists. "
    "Try signing in instead, or use Forgot password to set a new one."
)
SIGNUP_CONFIRM_EMAIL = "Account created. Please check your email for confirmation."
LOGIN_CREDENTIALS_MISMATCH = (
    "We couldn't sign you in with those details. Check your email and password, then try again."
)
LOGIN_CREDENTIALS_REREGISTER = (
    "We couldn't sign you in with those details. "
    "If you recently registered again with this email, use the password "
    "from your first sign-up, or reset your password."
)
EMAIL_NOT_CONFIRMED_SUPABASE = (
    "Confirm your email before signing in. Check your inbox for the verification link."
)
SIGN_IN_UNAVAILABLE = "We couldn't sign you in right now. Please try again."
SIGNOUT_FAILED = "We couldn't sign you out. Please try again."

# --- Account status ---

ACCOUNT_SUSPENDED = "This account is suspended."
ACCOUNT_SUSPENDED_CONTACT = (
    "Your account has been suspended. "
    "Contact support if you think this is a mistake."
)
ACCOUNT_DELETED = "This account has been deleted."
ACCOUNT_DELETED_SIGNIN = (
    "This account has been deleted. You can create a new account with the same email."
)
ADMIN_ACCOUNT_SUSPENDED_SIGNIN = (
    "This account is suspended. Contact a super admin if you need access."
)
ADMIN_ACCOUNT_SUSPENDED = "Your admin account is suspended. Contact a super admin."

# --- Rate limits ---

SIGN_IN_RATE_LIMIT = "Too many sign-in attempts. Try again in a few minutes."
CHANGE_PASSWORD_RATE_LIMIT = "Too many password change attempts. Try again later."

# --- Role guards ---

ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. "
    "If you're a vendor or client, use the matching sign-in page."
)
SUPER_ADMIN_ONLY = "Only super admins can perform this action."
VENDOR_PORTAL_FORBIDDEN = (
    "This page is for vendor accounts. "
    "If you offer services on Eventtz, create a vendor account or sign out and sign in again "
    "so we can refresh your account type. "
    "If you're planning an event, use client sign-in instead."
)
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. "
    "Sign in with a client account, or create one from the homepage."
)
