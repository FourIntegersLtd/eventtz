-- Enquiry response friction: timed vendor reminders, client 24h nudge, search context.

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS enquiry_reminder_1h_at timestamptz,
  ADD COLUMN IF NOT EXISTS enquiry_reminder_6h_at timestamptz,
  ADD COLUMN IF NOT EXISTS enquiry_reminder_24h_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_no_response_nudge_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_search_context jsonb;

COMMENT ON COLUMN public.booking_requests.enquiry_reminder_1h_at IS
  'When the 1h vendor reply reminder was sent (pending client-initiated enquiries).';
COMMENT ON COLUMN public.booking_requests.enquiry_reminder_6h_at IS
  'When the 6h vendor reply reminder was sent.';
COMMENT ON COLUMN public.booking_requests.enquiry_reminder_24h_at IS
  'When the 24h vendor reply reminder was sent.';
COMMENT ON COLUMN public.booking_requests.client_no_response_nudge_at IS
  'When the client received the 24h “try other vendors” email/notification.';
COMMENT ON COLUMN public.booking_requests.client_search_context IS
  'Marketplace search filters at enquire time (types, location, dates, q, country) for alternative suggestions.';

CREATE INDEX IF NOT EXISTS idx_booking_requests_enquiry_reminders_pending
  ON public.booking_requests (created_at)
  WHERE status = 'pending'
    AND initiator = 'client'
    AND vendor_first_response_at IS NULL;

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
    'client_vendor_no_response'
  ));

ALTER TABLE public.marketplace_events DROP CONSTRAINT IF EXISTS marketplace_events_event_name_check;
ALTER TABLE public.marketplace_events ADD CONSTRAINT marketplace_events_event_name_check
  CHECK (event_name IN (
    'vendor_profile_viewed',
    'enquiry_created',
    'vendor_notified',
    'vendor_message_sent',
    'vendor_accepted_booking',
    'vendor_declined_booking',
    'customer_started_payment',
    'customer_payment_completed',
    'booking_completed',
    'booking_cancelled',
    'review_submitted',
    'enquiry_unfulfilled',
    'enquiry_vendor_reminded',
    'enquiry_client_no_response_nudge',
    'enquiry_multi_created'
  ));
