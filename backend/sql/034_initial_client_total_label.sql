-- Snapshot of client-facing total at booking creation (for before/after price UX).
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS initial_client_total_label text;

COMMENT ON COLUMN public.booking_requests.initial_client_total_label IS
  'Client total incl. service fee at request creation; used when vendor sends an updated price.';

-- Backfill from current pricing where possible (best-effort for existing rows).
UPDATE public.booking_requests
SET initial_client_total_label = total_label
WHERE initial_client_total_label IS NULL
  AND total_label IS NOT NULL
  AND total_label <> '';
