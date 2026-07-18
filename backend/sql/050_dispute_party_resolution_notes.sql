-- Per-party admin messages on disputes (client vs vendor).

ALTER TABLE public.dispute_cases
  ADD COLUMN IF NOT EXISTS client_resolution_note text,
  ADD COLUMN IF NOT EXISTS vendor_resolution_note text;

COMMENT ON COLUMN public.dispute_cases.client_resolution_note IS
  'Admin message shown only to the client on this dispute.';
COMMENT ON COLUMN public.dispute_cases.vendor_resolution_note IS
  'Admin message shown only to the vendor on this dispute.';
COMMENT ON COLUMN public.dispute_cases.resolution_note IS
  'Legacy shared note; prefer client_resolution_note / vendor_resolution_note. Still used as fallback when party-specific notes are empty.';
