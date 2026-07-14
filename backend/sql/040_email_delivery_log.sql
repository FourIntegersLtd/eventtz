-- Idempotent transactional email log (Resend dedupe for retryable kinds).

CREATE TABLE IF NOT EXISTS public.email_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL,
  recipient_email text NOT NULL,
  recipient_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  booking_id uuid NULL REFERENCES public.booking_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_delivery_log_dedupe_idx
  ON public.email_delivery_log (template_id, booking_id, recipient_user_id)
  WHERE booking_id IS NOT NULL AND recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_delivery_log_created_at_idx
  ON public.email_delivery_log (created_at DESC);

COMMENT ON TABLE public.email_delivery_log IS
  'Records sent transactional emails; unique index prevents duplicate booking lifecycle sends.';
