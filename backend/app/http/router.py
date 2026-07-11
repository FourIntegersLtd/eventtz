"""Aggregates all `/api/v1` route modules from feature packages."""

from fastapi import APIRouter

from app.features.admin.http import platform as admin_platform
from app.features.admin.http import vendors as admin_vendors
from app.features.auth.http import routes as auth
from app.features.bookings.http import client as client_booking_requests
from app.features.bookings.http import vendor as vendor_bookings
from app.features.chat.http import routes as chat
from app.features.geo.http import routes as client_geo
from app.features.media.http import routes as media
from app.features.notifications.http import client as client_notifications
from app.features.notifications.http import vendor as vendor_notifications
from app.features.payments.http import vendor as vendor_payments
from app.features.payments.http import webhooks as stripe_webhooks
from app.features.realtime.http import routes as realtime
from app.features.settings.http import routes as user_settings
from app.features.vendors.http import explore as vendors_explore
from app.features.vendors.http import onboarding_ai as vendor_onboarding_ai
from app.features.vendors.http import profile as vendor_profile

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(chat.router)
api_router.include_router(user_settings.router)
api_router.include_router(vendor_profile.router)
api_router.include_router(vendor_onboarding_ai.router)
api_router.include_router(vendor_bookings.router)
api_router.include_router(admin_vendors.router)
api_router.include_router(admin_platform.router)
api_router.include_router(vendors_explore.router)
api_router.include_router(client_booking_requests.router)
api_router.include_router(client_geo.router)
api_router.include_router(client_notifications.router)
api_router.include_router(vendor_notifications.router)
api_router.include_router(vendor_payments.router)
api_router.include_router(media.router)
api_router.include_router(realtime.router)
api_router.include_router(stripe_webhooks.router)
