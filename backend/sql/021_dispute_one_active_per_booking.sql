-- At most one open/under_review dispute per booking (concurrency-safe).
-- Run after 018_admin_console.sql.

CREATE UNIQUE INDEX IF NOT EXISTS idx_dispute_cases_one_active_per_booking
  ON public.dispute_cases (booking_request_id)
  WHERE status IN ('open', 'under_review');

COMMENT ON INDEX idx_dispute_cases_one_active_per_booking IS
  'Prevents two concurrent inserts from opening two active disputes for the same booking.';
