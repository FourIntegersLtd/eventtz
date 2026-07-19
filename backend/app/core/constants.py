"""Fixed values shared across the app (not secrets — those go in env / Settings)."""

# Cookie names for stay-signed-in.
ACCESS_COOKIE_NAME = "eventtz_access_token"
REFRESH_COOKIE_NAME = "eventtz_refresh_token"

# Platform fee taken from the client's total (packages + discounts; extra costs don't add fee).
BOOKING_SERVICE_FEE_PERCENT = 5.0

# Which AI models we use by default (change here when upgrading).
OPENAI_BIO_MODEL = "gpt-4o-mini"
OPENAI_VISION_MODEL = "gpt-4o-mini"
OPENAI_SEARCH_MODEL = "gpt-4o-mini"
OPENAI_HELP_MODEL = "gpt-4o-mini"
OPENAI_PLANNER_MODEL = "gpt-4o-mini"
