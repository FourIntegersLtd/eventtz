-- Client events: group multi-vendor bookings under one celebration (e.g. a wedding).

CREATE TABLE IF NOT EXISTS public.client_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  event_date date NOT NULL,
  event_end_date date,
  event_address text,
  event_postcode text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_events_client_status_date
  ON public.client_events (client_user_id, status, event_date DESC);

COMMENT ON TABLE public.client_events IS
  'Client-owned celebration/event; multiple booking_requests can link to one event.';

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.client_events (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_booking_requests_client_event
  ON public.booking_requests (client_user_id, event_id)
  WHERE event_id IS NOT NULL;

COMMENT ON COLUMN public.booking_requests.event_id IS
  'Optional link to client_events for multi-vendor planning under one celebration.';

DROP TRIGGER IF EXISTS trg_client_events_updated_at ON public.client_events;
CREATE TRIGGER trg_client_events_updated_at
  BEFORE UPDATE ON public.client_events
  FOR EACH ROW
  EXECUTE FUNCTION public.eventtz_set_updated_at();

ALTER TABLE public.client_events DISABLE ROW LEVEL SECURITY;
