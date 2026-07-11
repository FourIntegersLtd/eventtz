-- Extend moderation statuses to include banned.
-- Run after 004_vendors_approval_status.sql.

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_approval_status_chk;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_approval_status_chk
  CHECK (approval_status IN ('pending', 'approved', 'banned'));

COMMENT ON COLUMN public.vendors.approval_status IS
  'pending = awaiting admin; approved = visible in client explore; banned = hidden.';
