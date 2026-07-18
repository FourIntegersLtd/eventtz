-- Marketplace product analytics event log (profile views, funnel stages).

CREATE TABLE IF NOT EXISTS public.marketplace_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  actor_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  vendor_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  booking_request_id uuid REFERENCES public.booking_requests (id) ON DELETE SET NULL,
  category text,
  location text,
  booking_value_gbp numeric(12, 2),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_events_event_name_check CHECK (
    event_name IN (
      'vendor_profile_viewed',
      'enquiry_created',
      'vendor_notified',
      'vendor_message_sent',
      'vendor_accepted_booking',
      'vendor_declined_booking',
      'customer_started_payment',
      'customer_payment_completed',
      'booking_completed',
      'booking_cancelled',
      'review_submitted',
      'enquiry_unfulfilled'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_marketplace_events_created
  ON public.marketplace_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_name_created
  ON public.marketplace_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_vendor_created
  ON public.marketplace_events (vendor_user_id, created_at DESC)
  WHERE vendor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_events_booking
  ON public.marketplace_events (booking_request_id)
  WHERE booking_request_id IS NOT NULL;

COMMENT ON TABLE public.marketplace_events IS
  'Lightweight marketplace funnel events for analytics (not a third-party SDK).';

-- RLS: backend service role only (mirror other analytics-ish tables).
ALTER TABLE public.marketplace_events ENABLE ROW LEVEL SECURITY;
