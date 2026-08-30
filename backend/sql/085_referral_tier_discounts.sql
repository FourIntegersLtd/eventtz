-- Tiered referral fee discounts (fixed GBP off Eventtz fee, snapshotted at payment).

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS referral_fee_discount_gbp numeric(12, 2);

COMMENT ON COLUMN public.booking_requests.referral_fee_discount_gbp IS
  'GBP discount applied to Eventtz service fee via vendor client referral tier (snapshot at payment).';

COMMENT ON COLUMN public.booking_requests.service_fee_percent IS
  'Snapshotted platform service fee % for this booking (always 5; referral uses fixed GBP discount).';
