-- Completed bookings + in-app notifications for clients when status changes.
-- Run after 010_booking_requests.sql.

-- Allow vendors to mark accepted jobs as completed.
ALTER TABLE public.booking_requests DROP CONSTRAINT IF EXISTS booking_requests_status_check;
ALTER TABLE public.booking_requests ADD CONSTRAINT booking_requests_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed'));

-- Client-visible notifications (in-app; email can be added later using these rows).
CREATE TABLE IF NOT EXISTS public.booking_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.booking_requests (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('booking_accepted', 'booking_completed')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_booking_notifications_booking_kind UNIQUE (booking_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_booking_notifications_user_created
  ON public.booking_notifications (user_id, created_at DESC);

COMMENT ON TABLE public.booking_notifications IS
  'In-app alerts for clients when a vendor accepts or completes a booking.';

ALTER TABLE public.booking_notifications DISABLE ROW LEVEL SECURITY;
