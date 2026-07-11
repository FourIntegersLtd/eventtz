"""Admin console services: dashboard, bookings, financials, clients, disputes, reviews, chat."""

from app.features.admin.booking_ops import (
    get_booking_detail_for_admin,
    list_bookings_for_admin,
    patch_booking_payment_fields,
)
from app.features.admin.chat_lookup import (
    get_conversation_admin_meta,
    get_conversation_messages_admin,
)
from app.features.admin.client_ops import list_clients_for_admin, set_client_suspended
from app.features.admin.dashboard_metrics import get_admin_dashboard_metrics
from app.features.admin.dashboard_queries import (
    financials_export_csv_bytes,
    get_admin_dashboard_summary,
    get_financials_summary,
)
from app.features.admin.dispute_ops import (
    create_dispute_case,
    enrich_dispute_row,
    list_disputes_for_admin,
    patch_dispute_case,
)
from app.features.admin.review_ops import list_reviews_for_admin, set_review_hidden

__all__ = [
    "create_dispute_case",
    "financials_export_csv_bytes",
    "get_admin_dashboard_metrics",
    "get_admin_dashboard_summary",
    "get_booking_detail_for_admin",
    "get_conversation_admin_meta",
    "get_conversation_messages_admin",
    "get_financials_summary",
    "list_bookings_for_admin",
    "list_clients_for_admin",
    "list_disputes_for_admin",
    "list_reviews_for_admin",
    "patch_booking_payment_fields",
    "enrich_dispute_row",
    "patch_dispute_case",
    "set_client_suspended",
    "set_review_hidden",
]
