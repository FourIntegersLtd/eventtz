-- Admin vendor moderation: single view matching app merge logic (users ∪ vendors rows).
-- Requires: public.users, public.vendors, and vendors.approval_status (sql/004_*.sql).
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f backend/sql/006_admin_vendor_list_view.sql

CREATE OR REPLACE VIEW public.admin_vendor_list AS
WITH candidate_ids AS (
  SELECT id AS user_id
  FROM public.users
  WHERE user_type = 'vendor'
  UNION
  SELECT user_id
  FROM public.vendors
)
SELECT
  v.id,
  c.user_id,
  u.email,
  COALESCE(v.status, 'draft') AS status,
  COALESCE(v.approval_status, 'pending') AS approval_status,
  COALESCE(v.current_step, 1) AS current_step,
  COALESCE(v.payload, '{}'::jsonb) AS payload,
  COALESCE(v.created_at, u.created_at) AS created_at,
  COALESCE(v.updated_at, u.updated_at) AS updated_at
FROM candidate_ids c
LEFT JOIN public.users u ON u.id = c.user_id
LEFT JOIN public.vendors v ON v.user_id = c.user_id;

COMMENT ON VIEW public.admin_vendor_list IS
  'Rows for admin vendor list: union of vendor-role users and vendors profile rows, with coalesced defaults.';

REVOKE ALL ON public.admin_vendor_list FROM PUBLIC;
GRANT SELECT ON public.admin_vendor_list TO service_role;
