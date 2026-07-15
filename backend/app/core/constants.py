"""Shared constants (not secrets — those stay in env / Settings)."""

# Auth cookies
ACCESS_COOKIE_NAME = "eventtz_access_token"
REFRESH_COOKIE_NAME = "eventtz_refresh_token"

# Platform fee on client total (line items + discounts; surcharges excluded).
BOOKING_SERVICE_FEE_PERCENT = 5.0

# OpenAI models (product defaults — change in code when upgrading).
OPENAI_BIO_MODEL = "gpt-4o-mini"
OPENAI_VISION_MODEL = "gpt-4o-mini"
OPENAI_SEARCH_MODEL = "gpt-4o-mini"
