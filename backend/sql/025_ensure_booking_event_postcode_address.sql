-- Idempotent: safe if 020/024 were already applied. Run in Supabase SQL Editor if inserts fail with
-- "Could not find the 'event_address' column" (PGRST204).

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS event_postcode text;

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS event_address text;

COMMENT ON COLUMN public.booking_requests.event_postcode IS
  'Venue/event location postcode supplied by the client when requesting a booking.';
COMMENT ON COLUMN public.booking_requests.event_address IS
  'Optional formatted venue address line(s); event_postcode is still required for client requests.';
