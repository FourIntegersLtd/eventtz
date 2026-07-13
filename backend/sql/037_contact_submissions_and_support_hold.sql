-- Contact form submissions (client/vendor support) + admin support hold on bookings.

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  portal text NOT NULL CHECK (portal IN ('client', 'vendor')),
  subject text NOT NULL,
  message text NOT NULL,
  booking_id uuid NULL REFERENCES public.booking_requests(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at
  ON public.contact_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_user_id
  ON public.contact_submissions (user_id);

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS support_hold boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.booking_requests.support_hold IS
  'When true, blocks automatic payout release until cleared by support.';
