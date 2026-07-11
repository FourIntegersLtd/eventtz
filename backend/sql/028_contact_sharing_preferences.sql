-- Contact-sharing preferences for clients and vendors (default: share all fields).
-- Run after 027_message_quote_metadata.sql

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS share_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_phone boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_address boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.contact_phone IS 'Optional phone the user may share with booking counterparties when share_phone is true.';
COMMENT ON COLUMN public.users.share_email IS 'When true, email is visible to the counterparty on accepted bookings.';
COMMENT ON COLUMN public.users.share_phone IS 'When true, contact_phone is visible to the counterparty on accepted bookings.';
COMMENT ON COLUMN public.users.share_address IS 'When true, event address/postcode is visible to the counterparty on accepted bookings.';
