"""User-facing vendor copy for API responses and HTTP errors."""

from __future__ import annotations

# --- Business name ---

BUSINESS_NAME_ALREADY_REGISTERED = "This business name is already registered."

# --- Explore / public vendor lookup ---

VENDOR_NOT_FOUND_INVALID_ID = "We couldn't find that vendor."
VENDOR_NOT_FOUND_OR_NOT_LISTED = "Vendor not found or not listed."

# --- List pricing / booking line items ---

SELECT_PACKAGE_OR_RATE = "Select at least one package or rate."
DUPLICATE_PACKAGE_OR_RATE = "Duplicate package or rate selected."
PACKAGES_NO_LONGER_AVAILABLE = "One or more selected packages or rates are no longer available."
NO_PUBLISHED_PRICES = "This vendor has no published prices for your selection."
QUOTE_ONLY_NO_PRICED_OPTIONS = (
    "This vendor only accepts quote requests - no priced options to select."
)

# --- Event date availability ---

EVENT_END_BEFORE_START = "Event end date must be on or after the event start date."
EVENT_DATES_VENDOR_UNAVAILABLE = (
    "The event date(s) fall on days this vendor has marked unavailable. "
    "Choose different dates or contact the vendor via Messages."
)


def event_cannot_span_more_than_days(max_days: int) -> str:
    return f"Event cannot span more than {max_days} days."


# --- Onboarding AI ---

AI_BIO_GENERATION_FAILED = "AI bio generation failed. Try again in a moment."
AI_BIO_EMPTY = "We couldn't write a bio this time. Please try again."
CHOOSE_IMAGE_TO_UPLOAD = "Please choose an image to upload."
ONLY_IMAGE_UPLOADS = "Only image uploads are supported."
COULD_NOT_ANALYSE_IMAGE = "Could not analyse this image. Try again."
PACKAGE_REVIEW_FAILED = "Package review failed. Try again in a moment."
COULD_NOT_READ_PACKAGE_SUGGESTIONS = "Could not read package suggestions. Try again."

# --- Package quality ---

PACKAGE_NEEDS_CLEAR_NAME = "Step pricing: each package needs a clear name."
PACKAGE_NEEDS_PRICE = "Step pricing: each package needs a price."
PACKAGE_DETAILS_TOO_SHORT = (
    "Step pricing: tell clients what's included (at least a short sentence)."
)
PROFILE_PHOTO_BEFORE_SUBMIT = "Add a profile photo before submitting."


def complete_package_for_labels(labels: str) -> str:
    return f"Step pricing: add at least one complete package for {labels}."


# --- Profile form validation (onboarding steps) ---

STEP_LOCATION_SUPPORTED_COUNTRY = "Step location: select a supported country."
STEP_LOCATION_BASE_CITY_REQUIRED = "Step location: base city is required."
STEP_LOCATION_DELIVERY_OPTION = "Step location: pick at least one delivery option."
STEP_LOCATION_TRAVEL_RADIUS = "Step location: select how far you travel."
STEP_LOCATION_TRAVEL_POLICY = "Step location: select a travel / delivery policy."
STEP_LOCATION_CUSTOM_TRAVEL_RULE = (
    "Step location: describe your custom travel / delivery rule."
)
STEP_PRICING_DISCOUNT_NAME_REQUIRED = "Step pricing: discount name is required."
STEP_PRICING_DISCOUNT_OPTION_REQUIRED = (
    "Step pricing: select at least one discount option."
)
STEP_PRICING_BULK_DISCOUNT_THRESHOLD_AND_PCT = (
    "Step pricing: bulk discount needs both a threshold and a percentage."
)
STEP_ACCOUNT_FIRST_NAME_REQUIRED = "Step account: first name is required."
STEP_ACCOUNT_LAST_NAME_REQUIRED = "Step account: last name is required."
STEP_ACCOUNT_PHONE_REQUIRED = "Step account: phone number is required."
STEP_ACCOUNT_PHONE_INVALID = (
    "Step account: enter a valid phone number (e.g. 07xxx xxxxxx or +44 7xxx xxxxxx)."
)
STEP_PRICING_RATE_OR_PACKAGE = "Step pricing: add at least one rate or a package price."
STEP_AVAILABILITY_WEEKDAY = "Step availability: pick at least one weekday."
STEP_AVAILABILITY_MAX_BOOKINGS_MIN = "Step availability: set max bookings per day (min 1)."
BUSINESS_NAME_REQUIRED_BEFORE_SUBMIT = "Business name is required before submit."
BASE_CITY_REQUIRED_BEFORE_SUBMIT = "Base city is required before submit."
SELECT_SERVICE_BEFORE_SUBMIT = "Select at least one service before submit."
INVALID_SERVICE_OFFERED = "Select a valid service category before submit."


def step_pricing_label_valid_number(label: str) -> str:
    return f"Step pricing: {label} must be a valid number."


def step_pricing_label_between_pct(label: str) -> str:
    return f"Step pricing: {label} must be between 0 and 100%."


def step_pricing_label_required(label: str) -> str:
    return f"Step pricing: {label} is required."


def step_pricing_label_valid_amount(label: str) -> str:
    return f"Step pricing: {label} must be a valid amount."


def step_pricing_label_min_gbp(label: str, min_gbp: float) -> str:
    return f"Step pricing: {label} must be at least £{min_gbp:.2f}."


def step_pricing_label_out_of_range(label: str) -> str:
    return f"Step pricing: {label} is out of allowed range."


def step_availability_max_bookings_range(min_val: int, max_val: int) -> str:
    return (
        f"Step availability: max bookings per day must be "
        f"{min_val}-{max_val}."
    )


def step_portfolio_min_images_required(min_images: int) -> str:
    return f"Step portfolio: at least {min_images} images required."


def step_portfolio_max_images(max_images: int) -> str:
    return f"Step portfolio: maximum {max_images} images."


# --- Moderation (admin) ---

ONLY_SUBMITTED_PROFILES_TO_DRAFT = "Only submitted profiles can be returned to draft."
ONLY_PENDING_VENDORS_TO_DRAFT = "Only pending vendors can be returned to draft."
APPROVAL_STATUS_INVALID = "approval_status must be pending, approved, or banned"
LISTING_OVERRIDE_INVALID = "listing_override must be auto, visible, or hidden"
LISTING_OVERRIDE_REASON_REQUIRED = "Give a reason when overriding a vendor's listing."
LISTING_MEDIA_URL_INVALID = (
    "Listing media overrides must use the vendor profile photo or portfolio images."
)
VENDOR_PROFILE_NOT_FOUND = "Vendor profile not found."
EMAIL_COULD_NOT_BE_SENT = "Email could not be sent."
NO_EMAIL_ON_FILE = "No email address on file."
PAYOUT_NUDGE_NOT_ELIGIBLE = "Not approved or payouts already set up."

# --- Public metrics ---

MOST_VENDORS_REPLY_WITHIN_DAY = "Most vendors reply within a day."


def usually_replies(within: str) -> str:
    return f"Usually replies {within}."
