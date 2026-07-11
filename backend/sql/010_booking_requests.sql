-- Client booking requests (packages snapshot + event details).
-- Run in Supabase SQL Editor after 001 (public.users exists).

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  vendor_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_date date NOT NULL,
  event_end_date date,
  notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  selected_option_ids text[] NOT NULL DEFAULT '{}',
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_requests_no_self_booking CHECK (client_user_id <> vendor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_client
  ON public.booking_requests (client_user_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_vendor
  ON public.booking_requests (vendor_user_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at
  ON public.booking_requests (created_at DESC);

COMMENT ON TABLE public.booking_requests IS
  'Client-initiated booking enquiry; line_items/selected_option_ids snapshot vendor payload ids.';

DROP TRIGGER IF EXISTS trg_booking_requests_updated_at ON public.booking_requests;
CREATE TRIGGER trg_booking_requests_updated_at
  BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.eventtz_set_updated_at();

-- Backend-only writes via service role; mirror users/vendors if you use 009.
ALTER TABLE public.booking_requests DISABLE ROW LEVEL SECURITY;
