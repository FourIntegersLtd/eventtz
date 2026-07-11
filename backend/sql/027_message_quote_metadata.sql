-- Structured metadata on chat messages, starting with system "quote sent" cards so a
-- custom quote shows up as a clickable card in the thread for both parties (not plain text).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.messages.metadata IS
  'Optional structured payload for non-plain-text messages, e.g. {"kind":"quote","booking_request_id":"...","event_name":"...","total_label":"...","status":"pending"}.';
