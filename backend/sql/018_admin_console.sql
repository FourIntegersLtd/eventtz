-- Admin console: user suspend, disputes, audit log, review moderation, optional Stripe refs.
-- Run in Supabase after 017_booking_reviews.sql.

-- Suspend client/vendor login (checked in auth / future middleware; backend can filter lists).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_suspended boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.account_suspended IS
  'When true, user should be blocked from app actions (enforce in API as you roll out).';

-- Dispute cases (trust & safety).
CREATE TABLE IF NOT EXISTS public.dispute_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id uuid NOT NULL REFERENCES public.booking_requests (id) ON DELETE CASCADE,
  opened_by_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
  summary text NOT NULL CHECK (char_length(summary) >= 1 AND char_length(summary) <= 4000),
  internal_notes text,
  resolution_note text,
  assigned_admin_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dispute_cases_booking ON public.dispute_cases (booking_request_id);
CREATE INDEX IF NOT EXISTS idx_dispute_cases_status ON public.dispute_cases (status);

DROP TRIGGER IF EXISTS trg_dispute_cases_updated_at ON public.dispute_cases;
CREATE TRIGGER trg_dispute_cases_updated_at
  BEFORE UPDATE ON public.dispute_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.eventtz_set_updated_at();

ALTER TABLE public.dispute_cases DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.dispute_cases IS 'Admin-managed disputes linked to a booking request.';

-- Audit log for admin actions (service role writes only).
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log (created_at DESC);
ALTER TABLE public.admin_audit_log DISABLE ROW LEVEL SECURITY;

-- Review moderation (hide from public vendor profile / explore).
ALTER TABLE public.booking_reviews
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

COMMENT ON COLUMN public.booking_reviews.hidden_at IS
  'When set, review is excluded from public lists (admin moderation).';

-- Optional Stripe reconciliation (filled by webhooks later).
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS payment_amount_gbp numeric(12, 2);

COMMENT ON COLUMN public.booking_requests.stripe_payment_intent_id IS 'Stripe PaymentIntent id when checkout is integrated.';
COMMENT ON COLUMN public.booking_requests.payment_amount_gbp IS 'Captured payment amount in GBP when known.';

-- Exclude moderated reviews from marketplace aggregates.
CREATE OR REPLACE VIEW public.vendor_review_stats AS
SELECT
  vendor_user_id,
  COUNT(*)::bigint AS review_count,
  ROUND(AVG(rating)::numeric, 2)::double precision AS average_rating
FROM public.booking_reviews
WHERE hidden_at IS NULL
GROUP BY vendor_user_id;

COMMENT ON VIEW public.vendor_review_stats IS
  'Average rating and count per vendor (visible reviews only).';
