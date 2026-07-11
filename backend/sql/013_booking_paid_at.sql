-- Timestamp when payment succeeded (e.g. Stripe webhook). Run after 010_booking_requests.sql.

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

COMMENT ON COLUMN public.booking_requests.paid_at IS
  'Set automatically when payment succeeds (e.g. Stripe). Not used for manual confirmation.';
