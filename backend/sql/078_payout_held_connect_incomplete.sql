-- Dedicated in-app kind when both parties confirmed but Connect cannot receive a Transfer yet.

ALTER TABLE public.booking_notifications DROP CONSTRAINT IF EXISTS booking_notifications_kind_check;
ALTER TABLE public.booking_notifications ADD CONSTRAINT booking_notifications_kind_check
  CHECK (kind IN (
    'booking_accepted',
    'booking_completed',
    'booking_declined_by_vendor',
    'booking_request_received',
    'booking_request_sent',
    'booking_cancelled_by_client',
    'booking_cancelled_by_vendor',
    'booking_pricing_updated',
    'client_confirmed_updated_price',
    'client_declined_updated_price',
    'vendor_quote_received',
    'vendor_quote_accepted',
    'vendor_quote_declined',
    'vendor_quote_withdrawn',
    'payment_received',
    'vendor_payment_received',
    'vendor_payout_released',
    'payment_refunded',
    'completion_confirmed_awaiting_other_party',
    'completion_reminder',
    'vendor_completion_reminder',
    'enquiry_reminder_1h',
    'enquiry_reminder_6h',
    'enquiry_reminder_24h',
    'client_vendor_no_response',
    'event_tomorrow',
    'vendor_event_tomorrow',
    'pay_to_confirm',
    'payout_held_connect_incomplete'
  ));
