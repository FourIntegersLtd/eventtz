-- Marketplace visibility now requires admin approval AND verified Stripe Connect.
-- A vendor who cannot take a charge or receive a payout would strand the client
-- mid-checkout, so they stay hidden from explore/search until Stripe reports both
-- flags (kept in sync by the account.updated webhook).

CREATE INDEX IF NOT EXISTS vendors_public_listing_idx
  ON public.vendors (country_code, updated_at DESC)
  WHERE approval_status = 'approved'
    AND stripe_account_id IS NOT NULL
    AND stripe_charges_enabled
    AND stripe_payouts_enabled;

COMMENT ON INDEX public.vendors_public_listing_idx IS
  'Public marketplace listing gate: approved + Stripe charges and payouts enabled.';
