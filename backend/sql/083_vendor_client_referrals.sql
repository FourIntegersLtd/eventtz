-- Per-vendor client referral codes (lower service fee when clients book with the code).

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS client_referral_code text,
  ADD COLUMN IF NOT EXISTS client_referral_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS vendor_referral_code text,
  ADD COLUMN IF NOT EXISTS service_fee_percent numeric(5, 2) NOT NULL DEFAULT 5.00;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_client_referral_code_unique
  ON public.vendors (client_referral_code)
  WHERE client_referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_requests_vendor_referral_code
  ON public.booking_requests (vendor_referral_code)
  WHERE vendor_referral_code IS NOT NULL;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_client_referral_code_format_chk;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_client_referral_code_format_chk CHECK (
    client_referral_code IS NULL
    OR client_referral_code ~ '^[0-9]{1,6}$'
  );

COMMENT ON COLUMN public.vendors.client_referral_code IS
  'Shareable numeric code for clients (?vref= on browse). 1–6 digits.';

COMMENT ON COLUMN public.vendors.client_referral_enabled IS
  'When false, client_referral_code is ignored for new bookings.';

COMMENT ON COLUMN public.booking_requests.vendor_referral_code IS
  'Vendor client referral code applied at enquiry (nullable).';

COMMENT ON COLUMN public.booking_requests.service_fee_percent IS
  'Snapshotted platform service fee % for this booking (always 5; referral uses fixed GBP tier discount).';
