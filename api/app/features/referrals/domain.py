"""Referral rules: creator slugs and links, vendor client codes, and fee-discount tiers. Pure.

Two programmes live here:

- **Creator partners.** Staff create a partner (an influencer) with a slug; the partner
  shares `/vendor/register?ref=<slug>` and vendors who sign up through it are attributed
  to them, so staff can track who owes a shout-out.
- **Vendor client codes.** An approved vendor owns one numeric code (1-6 digits) and shares
  `/client/browse/<vendor>?vref=<code>`. A client who books with it gets money off the
  Eventtz service fee (never the vendor's portion), in tiers by how much they spend.
"""

from __future__ import annotations

import re
import secrets
import unicodedata
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

from app.core.site import public_url

# --- creator partner slugs --------------------------------------------------------------------

# What a slug becomes when nothing usable is left after cleaning.
DEFAULT_SLUG = "creator"
# Lower-case letters and digits in groups joined by single dashes: `sunny-cakes-2`.
_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
# The admin sign-up list can show everyone, only those awaiting a shout-out, or only those done.
ShoutoutFilter = Literal["all", "pending", "completed"]


def normalise_slug(raw: str) -> str:
    """Clean text into slug form: accents dropped, lower-cased, punctuation removed, spaces to dashes.

    `Café X!!` gives `cafe-x`; text with nothing usable gives `creator`. Underscores survive
    (the baseline keeps `\\w`), which is why the result must still pass `is_valid_slug`.
    """
    ascii_text = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")
    without_punctuation = re.sub(r"[^\w\s-]", "", ascii_text.lower())
    return re.sub(r"[-\s]+", "-", without_punctuation).strip("-") or DEFAULT_SLUG


def is_valid_slug(slug: str) -> bool:
    """True for slugs made of lower-case letters and digits joined by single dashes."""
    return bool(_SLUG_PATTERN.fullmatch(slug))


def slug_base(*, display_name: str, chosen_slug: str | None) -> str:
    """The slug staff asked for (cleaned), or one made from the partner's name when they left it blank."""
    source = chosen_slug.strip() if chosen_slug and chosen_slug.strip() else display_name.strip()
    return normalise_slug(source)


def first_free_slug(base: str, taken_slugs: set[str]) -> str:
    """`base` if nobody has it, else the first free `base-2`, `base-3`, ..."""
    candidate = base
    suffix = 2
    while candidate in taken_slugs:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def partner_register_link(slug: str) -> str:
    """The vendor sign-up link a creator partner shares."""
    return public_url(f"/vendor/register?ref={slug.strip()}")


def vendor_explore_path(user_id: str) -> str:
    """The web path of a vendor's public profile, which staff open from the sign-up list."""
    return f"/client/browse/{user_id}"


# --- vendor client codes ----------------------------------------------------------------------

# Client codes are numeric and short enough to read out over the phone.
CLIENT_CODE_MAX_DIGITS = 6
# A vendor's stored discount only counts on bookings in these payment states (the snapshot is final).
PAID_STATUSES = frozenset({"paid", "payout_released", "refunded", "partially_refunded"})


def normalise_client_code(raw: object) -> str | None:
    """The digits of a typed code (`12-34` gives `1234`), or `None` when there are none or more than six."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw).strip())
    if not digits or len(digits) > CLIENT_CODE_MAX_DIGITS:
        return None
    return digits


def random_client_code() -> str:
    """A random six-digit code (leading zeros kept) for a vendor who did not choose one."""
    return f"{secrets.randbelow(10**CLIENT_CODE_MAX_DIGITS):0{CLIENT_CODE_MAX_DIGITS}d}"


def client_share_link(vendor_user_id: str, code: str) -> str:
    """The browse link a vendor shares with clients; the web app applies the code on booking."""
    return public_url(f"/client/browse/{vendor_user_id.strip()}?vref={code.strip()}")


def looks_like_uuid(value: str) -> bool:
    """True when `value` parses as a UUID, so ids from the URL can be checked before querying."""
    try:
        uuid.UUID(value)
    except ValueError:
        return False
    return True


# --- fee-discount tiers -----------------------------------------------------------------------


@dataclass(frozen=True)
class FeeTier:
    """Spend at least `min_spend_gbp` with the vendor and get `fee_discount_gbp` off the service fee."""

    min_spend_gbp: float
    fee_discount_gbp: float


# Best tier first: the first one a spend reaches is the one that applies.
FEE_TIERS: tuple[FeeTier, ...] = (
    FeeTier(min_spend_gbp=600.0, fee_discount_gbp=15.0),
    FeeTier(min_spend_gbp=400.0, fee_discount_gbp=10.0),
)


def qualifying_tier(vendor_portion_gbp: float) -> FeeTier | None:
    """The best tier a spend reaches, or `None` below the lowest one."""
    spend = max(0.0, float(vendor_portion_gbp or 0))
    for tier in FEE_TIERS:
        if spend >= tier.min_spend_gbp:
            return tier
    return None


def discount_for_spend(vendor_portion_gbp: float) -> float:
    """How much comes off the service fee for this spend (0 below the lowest tier)."""
    tier = qualifying_tier(vendor_portion_gbp)
    return tier.fee_discount_gbp if tier else 0.0


def tier_min_spend(vendor_portion_gbp: float) -> float | None:
    """The minimum spend of the tier this spend reaches, or `None`."""
    tier = qualifying_tier(vendor_portion_gbp)
    return tier.min_spend_gbp if tier else None


def discount_and_tier(vendor_portion_gbp: float) -> tuple[float, float | None]:
    """The fee discount for a spend and its tier's minimum (`None` when there is no discount)."""
    discount = discount_for_spend(vendor_portion_gbp)
    return discount, (tier_min_spend(vendor_portion_gbp) if discount > 0 else None)


def stored_code_discount(
    *,
    stored_code: object,
    booking_vendor_id: str | None,
    code_owners: Mapping[str, str],
    vendor_portion_gbp: float,
) -> tuple[float, float | None]:
    """The discount a booking earns from the code stored on it, and its tier minimum.

    The code was validated when the booking was made, so afterwards the stored code is
    trusted even if the vendor later disables it or it stops belonging to anyone. The
    one exception is a code proven to belong to a *different* vendor, which earns nothing.
    `code_owners` maps codes (normalised) to the vendor that owns them today.
    """
    code = normalise_client_code(stored_code)
    if not code:
        return 0.0, None
    booking_vendor = (booking_vendor_id or "").strip()
    owner = code_owners.get(code, "").strip()
    if booking_vendor and owner and owner != booking_vendor:
        return 0.0, None
    return discount_and_tier(vendor_portion_gbp)
