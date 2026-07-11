-- Speed up booking list queries ordered by updated_at (most recent activity first).
-- Run after 010_booking_requests.sql.

CREATE INDEX IF NOT EXISTS idx_booking_requests_updated_at
  ON public.booking_requests (updated_at DESC);
