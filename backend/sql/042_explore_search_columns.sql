-- Explore search denormalized columns + approved vendor index.

CREATE INDEX IF NOT EXISTS vendors_approval_status_approved_idx
  ON public.vendors (updated_at DESC)
  WHERE approval_status = 'approved';

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS min_list_price_gbp numeric NULL,
  ADD COLUMN IF NOT EXISTS base_city_normalized text NULL,
  ADD COLUMN IF NOT EXISTS services_offered text[] NULL;

CREATE INDEX IF NOT EXISTS vendors_min_list_price_gbp_idx
  ON public.vendors (min_list_price_gbp)
  WHERE approval_status = 'approved' AND min_list_price_gbp IS NOT NULL;

CREATE INDEX IF NOT EXISTS vendors_base_city_normalized_idx
  ON public.vendors (base_city_normalized)
  WHERE approval_status = 'approved' AND base_city_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS vendors_services_offered_gin_idx
  ON public.vendors USING gin (services_offered)
  WHERE approval_status = 'approved' AND services_offered IS NOT NULL;

COMMENT ON COLUMN public.vendors.min_list_price_gbp IS
  'Denormalized from payload for SQL budget filters on explore search.';
COMMENT ON COLUMN public.vendors.base_city_normalized IS
  'Lowercase trimmed baseCity from vendor payload.';
COMMENT ON COLUMN public.vendors.services_offered IS
  'Denormalized servicesOffered keys from vendor payload.';
