/**
 * Named Mixpanel product events. Prefer these over raw strings at call sites.
 * Fire after successful API (or intentional UI funnel steps like CTA / modal open).
 * Never include emails, message bodies, tokens, or passwords in properties.
 */

import {
  trackMixpanelEvent,
  type MixpanelProperties,
} from "@/lib/mixpanelClient";

export const MixpanelEvents = {
  // Auto
  page_viewed: "page_viewed",

  // Auth (success also fired from AuthProvider)
  user_signed_in: "user_signed_in",
  user_signed_up: "user_signed_up",
  user_signed_out: "user_signed_out",
  login_failed: "login_failed",
  register_failed: "register_failed",
  password_reset_requested: "password_reset_requested",
  password_reset_completed: "password_reset_completed",
  password_changed: "password_changed",
  client_onboarding_completed: "client_onboarding_completed",
  client_onboarding_dismissed: "client_onboarding_dismissed",

  // Landing / browse
  landing_cta_clicked: "landing_cta_clicked",
  landing_category_clicked: "landing_category_clicked",
  landing_featured_vendor_clicked: "landing_featured_vendor_clicked",
  marketplace_search_submitted: "marketplace_search_submitted",
  marketplace_filters_applied: "marketplace_filters_applied",
  marketplace_results_viewed: "marketplace_results_viewed",
  marketplace_vendor_clicked: "marketplace_vendor_clicked",
  vendor_favorited: "vendor_favorited",
  vendor_unfavorited: "vendor_unfavorited",
  multi_enquire_opened: "multi_enquire_opened",
  vendor_profile_viewed: "vendor_profile_viewed",

  // Enquiry
  enquiry_started: "enquiry_started",
  enquiry_created: "enquiry_created",
  enquiry_failed: "enquiry_failed",
  multi_enquiry_created: "multi_enquiry_created",

  // Client bookings / pay
  booking_detail_viewed: "booking_detail_viewed",
  booking_cancelled: "booking_cancelled",
  booking_quote_accepted: "booking_quote_accepted",
  booking_quote_declined: "booking_quote_declined",
  booking_price_update_accepted: "booking_price_update_accepted",
  booking_price_update_declined: "booking_price_update_declined",
  booking_completed: "booking_completed",
  booking_payment_succeeded: "booking_payment_succeeded",
  booking_payment_cancelled: "booking_payment_cancelled",
  booking_checkout_started: "booking_checkout_started",
  booking_checkout_failed: "booking_checkout_failed",

  // Trust
  dispute_opened: "dispute_opened",
  dispute_detail_viewed: "dispute_detail_viewed",
  review_submitted: "review_submitted",

  // Chat
  chat_conversation_started: "chat_conversation_started",
  chat_message_sent: "chat_message_sent",

  // Client home / support
  client_dashboard_viewed: "client_dashboard_viewed",
  dashboard_attention_clicked: "dashboard_attention_clicked",
  contact_form_submitted: "contact_form_submitted",

  // Vendor
  vendor_onboarding_submitted: "vendor_onboarding_submitted",
  vendor_profile_saved: "vendor_profile_saved",
  vendor_booking_accepted: "vendor_booking_accepted",
  vendor_booking_declined: "vendor_booking_declined",
  vendor_booking_price_updated: "vendor_booking_price_updated",
  vendor_booking_completed: "vendor_booking_completed",
  vendor_booking_cancelled: "vendor_booking_cancelled",
  vendor_quote_withdrawn: "vendor_quote_withdrawn",
  vendor_payout_setup_started: "vendor_payout_setup_started",
  vendor_payouts_ready: "vendor_payouts_ready",
  vendor_quote_sent: "vendor_quote_sent",

  // Admin
  admin_vendor_approval_set: "admin_vendor_approval_set",
  admin_dispute_status_changed: "admin_dispute_status_changed",
  admin_dispute_resolved: "admin_dispute_resolved",
} as const;

export type MixpanelEventName = (typeof MixpanelEvents)[keyof typeof MixpanelEvents];

/** Track a catalogued product event. */
export function track(
  event: MixpanelEventName,
  properties?: MixpanelProperties,
): void {
  trackMixpanelEvent(event, properties);
}
