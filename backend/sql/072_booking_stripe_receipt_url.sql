-- Stripe-hosted card receipt URL (supplemental link on client payment receipts).
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS stripe_receipt_url text;

COMMENT ON COLUMN public.booking_requests.stripe_receipt_url IS
  'Stripe Charge.receipt_url snapshot at payment time (client card receipt).';
