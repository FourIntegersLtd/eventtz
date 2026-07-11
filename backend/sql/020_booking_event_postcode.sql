-- Event venue postcode for client booking requests (UK-style; required for new client requests via API).
-- Run in Supabase SQL Editor after prior booking_requests migrations.

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS event_postcode text;

COMMENT ON COLUMN public.booking_requests.event_postcode IS
  'Venue/event location postcode supplied by the client when requesting a booking.';
