-- Stripe Connect (vendor payouts) + Checkout (client payments).
-- Run after 018_admin_console.sql (stripe_payment_intent_id/stripe_charge_id/payment_amount_gbp)
-- and 019_booking_vendor_initiator.sql (booking_notifications_kind_check baseline).
--
-- Design: `booking_requests.status` (pending/accepted/declined/cancelled/completed) stays the
-- request lifecycle exactly as-is. `payment_status` is an independent money-lifecycle column so
-- none of the existing status filters, dispute-eligibility, or review-gating logic need to change.

-- Vendor Stripe Connect Express account + capability flags.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_vendors_stripe_account_id
  ON public.vendors (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

COMMENT ON COLUMN public.vendors.stripe_account_id IS 'Stripe Connect Express account id (acct_...).';
COMMENT ON COLUMN public.vendors.stripe_charges_enabled IS 'Mirrors Stripe Account.charges_enabled.';
COMMENT ON COLUMN public.vendors.stripe_payouts_enabled IS 'Mirrors Stripe Account.payouts_enabled.';

-- Booking payment lifecycle, independent of booking_requests.status.
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS vendor_amount_gbp numeric(12, 2),
  ADD COLUMN IF NOT EXISTS platform_fee_gbp numeric(12, 2),
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS payout_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_completion_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_completion_confirmed_at timestamptz;

ALTER TABLE public.booking_requests DROP CONSTRAINT IF EXISTS booking_requests_payment_status_check;
ALTER TABLE public.booking_requests ADD CONSTRAINT booking_requests_payment_status_check
  CHECK (payment_status IN (
    'unpaid',
    'pending',
    'paid',
    'refunded',
    'partially_refunded',
    'payout_released'
  ));

CREATE INDEX IF NOT EXISTS idx_booking_requests_payment_status
  ON public.booking_requests (payment_status);
CREATE INDEX IF NOT EXISTS idx_booking_requests_stripe_checkout_session_id
  ON public.booking_requests (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

COMMENT ON COLUMN public.booking_requests.payment_status IS
  'Money lifecycle, independent of status: unpaid -> pending -> paid -> payout_released, or refunded/partially_refunded via disputes.';
COMMENT ON COLUMN public.booking_requests.vendor_amount_gbp IS 'Vendor portion snapshot at payment time (does not move if pricing edits happen later).';
COMMENT ON COLUMN public.booking_requests.platform_fee_gbp IS 'Eventtz service fee snapshot at payment time.';
COMMENT ON COLUMN public.booking_requests.stripe_transfer_id IS 'Stripe Transfer id once the vendor payout has been released.';
COMMENT ON COLUMN public.booking_requests.client_completion_confirmed_at IS 'Client confirmed the event/booking is complete.';
COMMENT ON COLUMN public.booking_requests.vendor_completion_confirmed_at IS 'Vendor confirmed the event/booking is complete. Both set -> status=completed + payout released.';

-- Idempotency ledger for Stripe webhook delivery (Stripe may deliver the same event more than once).
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events DISABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.stripe_webhook_events IS 'Processed Stripe event ids, for webhook dedupe.';

-- Dispute resolution now records the money decision alongside the existing note/status fields.
ALTER TABLE public.dispute_cases
  ADD COLUMN IF NOT EXISTS resolution_action text,
  ADD COLUMN IF NOT EXISTS refund_amount_gbp numeric(12, 2);

ALTER TABLE public.dispute_cases DROP CONSTRAINT IF EXISTS dispute_cases_resolution_action_check;
ALTER TABLE public.dispute_cases ADD CONSTRAINT dispute_cases_resolution_action_check
  CHECK (resolution_action IS NULL OR resolution_action IN (
    'release_to_vendor',
    'refund_client',
    'partial_refund'
  ));

COMMENT ON COLUMN public.dispute_cases.resolution_action IS 'Money decision recorded when an admin resolves the dispute.';
COMMENT ON COLUMN public.dispute_cases.refund_amount_gbp IS 'Set when resolution_action = partial_refund.';

-- Full, corrected set of booking notification kinds (the vendor.019 migration's list had drifted
-- from what the backend actually inserts) plus new payment/payout kinds.
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
    'vendor_quote_received',
    'vendor_quote_accepted',
    'vendor_quote_declined',
    'vendor_quote_withdrawn',
    'payment_received',
    'vendor_payment_received',
    'vendor_payout_released',
    'payment_refunded',
    'completion_confirmed_awaiting_other_party'
  ));
