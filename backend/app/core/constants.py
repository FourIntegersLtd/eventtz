"""Fixed values shared across the app (not secrets - those go in env / Settings)."""

# Cookie names for stay-signed-in.
ACCESS_COOKIE_NAME = "eventtz_access_token"
REFRESH_COOKIE_NAME = "eventtz_refresh_token"

# Platform fee taken from the client's total (full vendor portion including adjustments).
BOOKING_SERVICE_FEE_PERCENT = 5.0

# Vendor client referral codes (?vref=): numeric, 1–6 digits.
CLIENT_REFERRAL_CODE_MAX_LEN = 6

# Which AI models we use by default (change here when upgrading).
OPENAI_BIO_MODEL = "gpt-4o-mini"
OPENAI_VISION_MODEL = "gpt-4o-mini"
OPENAI_SEARCH_MODEL = "gpt-4o-mini"
OPENAI_HELP_MODEL = "gpt-4o-mini"
OPENAI_PLANNER_MODEL = "gpt-4o-mini"
OPENAI_COPILOT_MODEL = "gpt-4o-mini"
OPENAI_CONTACT_MODEL = "gpt-4o-mini"
