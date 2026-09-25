-- Verify vendor business name uniqueness after 032_vendor_business_name_unique.sql
-- Run in Supabase SQL Editor (or: psql $DATABASE_URL -f backend/sql/032_verify_vendor_business_name_unique.sql)

-- 1) Unique index exists
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'vendors'
  AND indexname = 'idx_vendors_business_name_normalized_unique';

-- 2) Generated column exists
SELECT
  column_name,
  data_type,
  is_generated,
  generation_expression
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'vendors'
  AND column_name = 'business_name_normalized';

-- 3) No duplicate normalized names (should return 0 rows)
SELECT
  business_name_normalized,
  count(*) AS vendor_count,
  array_agg(user_id ORDER BY created_at) AS user_ids,
  array_agg(payload->>'businessName' ORDER BY created_at) AS display_names
FROM public.vendors
WHERE business_name_normalized IS NOT NULL
GROUP BY business_name_normalized
HAVING count(*) > 1;

-- 4) Sample of vendors with normalized names (sanity check)
SELECT
  user_id,
  payload->>'businessName' AS business_name,
  business_name_normalized,
  (SELECT count(*) FROM public.booking_requests br WHERE br.vendor_user_id = v.user_id) AS bookings
FROM public.vendors v
WHERE business_name_normalized IS NOT NULL
ORDER BY business_name_normalized, created_at
LIMIT 50;
