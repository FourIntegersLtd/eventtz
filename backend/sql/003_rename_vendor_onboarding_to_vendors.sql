-- If you already ran 001 when it created `vendor_onboarding`, rename to `vendors`.
-- Skip if `vendors` already exists (e.g. you applied an updated 001 that creates `vendors`).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendor_onboarding'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendors'
  ) THEN
    ALTER TABLE public.vendor_onboarding RENAME TO vendors;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_vendor_onboarding_user_id' AND n.nspname = 'public'
  ) THEN
    ALTER INDEX public.idx_vendor_onboarding_user_id RENAME TO idx_vendors_user_id;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_vendor_onboarding_updated_at ON public.vendors;
DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.eventtz_set_updated_at();

COMMENT ON TABLE public.vendors IS 'Vendor profile row per vendor user; payload JSONB (draft/submitted).';
COMMENT ON COLUMN public.vendors.payload IS
  'JSON snapshot of vendor profile (strings, numbers, booleans, string arrays). File blobs: Storage later.';
