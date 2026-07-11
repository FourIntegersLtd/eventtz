-- Optional full venue address (e.g. from getAddress.io lookup); postcode remains canonical for search/travel.
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS event_address text;

COMMENT ON COLUMN public.booking_requests.event_address IS
  'Optional formatted venue address line(s); event_postcode is still required for client requests.';
