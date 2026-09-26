"""Password hashing and refresh-token minting (copied in shape from OSCE `identity/tokens.py`).

Nothing here touches the database; it is the cryptographic plumbing the
services compose. The one deviation from OSCE is `verify_password` also
accepting the bcrypt hashes imported from Supabase Auth (ADR 0003): a match
reports `needs_rehash`, and the sign-in stores an argon2 hash in its place.
"""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.features.identity.domain_accounts import new_one_click_token

_hasher = PasswordHasher()

# Supabase Auth stored bcrypt (`$2a$…`/`$2b$…`). Delete this prefix and the bcrypt
# branch once no open account still has one (ADR 0003 has the query).
_IMPORTED_BCRYPT_PREFIX = "$2"


def hash_password(raw_password: str) -> str:
    """An argon2 hash of the password exactly as typed (never stripped)."""
    return _hasher.hash(raw_password)


def _verify_imported_bcrypt(password_hash: str, raw_password: str) -> bool:
    """Check a password against a bcrypt hash imported from Supabase Auth."""
    import bcrypt  # noqa: PLC0415 - only reached for the shrinking set of imported hashes

    try:
        return bcrypt.checkpw(raw_password.encode(), password_hash.encode())
    except ValueError:
        # bcrypt refuses passwords over 72 bytes and malformed hashes; neither is a match.
        return False


def verify_password(password_hash: str | None, raw_password: str) -> bool:
    """Whether this password matches the stored hash.

    Refuses (returns False) rather than raises for a missing hash, a wrong
    password or an unreadable hash: each is simply not a match.
    """
    if not password_hash:
        return False
    if password_hash.startswith(_IMPORTED_BCRYPT_PREFIX):
        return _verify_imported_bcrypt(password_hash, raw_password)
    try:
        return _hasher.verify(password_hash, raw_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """True for an imported bcrypt hash, or an argon2 hash made with older settings."""
    if password_hash.startswith(_IMPORTED_BCRYPT_PREFIX):
        return True
    return _hasher.check_needs_rehash(password_hash)


# A hash to verify against when the address is unknown, so a miss costs the
# same argon2 work as a hit. Without it, sign-in answers in microseconds for an
# address that does not exist and tens of milliseconds for one that does: an
# account-enumeration oracle behind an identical error message.
_ABSENT_ACCOUNT_HASH = _hasher.hash("password-for-an-account-that-does-not-exist")


def verify_absent_password(raw_password: str) -> None:
    """Spend the argon2 time a real account's check would take, for an unknown address."""
    verify_password(_ABSENT_ACCOUNT_HASH, raw_password)


def new_refresh_token() -> tuple[str, str]:
    """A fresh random refresh token and the SHA-256 of it that alone reaches storage.

    SHA-256 rather than argon2 because the token already has full entropy;
    there is nothing to slow down. The same recipe as the one-click email links.
    """
    return new_one_click_token()
