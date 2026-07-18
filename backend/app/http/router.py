"""Registers every `/api/v1` route from feature packages."""

from fastapi import APIRouter

from app.features.admin.http import email as admin_email
from app.features.admin.http import messages as admin_messages
from app.features.admin.http import platform as admin_platform
from app.features.admin.http import vendors as admin_vendors
from app.features.auth.http import routes as auth
from app.features.blog.http import admin as admin_blog
from app.features.blog.http import public as public_blog
from app.features.bookings.http import client as client_booking_requests
from app.features.bookings.http import vendor as vendor_bookings
from app.features.favorites.http import client as client_favorites
from app.features.contact.http.routes import client_router as contact_client_router
from app.features.contact.http.routes import vendor_router as contact_vendor_router
from app.features.chat.http import routes as chat
from app.features.geo.http import routes as client_geo
from app.features.media.http import routes as media
from app.features.notifications.http import client as client_notifications
from app.features.notifications.http import vendor as vendor_notifications
from app.features.payments.http import vendor as vendor_payments
from app.features.payments.http import webhooks as stripe_webhooks
from app.features.realtime.http import routes as realtime
from app.features.settings.http import client_onboarding as client_onboarding_settings
from app.features.settings.http import routes as user_settings
from app.features.vendors.http import explore as vendors_explore
from app.features.vendors.http import onboarding_ai as vendor_onboarding_ai
from app.features.vendors.http import profile as vendor_profile
from app.features.vendors.http import analytics as vendor_analytics

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(client_favorites.router)
api_router.include_router(contact_client_router)
api_router.include_router(contact_vendor_router)
api_router.include_router(chat.router)
api_router.include_router(user_settings.router)
api_router.include_router(client_onboarding_settings.router)
api_router.include_router(vendor_profile.router)
api_router.include_router(vendor_onboarding_ai.router)
api_router.include_router(vendor_analytics.router)
api_router.include_router(vendor_bookings.router)
api_router.include_router(admin_vendors.router)
api_router.include_router(admin_platform.router)
api_router.include_router(admin_email.router)
api_router.include_router(admin_messages.router)
api_router.include_router(admin_blog.router)
api_router.include_router(public_blog.router)
api_router.include_router(vendors_explore.router)
api_router.include_router(client_booking_requests.router)
api_router.include_router(client_geo.router)
api_router.include_router(client_notifications.router)
api_router.include_router(vendor_notifications.router)
api_router.include_router(vendor_payments.router)
api_router.include_router(media.router)
api_router.include_router(realtime.router)
api_router.include_router(stripe_webhooks.router)
