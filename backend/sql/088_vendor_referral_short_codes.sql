-- Vendor client referral codes: numeric 1–6 digits (replaces slug-based codes).

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_client_referral_code_format_chk;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_client_referral_code_format_chk CHECK (
    client_referral_code IS NULL
    OR client_referral_code ~ '^[0-9]{1,6}$'
  );

-- Clear legacy slug codes; vendors generate a new short code from the dashboard.
UPDATE public.vendors
SET client_referral_code = NULL
WHERE client_referral_code IS NOT NULL
  AND client_referral_code !~ '^[0-9]{1,6}$';

COMMENT ON COLUMN public.vendors.client_referral_code IS
  'Shareable numeric code for clients (?vref= on browse, or booking form). 1–6 digits.';

UPDATE public.help_articles
SET
  summary = 'Share a link or up to 6-digit code so clients save on the Eventtz fee.',
  updated_at = now()
WHERE slug = 'vendor-client-referrals';
