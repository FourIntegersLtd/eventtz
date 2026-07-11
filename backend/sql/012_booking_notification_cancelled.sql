-- Allow client notification when vendor cancels an accepted booking.
-- Run after 011_booking_completed_and_notifications.sql.

ALTER TABLE public.booking_notifications DROP CONSTRAINT IF EXISTS booking_notifications_kind_check;
ALTER TABLE public.booking_notifications ADD CONSTRAINT booking_notifications_kind_check
  CHECK (kind IN (
    'booking_accepted',
    'booking_completed',
    'booking_cancelled_by_vendor'
  ));
