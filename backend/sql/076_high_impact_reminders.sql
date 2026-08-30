-- One-shot lifecycle reminders: event tomorrow, pay-to-confirm, payouts setup.

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS event_tomorrow_reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS pay_to_confirm_reminded_at timestamptz;

COMMENT ON COLUMN public.booking_requests.event_tomorrow_reminded_at IS
  'When the day-before event reminder was sent to client and vendor.';
COMMENT ON COLUMN public.booking_requests.pay_to_confirm_reminded_at IS
  'When the client was reminded to pay after the vendor accepted.';

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS payouts_setup_nudge_at timestamptz;

COMMENT ON COLUMN public.vendors.approved_at IS
  'When approval_status last became approved (for the 24h payouts-setup nudge).';
COMMENT ON COLUMN public.vendors.payouts_setup_nudge_at IS
  'When the automatic payouts-setup email was sent.';

UPDATE public.vendors
SET approved_at = COALESCE(approved_at, updated_at, created_at)
WHERE approval_status = 'approved'
  AND approved_at IS NULL;

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
    'pay_to_confirm'
  ));
