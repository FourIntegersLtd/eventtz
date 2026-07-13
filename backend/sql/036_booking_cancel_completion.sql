-- Cancellation audit + completion auto-release/reminder tracking.
-- Cancelling a paid booking now issues a full Stripe refund first (see
-- app/features/bookings/payments.py refund_booking_on_cancel), and vendor
-- payout auto-releases 48h after the event when paid and no dispute is open.
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_auto_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_reminder_sent_at timestamptz;

ALTER TABLE public.booking_requests DROP CONSTRAINT IF EXISTS booking_requests_cancelled_by_check;
ALTER TABLE public.booking_requests ADD CONSTRAINT booking_requests_cancelled_by_check
  CHECK (cancelled_by IS NULL OR cancelled_by IN ('client', 'vendor'));

COMMENT ON COLUMN public.booking_requests.cancelled_by IS
  'Who cancelled the booking (client or vendor). Null unless status = cancelled.';
COMMENT ON COLUMN public.booking_requests.cancelled_at IS
  'When the booking was cancelled.';
COMMENT ON COLUMN public.booking_requests.payout_auto_released_at IS
  'Set when the vendor payout was released automatically 48h after the event (no mutual confirmation).';
COMMENT ON COLUMN public.booking_requests.completion_reminder_sent_at IS
  'Set once the post-event confirm-completion reminder batch has been sent for this booking (dedupe).';

-- The hourly maintenance job scans accepted+paid bookings whose event has passed.
CREATE INDEX IF NOT EXISTS idx_booking_requests_completion_pending
  ON public.booking_requests (event_date)
  WHERE status = 'accepted' AND payment_status = 'paid';

-- New post-event reminder notification kinds (026 defined the previous full list),
-- plus the updated-price kinds the backend already inserts but 026 accidentally omitted.
ALTER TABLE public.booking_notifications DROP CONSTRAINT IF EXISTS booking_notifications_kind_check;
ALTER TABLE public.booking_notifications ADD CONSTRAINT booking_notifications_kind_check
  CHECK (kind IN (
    'booking_accepted',
    'booking_completed',
    'booking_declined_by_vendor',
    'booking_request_received',
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
    'vendor_completion_reminder'
  ));
