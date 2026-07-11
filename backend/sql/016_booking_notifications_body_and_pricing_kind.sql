-- Optional message body on booking notifications + kind for vendor pricing updates.
-- Run after 012_booking_notification_cancelled.sql.

ALTER TABLE public.booking_notifications
  ADD COLUMN IF NOT EXISTS body text;

COMMENT ON COLUMN public.booking_notifications.body IS
  'Human-readable summary (e.g. updated total and vendor additions) for the client.';

ALTER TABLE public.booking_notifications DROP CONSTRAINT IF EXISTS booking_notifications_kind_check;
ALTER TABLE public.booking_notifications ADD CONSTRAINT booking_notifications_kind_check
  CHECK (kind IN (
    'booking_accepted',
    'booking_completed',
    'booking_cancelled_by_vendor',
    'booking_pricing_updated'
  ));
