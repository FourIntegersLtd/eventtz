-- Immutable receipt payloads frozen at payment / payout time (OSCE-style audit snapshots).
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS payment_receipt_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS vendor_payment_record_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS vendor_payout_statement_snapshot jsonb;

COMMENT ON COLUMN public.booking_requests.payment_receipt_snapshot IS
  'Frozen client payment receipt JSON at checkout; write-once.';
COMMENT ON COLUMN public.booking_requests.vendor_payment_record_snapshot IS
  'Frozen vendor payment record JSON when client pays; write-once.';
COMMENT ON COLUMN public.booking_requests.vendor_payout_statement_snapshot IS
  'Frozen vendor payout statement JSON when transfer succeeds; write-once.';
