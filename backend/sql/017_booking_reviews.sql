-- One review per completed booking (linked to booking_requests).
-- Run in Supabase SQL Editor after 010_booking_requests.sql.

CREATE TABLE IF NOT EXISTS public.booking_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id uuid NOT NULL UNIQUE REFERENCES public.booking_requests (id) ON DELETE CASCADE,
  vendor_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body text NOT NULL CHECK (char_length(body) >= 10 AND char_length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_reviews_vendor
  ON public.booking_reviews (vendor_user_id);
CREATE INDEX IF NOT EXISTS idx_booking_reviews_client
  ON public.booking_reviews (client_user_id);

COMMENT ON TABLE public.booking_reviews IS
  'Client review after a completed booking; UNIQUE(booking_request_id) enforces one review per booking.';

DROP TRIGGER IF EXISTS trg_booking_reviews_updated_at ON public.booking_reviews;
CREATE TRIGGER trg_booking_reviews_updated_at
  BEFORE UPDATE ON public.booking_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.eventtz_set_updated_at();

ALTER TABLE public.booking_reviews DISABLE ROW LEVEL SECURITY;

-- Aggregates for explore cards and sorting (PostgREST-readable).
CREATE OR REPLACE VIEW public.vendor_review_stats AS
SELECT
  vendor_user_id,
  COUNT(*)::bigint AS review_count,
  ROUND(AVG(rating)::numeric, 2)::double precision AS average_rating
FROM public.booking_reviews
GROUP BY vendor_user_id;

COMMENT ON VIEW public.vendor_review_stats IS
  'Average rating and count per vendor for marketplace and public profile.';
