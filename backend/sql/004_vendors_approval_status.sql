-- Vendor moderation: admin approves listings after profile submission.
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f backend/sql/004_vendors_approval_status.sql

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';

-- Normalize existing rows (column default only applies on INSERT)
UPDATE public.vendors SET approval_status = 'pending' WHERE approval_status IS NULL;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_approval_status_chk;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_approval_status_chk
  CHECK (approval_status IN ('pending', 'approved'));

COMMENT ON COLUMN public.vendors.approval_status IS
  'pending = awaiting admin; approved = visible / vendor can open profile review.';
