-- Admin escape hatch on top of the automatic visibility rule from sql/061.
--
--   auto    - default: live only when approved AND Stripe is verified.
--   visible - admin waives the Stripe requirement (a partner Eventtz has vetted
--             offline, or stale Connect flags). Checkout still works because the
--             client's money lands in Eventtz's own balance; only the final payout
--             Transfer needs their Connect account, and that already waits safely.
--   hidden  - take a live vendor down without banning them (complaint under review,
--             vendor asked for a break). Unlike 'banned' they keep portal access.
--
-- 'approved' is still required for any of this: a banned or unreviewed vendor is
-- never publicly listed, whatever the override says.

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS listing_override text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS listing_override_reason text,
  ADD COLUMN IF NOT EXISTS listing_override_by uuid,
  ADD COLUMN IF NOT EXISTS listing_override_at timestamptz;

DO $$
BEGIN
  ALTER TABLE public.vendors
    ADD CONSTRAINT vendors_listing_override_check
    CHECK (listing_override IN ('auto', 'visible', 'hidden'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

COMMENT ON COLUMN public.vendors.listing_override IS
  'auto = approval + Stripe decide visibility; visible = admin waives the Stripe gate; hidden = admin takes the listing down without banning.';

-- Replace the sql/061 index: the listing predicate now has an OR branch, and a
-- partial index only helps if its predicate matches the query's WHERE clause.
DROP INDEX IF EXISTS public.vendors_public_listing_idx;

CREATE INDEX IF NOT EXISTS vendors_public_listing_idx
  ON public.vendors (country_code, updated_at DESC)
  WHERE approval_status = 'approved'
    AND listing_override <> 'hidden'
    AND (
      listing_override = 'visible'
      OR (
        stripe_account_id IS NOT NULL
        AND stripe_charges_enabled
        AND stripe_payouts_enabled
      )
    );

COMMENT ON INDEX public.vendors_public_listing_idx IS
  'Public marketplace listing gate: approved, not force-hidden, and either Stripe-verified or admin-waived.';
