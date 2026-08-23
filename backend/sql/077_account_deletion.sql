-- Account deletion (UK GDPR Art. 17): keep a public.users tombstone so shared
-- bookings/chats/reviews cannot cascade-wipe the other party.
-- Run after 076_high_impact_reminders.sql.

-- ---------------------------------------------------------------------------
-- Tombstone columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.users.deleted_at IS
  'When set, the account is closed: login is gone, PII is stripped, row kept for booking FKs.';

CREATE INDEX IF NOT EXISTS idx_users_deleted_at
  ON public.users (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Auth delete must not cascade into public.users (and therefore bookings).
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_id_fkey;

-- ---------------------------------------------------------------------------
-- Shared tables: CASCADE -> RESTRICT so a mistaken users DELETE fails closed
-- ---------------------------------------------------------------------------
ALTER TABLE public.booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_client_user_id_fkey;
ALTER TABLE public.booking_requests
  ADD CONSTRAINT booking_requests_client_user_id_fkey
  FOREIGN KEY (client_user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_vendor_user_id_fkey;
ALTER TABLE public.booking_requests
  ADD CONSTRAINT booking_requests_vendor_user_id_fkey
  FOREIGN KEY (vendor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_client_user_id_fkey;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_client_user_id_fkey
  FOREIGN KEY (client_user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_vendor_user_id_fkey;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_vendor_user_id_fkey
  FOREIGN KEY (vendor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.booking_reviews
  DROP CONSTRAINT IF EXISTS booking_reviews_client_user_id_fkey;
ALTER TABLE public.booking_reviews
  ADD CONSTRAINT booking_reviews_client_user_id_fkey
  FOREIGN KEY (client_user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.booking_reviews
  DROP CONSTRAINT IF EXISTS booking_reviews_vendor_user_id_fkey;
ALTER TABLE public.booking_reviews
  ADD CONSTRAINT booking_reviews_vendor_user_id_fkey
  FOREIGN KEY (vendor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.dispute_cases
  DROP CONSTRAINT IF EXISTS dispute_cases_opened_by_user_id_fkey;
ALTER TABLE public.dispute_cases
  ADD CONSTRAINT dispute_cases_opened_by_user_id_fkey
  FOREIGN KEY (opened_by_user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_user_id_fkey;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT;
