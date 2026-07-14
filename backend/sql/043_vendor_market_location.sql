-- Market + location foundations for multi-country expansion (UK default).

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS country_code char(2) NOT NULL DEFAULT 'GB',
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'GBP';

UPDATE public.vendors SET country_code = 'GB' WHERE country_code IS NULL OR trim(country_code) = '';
UPDATE public.vendors SET currency = 'GBP' WHERE currency IS NULL OR trim(currency) = '';

CREATE INDEX IF NOT EXISTS vendors_country_code_base_city_idx
  ON public.vendors (country_code, base_city_normalized)
  WHERE approval_status = 'approved' AND base_city_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS vendors_country_code_approved_idx
  ON public.vendors (country_code, updated_at DESC)
  WHERE approval_status = 'approved';

COMMENT ON COLUMN public.vendors.country_code IS
  'ISO 3166-1 alpha-2 operating country (denormalized from payload.countryCode).';
COMMENT ON COLUMN public.vendors.currency IS
  'ISO 4217 listing currency for explore budget filters (denormalized from market).';

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'GBP';

UPDATE public.booking_requests SET currency = 'GBP' WHERE currency IS NULL OR trim(currency) = '';

COMMENT ON COLUMN public.booking_requests.currency IS
  'ISO 4217 currency for this booking (defaults to GBP for UK launch).';
