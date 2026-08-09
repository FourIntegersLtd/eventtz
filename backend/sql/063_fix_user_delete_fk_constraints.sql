-- Fix two foreign keys that block deleting a user from auth.users.
-- Run in Supabase after 062_vendor_listing_override.sql.
--
-- Bug 1: admin_audit_log.admin_user_id is NOT NULL but ON DELETE SET NULL - Postgres
-- tries to null it out when the admin is deleted, then immediately violates the
-- NOT NULL constraint. Audit history should survive the admin being deleted, so make
-- the column nullable (the row itself, and its action/entity/payload, still means
-- something with the actor unknown).
ALTER TABLE public.admin_audit_log
  ALTER COLUMN admin_user_id DROP NOT NULL;

-- Bug 2: contact_submissions.user_id had no ON DELETE action, so it defaulted to
-- RESTRICT - deleting a user who ever used the contact form would fail outright.
ALTER TABLE public.contact_submissions
  DROP CONSTRAINT IF EXISTS contact_submissions_user_id_fkey;

ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
